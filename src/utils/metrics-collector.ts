/**
 * Performance monitoring and metrics collection for LLM providers
 * Tracks response times, success rates, and provider health metrics
 */

/**
 * Interface for provider performance metrics
 */
export interface ProviderMetrics {
  provider: string;
  responseTime: number;
  successRate: number;
  lastHealthCheck: Date;
  totalRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  lastRequest: Date;
}

/**
 * Interface for metrics collection configuration
 */
export interface MetricsConfig {
  maxHistorySize: number;
  alertThresholds: {
    minSuccessRate: number;
    maxResponseTime: number;
    maxFailureRate: number;
  };
  persistenceEnabled: boolean;
}

/**
 * Default metrics configuration
 */
const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  maxHistorySize: 1000,
  alertThresholds: {
    minSuccessRate: 95,
    maxResponseTime: 10000, // 10 seconds
    maxFailureRate: 5,
  },
  persistenceEnabled: false,
};

/**
 * Individual request data for history tracking
 */
interface RequestHistory {
  timestamp: Date;
  responseTime: number;
  success: boolean;
  error?: string;
}

/**
 * MetricsCollector class for provider performance monitoring
 */
export class MetricsCollector {
  private metrics = new Map<string, ProviderMetrics>();
  private history = new Map<string, RequestHistory[]>();
  private config: MetricsConfig;
  private startTime: Date;

  constructor(config?: Partial<MetricsConfig>) {
    this.config = { ...DEFAULT_METRICS_CONFIG, ...config };
    this.startTime = new Date();
  }

  /**
   * Record a provider call with performance data
   */
  recordProviderCall(
    provider: string,
    responseTime: number,
    success: boolean,
    error?: string
  ): void {
    const now = new Date();

    // Update request history
    this.updateHistory(provider, {
      timestamp: now,
      responseTime,
      success,
      error,
    });

    // Get or create metrics
    const current =
      this.metrics.get(provider) || this.createInitialMetrics(provider);

    // Update counters
    current.totalRequests++;
    current.lastRequest = now;

    if (!success) {
      current.failedRequests++;
    }

    // Calculate success rate
    current.successRate =
      ((current.totalRequests - current.failedRequests) /
        current.totalRequests) *
      100;

    // Update response times
    this.updateResponseTimes(current, responseTime);

    // Store updated metrics
    this.metrics.set(provider, current);
  }

  /**
   * Record a health check result
   */
  recordHealthCheck(
    provider: string,
    success: boolean,
    responseTime?: number
  ): void {
    const current =
      this.metrics.get(provider) || this.createInitialMetrics(provider);

    current.lastHealthCheck = new Date();

    if (responseTime !== undefined) {
      this.recordProviderCall(provider, responseTime, success);
    }

    this.metrics.set(provider, current);
  }

  /**
   * Get metrics for a specific provider
   */
  getProviderMetrics(provider: string): ProviderMetrics | null {
    return this.metrics.get(provider) || null;
  }

  /**
   * Get metrics for all providers
   */
  getAllMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics summary with alerts
   */
  getMetricsSummary(): {
    providers: ProviderMetrics[];
    alerts: Array<{ provider: string; type: string; message: string }>;
    uptime: number;
    totalRequests: number;
  } {
    const providers = this.getAllMetrics();
    const alerts = this.generateAlerts(providers);
    const totalRequests = providers.reduce(
      (sum, p) => sum + p.totalRequests,
      0
    );
    const uptime = Date.now() - this.startTime.getTime();

    return {
      providers,
      alerts,
      uptime,
      totalRequests,
    };
  }

  /**
   * Reset metrics for a provider
   */
  resetProviderMetrics(provider: string): void {
    this.metrics.delete(provider);
    this.history.delete(provider);
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.metrics.clear();
    this.history.clear();
    this.startTime = new Date();
  }

