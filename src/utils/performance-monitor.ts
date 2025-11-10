// Performance monitoring utility for MCP server
// Addresses performance tracking gaps identified in audit

export interface PerformanceMetrics {
  operationName: string;
  provider?: string;
  model?: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  memoryUsage: NodeJS.MemoryUsage;
  retryAttempts: number;
  timestamp: Date;
}

export interface AggregatedMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  totalRetries: number;
  lastUpdated: Date;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxHistorySize: number = 1000;
  private aggregateByProvider: Map<string, AggregatedMetrics> = new Map();
  private aggregateByOperation: Map<string, AggregatedMetrics> = new Map();

  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  startOperation(
    operationName: string,
    provider?: string,
    model?: string
  ): PerformanceTracker {
    return new PerformanceTracker(this, operationName, provider, model);
  }

  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Trim history if needed
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics = this.metrics.slice(-this.maxHistorySize);
    }

    // Update aggregated metrics
    this.updateAggregatedMetrics(metric);

    // Log slow operations
    if (metric.duration > 60000) {
      // > 1 minute
      console.warn(`🐌 Slow operation detected:`, {
        operation: metric.operationName,
        provider: metric.provider,
        duration: `${(metric.duration / 1000).toFixed(2)}s`,
        retries: metric.retryAttempts,
      });
    }

    // Log failed operations
    if (!metric.success) {
      console.error(`Operation failed:`, {
        operation: metric.operationName,
        provider: metric.provider,
        error: metric.error,
        duration: `${(metric.duration / 1000).toFixed(2)}s`,
        retries: metric.retryAttempts,
      });
    }
  }

  private updateAggregatedMetrics(metric: PerformanceMetrics): void {
    // Update provider-level aggregates
    if (metric.provider) {
      this.updateAggregate(this.aggregateByProvider, metric.provider, metric);
    }

    // Update operation-level aggregates
    this.updateAggregate(
      this.aggregateByOperation,
      metric.operationName,
      metric
    );
  }

  private updateAggregate(
    aggregateMap: Map<string, AggregatedMetrics>,
    key: string,
    metric: PerformanceMetrics
  ): void {
    const existing = aggregateMap.get(key) || {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      successRate: 0,
      totalRetries: 0,
      lastUpdated: new Date(),
    };

    existing.totalOperations++;
    existing.totalRetries += metric.retryAttempts;
    existing.lastUpdated = new Date();

    if (metric.success) {
      existing.successfulOperations++;
    } else {
      existing.failedOperations++;
    }

    // Update duration statistics
    existing.minDuration = Math.min(existing.minDuration, metric.duration);
    existing.maxDuration = Math.max(existing.maxDuration, metric.duration);

    // Calculate running average
    existing.averageDuration =
      (existing.averageDuration * (existing.totalOperations - 1) +
        metric.duration) /
      existing.totalOperations;

    existing.successRate =
      existing.successfulOperations / existing.totalOperations;

    aggregateMap.set(key, existing);
  }

  getRecentMetrics(count: number = 10): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  getProviderMetrics(provider: string): AggregatedMetrics | null {
    return this.aggregateByProvider.get(provider) || null;
  }

  getOperationMetrics(operation: string): AggregatedMetrics | null {
    return this.aggregateByOperation.get(operation) || null;
  }

  getAllProviderMetrics(): Map<string, AggregatedMetrics> {
    return new Map(this.aggregateByProvider);
  }

  getAllOperationMetrics(): Map<string, AggregatedMetrics> {
    return new Map(this.aggregateByOperation);
  }

  getPerformanceSummary(): {
    totalOperations: number;
    overallSuccessRate: number;
    averageDuration: number;
    slowestOperation: { name: string; duration: number } | null;
    topProviders: Array<{
      provider: string;
      successRate: number;
      avgDuration: number;
    }>;
    memoryUsage: NodeJS.MemoryUsage;
  } {
    const totalOperations = this.metrics.length;
    const successfulOperations = this.metrics.filter((m) => m.success).length;
    const overallSuccessRate =
      totalOperations > 0 ? successfulOperations / totalOperations : 0;

    const averageDuration =
      totalOperations > 0
        ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations
        : 0;

    const slowestOperation =
      this.metrics.length > 0
        ? this.metrics.reduce((slowest, current) =>
            current.duration > slowest.duration ? current : slowest
          )
        : null;

    const topProviders = Array.from(this.aggregateByProvider.entries())
      .map(([provider, metrics]) => ({
        provider,
        successRate: metrics.successRate,
        avgDuration: metrics.averageDuration,
      }))
      .sort(
        (a, b) => b.successRate - a.successRate || a.avgDuration - b.avgDuration
      )
      .slice(0, 5);

    return {
      totalOperations,
      overallSuccessRate,
      averageDuration,
      slowestOperation: slowestOperation
        ? {
            name: slowestOperation.operationName,
            duration: slowestOperation.duration,
          }
        : null,
      topProviders,
      memoryUsage: process.memoryUsage(),
    };
  }

  logPerformanceReport(): void {
    const summary = this.getPerformanceSummary();

    console.log("\n📊 Performance Report:");
    console.log(`  Total Operations: ${summary.totalOperations}`);
    console.log(
      `  Success Rate: ${(summary.overallSuccessRate * 100).toFixed(2)}%`
    );
    console.log(
      `  Average Duration: ${(summary.averageDuration / 1000).toFixed(2)}s`
    );

    if (summary.slowestOperation) {
      console.log(
        `  Slowest Operation: ${summary.slowestOperation.name} (${(
          summary.slowestOperation.duration / 1000
        ).toFixed(2)}s)`
      );
    }

    if (summary.topProviders.length > 0) {
      console.log("  Top Providers:");
      summary.topProviders.forEach((provider) => {
        console.log(
          `    ${provider.provider}: ${(provider.successRate * 100).toFixed(
            2
          )}% success, ${(provider.avgDuration / 1000).toFixed(2)}s avg`
        );
      });
    }

    console.log(
      `  Memory Usage: ${(summary.memoryUsage.heapUsed / 1024 / 1024).toFixed(
        2
      )}MB heap`
    );
  }

  clearHistory(): void {
    this.metrics = [];
    this.aggregateByProvider.clear();
    this.aggregateByOperation.clear();
  }
}

