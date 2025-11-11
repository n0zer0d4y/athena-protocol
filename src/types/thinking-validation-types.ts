// Thinking Validation Types for Athena Protocol

/**
 * Analysis target for client-driven targeted analysis
 * Allows clients to specify exact code sections to analyze
 */
export interface AnalysisTarget {
  file: string;
  mode?: "full" | "head" | "tail" | "range";
  lines?: number;
  startLine?: number;
  endLine?: number;
  priority?: "critical" | "important" | "supplementary";
}

export interface ProjectContext {
  projectRoot: string;
  workingDirectory?: string;
  analysisTargets?: AnalysisTarget[];
}

export interface ThinkingValidationRequest {
  thinking: string;
  proposedChange: {
    description: string;
    code?: string;
    files?: string[];
  };
  context: {
    problem: string;
    techStack: string;
    constraints?: string[];
  };
  urgency: "low" | "medium" | "high";
  projectContext?: ProjectContext;
  projectBackground?: string;
}

export interface ThinkingValidationResponse {
  validation: {
    confidence: number;
    goAhead: boolean;
    criticalIssues: {
      issue: string;
      suggestion: string;
      priority: "high" | "medium" | "low";
    }[];
    recommendations: string[];
    testCases: string[];
  };
  metadata?: {
    providerUsed?: string;
    overrideRequested?: boolean;
    overrideSuccessful?: boolean;
    fileAnalysisPerformed?: boolean;
    filesAnalyzed?: number;
    toolsUsed?: string[];
  };
}

export interface ImpactAnalysisRequest {
  change: {
    description: string;
    code?: string;
    files?: string[];
  };
  systemContext: {
    architecture?: string;
    keyDependencies?: string[];
  };
  projectContext?: ProjectContext;
  projectBackground?: string;
}

export interface ImpactAnalysisResponse {
  impacts: {
    overallRisk: "low" | "medium" | "high";
    affectedAreas: {
      area: string;
      impact: string;
      mitigation: string;
    }[];
    cascadingRisks: {
      risk: string;
      probability: "low" | "medium" | "high";
      action: string;
    }[];
    quickTests: string[];
  };
  metadata?: {
    providerUsed?: string;
    overrideRequested?: boolean;
    overrideSuccessful?: boolean;
    fileAnalysisPerformed?: boolean;
    filesAnalyzed?: number;
    toolsUsed?: string[];
  };
}

export interface AssumptionCheckerRequest {
  assumptions: string[];
  context: {
    component: string;
    environment: string;
  };
  projectContext?: ProjectContext;
  projectBackground?: string;
}

export interface AssumptionCheckerResponse {
  validation: {
    validAssumptions: string[];
    riskyAssumptions: {
      assumption: string;
      risk: string;
      mitigation: string;
    }[];
    quickVerifications: string[];
  };
  metadata?: {
    providerUsed?: string;
    overrideRequested?: boolean;
    overrideSuccessful?: boolean;
    fileAnalysisPerformed?: boolean;
    filesAnalyzed?: number;
    toolsUsed?: string[];
  };
}

export interface DependencyMapperRequest {
  change: {
    description: string;
    files?: string[];
    components?: string[];
  };
  projectContext?: ProjectContext;
  projectBackground?: string;
}

export interface DependencyMapperResponse {
  dependencies: {
    critical: {
      dependency: string;
      impact: string;
      action: string;
    }[];
    secondary: {
      dependency: string;
      impact: string;
      action: string;
    }[];
    testFocus: string[];
  };
  metadata?: {
    providerUsed?: string;
    overrideRequested?: boolean;
    overrideSuccessful?: boolean;
    fileAnalysisPerformed?: boolean;
    filesAnalyzed?: number;
    toolsUsed?: string[];
  };
}

export interface ThinkingOptimizerRequest {
  problemType: "bug_fix" | "feature_impl" | "refactor";
  complexity: "simple" | "moderate" | "complex";
  timeConstraint: "tight" | "moderate" | "flexible";
  currentApproach: string;
  projectContext?: ProjectContext;
  projectBackground?: string;
}

export interface ThinkingOptimizerResponse {
  optimizedStrategy: {
    approach: string;
    toolsToUse: string[];
    timeAllocation: {
      thinking: string;
      implementation: string;
      testing: string;
    };
    successProbability: number;
    keyFocus: string;
  };
  tacticalPlan?: {
    classification?: string;
    grepFirst?: string[];
    keyFindingsHypothesis?: string[];
    decisionPoints?: string[];
    implementationSteps?: string[];
    testingPlan?: string[];
    riskMitigation?: string[];
    checkpoints?: string[];
    valueEffortNotes?: string;
  };
  metadata?: {
    providerUsed?: string;
    overrideRequested?: boolean;
    overrideSuccessful?: boolean;
    fileAnalysisPerformed?: boolean;
    filesAnalyzed?: number;
    toolsUsed?: string[];
  };
}

export interface ValidationProjectContext {
  sessionId: string;
  techStack: string;
  problem: string;
  constraints?: string[];
  component?: string;
  environment?: string;
  architecture?: string;
  keyDependencies?: string[];
  files?: string[];
  changeDescription?: string;
  currentApproach?: string;
  problemType?: "bug_fix" | "feature_impl" | "refactor";
  complexity?: "simple" | "moderate" | "complex";
  timeConstraint?: "tight" | "moderate" | "flexible";
}

export interface ValidationSession {
  id: string;
  timestamp: string;
  context: ValidationProjectContext;
  validationHistory: ValidationAttempt[];
}

export interface ValidationAttempt {
  id: string;
  timestamp: string;
  tool: string;
  request: any;
  response: any;
  confidence: number;
}