  /**
   * Get provider rankings based on performance
   */
  getProviderRankings(): Array<{
    provider: string;
    score: number;
    rank: number;
  }> {
    const providers = this.getAllMetrics();

    // Calculate performance scores (higher is better)
    const scored = providers.map((p) => ({
      provider: p.provider,
      score: this.calculatePerformanceScore(p),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Add rankings
    return scored.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }

  /**
   * Create initial metrics for a new provider
   */
  private createInitialMetrics(provider: string): ProviderMetrics {
    const now = new Date();
    return {
      provider,
      responseTime: 0,
      successRate: 100,
      lastHealthCheck: now,
      totalRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      lastRequest: now,
    };
  }

  /**
   * Update request history for a provider
   */
  private updateHistory(provider: string, request: RequestHistory): void {
    if (!this.history.has(provider)) {
      this.history.set(provider, []);
    }

    const history = this.history.get(provider)!;
    history.push(request);

    // Trim history to max size
    if (history.length > this.config.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Update response time metrics
   */
  private updateResponseTimes(
    metrics: ProviderMetrics,
    responseTime: number
  ): void {
    // Update average
    const totalTime =
      metrics.avgResponseTime * (metrics.totalRequests - 1) + responseTime;
    metrics.avgResponseTime = totalTime / metrics.totalRequests;

    // Update current response time
    metrics.responseTime = responseTime;

    // Calculate P95 from history
    const history = this.history.get(metrics.provider);
    if (history && history.length > 0) {
      const responseTimes = history
        .filter((h) => h.success)
        .map((h) => h.responseTime)
        .sort((a, b) => a - b);

      if (responseTimes.length > 0) {
        const p95Index = Math.ceil(responseTimes.length * 0.95) - 1;
        metrics.p95ResponseTime = responseTimes[p95Index];
      }
    }
  }

  /**
   * Generate alerts based on thresholds
   */
  private generateAlerts(
    providers: ProviderMetrics[]
  ): Array<{ provider: string; type: string; message: string }> {
    const alerts: Array<{ provider: string; type: string; message: string }> =
      [];

    for (const provider of providers) {
      // Success rate alert
      if (provider.successRate < this.config.alertThresholds.minSuccessRate) {
        alerts.push({
          provider: provider.provider,
          type: "success_rate",
          message: `Success rate ${provider.successRate.toFixed(
            1
          )}% is below threshold ${
            this.config.alertThresholds.minSuccessRate
          }%`,
        });
      }

      // Response time alert
      if (
        provider.avgResponseTime > this.config.alertThresholds.maxResponseTime
      ) {
        alerts.push({
          provider: provider.provider,
          type: "response_time",
          message: `Average response time ${provider.avgResponseTime}ms exceeds threshold ${this.config.alertThresholds.maxResponseTime}ms`,
        });
      }

      // Failure rate alert
      const failureRate =
        (provider.failedRequests / provider.totalRequests) * 100;
      if (failureRate > this.config.alertThresholds.maxFailureRate) {
        alerts.push({
          provider: provider.provider,
          type: "failure_rate",
          message: `Failure rate ${failureRate.toFixed(1)}% exceeds threshold ${
            this.config.alertThresholds.maxFailureRate
          }%`,
        });
      }

      // Stale health check alert (more than 5 minutes)
      const healthCheckAge = Date.now() - provider.lastHealthCheck.getTime();
      if (healthCheckAge > 300000) {
        alerts.push({
          provider: provider.provider,
          type: "stale_health_check",
          message: `Health check is stale (${Math.round(
            healthCheckAge / 60000
          )} minutes old)`,
        });
      }
    }

    return alerts;
  }

  /**
   * Calculate performance score for ranking
   */
  private calculatePerformanceScore(metrics: ProviderMetrics): number {
    if (metrics.totalRequests === 0) return 0;

    // Weighted scoring: success rate (60%), response time (40%)
    const successScore = metrics.successRate;
    const responseScore = Math.max(0, 100 - metrics.avgResponseTime / 100); // Penalize slow responses

    return successScore * 0.6 + responseScore * 0.4;
  }
}

// Global metrics collector instance
let globalMetricsCollector: MetricsCollector | null = null;

/**
 * Get or create the global metrics collector instance
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector();
  }
  return globalMetricsCollector;
}

/**
 * Initialize metrics collector with custom config
 */
export function initializeMetricsCollector(
  config?: Partial<MetricsConfig>
): MetricsCollector {
  globalMetricsCollector = new MetricsCollector(config);
  return globalMetricsCollector;
}

/**
 * Helper function to format metrics for display
 */
export function formatMetrics(metrics: ProviderMetrics): string {
  return [
    `Provider: ${metrics.provider}`,
    `Total Requests: ${metrics.totalRequests}`,
    `Success Rate: ${metrics.successRate.toFixed(1)}%`,
    `Avg Response Time: ${metrics.avgResponseTime.toFixed(0)}ms`,
    `P95 Response Time: ${metrics.p95ResponseTime.toFixed(0)}ms`,
    `Last Request: ${metrics.lastRequest.toISOString()}`,
    `Last Health Check: ${metrics.lastHealthCheck.toISOString()}`,
  ].join("\n");
}