export class PerformanceTracker {
  private monitor: PerformanceMonitor;
  private operationName: string;
  private provider?: string;
  private model?: string;
  private startTime: number;
  private startMemory: NodeJS.MemoryUsage;
  private retryAttempts: number = 0;

  constructor(
    monitor: PerformanceMonitor,
    operationName: string,
    provider?: string,
    model?: string
  ) {
    this.monitor = monitor;
    this.operationName = operationName;
    this.provider = provider;
    this.model = model;
    this.startTime = Date.now();
    this.startMemory = process.memoryUsage();
  }

  setRetryAttempts(attempts: number): void {
    this.retryAttempts = attempts;
  }

  finish(success: boolean, error?: string): void {
    const endTime = Date.now();
    const endMemory = process.memoryUsage();

    const metric: PerformanceMetrics = {
      operationName: this.operationName,
      provider: this.provider,
      model: this.model,
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime,
      success,
      error,
      memoryUsage: endMemory,
      retryAttempts: this.retryAttempts,
      timestamp: new Date(),
    };

    this.monitor.recordMetric(metric);
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Performance monitoring decorator for async functions
export function monitored(operationName: string, provider?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracker = performanceMonitor.startOperation(
        operationName,
        provider
      );

      try {
        const result = await originalMethod.apply(this, args);
        tracker.finish(true);
        return result;
      } catch (error) {
        tracker.finish(
          false,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    };

    return descriptor;
  };
}

// Utility to log memory usage at regular intervals
export function startMemoryMonitoring(
  intervalMs: number = 60000
): NodeJS.Timeout {
  return setInterval(() => {
    const usage = process.memoryUsage();

    // Log if memory usage is high
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 512) {
      // > 512MB
      console.warn(`🧠 High memory usage: ${heapUsedMB.toFixed(2)}MB heap`);
    }

    // Log memory stats periodically
    console.log(
      `📊 Memory: ${heapUsedMB.toFixed(2)}MB heap, ${(
        usage.external /
        1024 /
        1024
      ).toFixed(2)}MB external`
    );
  }, intervalMs);
}
