import { v4 as uuidv4 } from "uuid";
import { join, resolve, isAbsolute } from "path";
import {
  ThinkingValidationRequest,
  ThinkingValidationResponse,
  ImpactAnalysisRequest,
  ImpactAnalysisResponse,
  AssumptionCheckerRequest,
  AssumptionCheckerResponse,
  DependencyMapperRequest,
  DependencyMapperResponse,
  ThinkingOptimizerRequest,
  ThinkingOptimizerResponse,
  ProjectContext,
  ValidationProjectContext,
  ValidationSession,
  ValidationAttempt,
} from "../types/thinking-validation-types.js";
import {
  generateTextService,
  generateObjectService,
} from "../unified-ai-service.js";
import { ThinkingMemorySystem } from "../memory/thinking-memory-system.js";
import {
  THINKING_VALIDATION_PROMPT,
  IMPACT_ANALYSIS_PROMPT,
  ASSUMPTION_CHECKER_PROMPT,
  DEPENDENCY_MAPPER_PROMPT,
  THINKING_OPTIMIZER_PROMPT,
} from "../prompts/thinking-validation-prompts.js";
import {
  AthenaProtocolConfig,
  isProviderConfigured,
  StandardError,
  ErrorCategory,
  getBestAvailableProvider,
} from "../config-manager.js";

import { ToolCallingService } from "../services/tool-calling-service.js";
import {
  createToolRegistry,
  ToolRegistry,
} from "../internal-tools/tool-registry.js";

export class ThinkingValidator {
  private memorySystem: ThinkingMemorySystem;
  private activeSessions: Map<string, ValidationSession> = new Map();
  private toolCallingService?: ToolCallingService;
  private toolRegistry: ToolRegistry;

  constructor() {
    this.memorySystem = new ThinkingMemorySystem();
    this.toolRegistry = createToolRegistry();
  }

  setToolCallingService(service: ToolCallingService): void {
    this.toolCallingService = service;
  }

  async validateThinkingWithTools(
    request: ThinkingValidationRequest,
    sessionId?: string,
    provider?: string
  ): Promise<ThinkingValidationResponse> {
    // This method combines thinking validation with tool-based analysis
    // For now, it's the same as validateThinking since we already integrated tool calling
    return this.validateThinking(request, sessionId, provider);
  }

  /**
   * Validate provider override before API call
   */
  private validateProviderOverride(providerOverride?: string): void {
    if (providerOverride && !isProviderConfigured(providerOverride)) {
      throw new StandardError({
        message: `Provider override failed: ${providerOverride} is not properly configured`,
        category: ErrorCategory.CONFIGURATION,
        provider: providerOverride,
        troubleshooting: `Check that ${providerOverride.toUpperCase()}_API_KEY contains a valid API key in your .env file`,
      });
    }
  }

  async initialize(llmConfig: AthenaProtocolConfig): Promise<void> {
    // The unified-ai-service handles provider configuration automatically
    // No need for explicit connector initialization
    // Initialization complete (logging suppressed to prevent stdout contamination)
  }

  async validateThinking(
    request: ThinkingValidationRequest,
    sessionId?: string,
    provider?: string
  ): Promise<ThinkingValidationResponse> {
    const session = await this.getOrCreateSession(sessionId, {
      sessionId: sessionId || uuidv4(),
      techStack: request.context.techStack,
      problem: request.context.problem,
      constraints: request.context.constraints,
    });

    // Analyze project files if project context is provided
    let projectAnalysis = "";
    let fileAnalysisPerformed = false;
    let filesAnalyzed = 0;
    let toolsUsed: string[] = [];
    if (request.projectContext && this.toolCallingService) {
      try {
        const analysisResult = await this.analyzeProjectFiles(
          request.projectContext
        );
        projectAnalysis = analysisResult.content;
        fileAnalysisPerformed = analysisResult.fileAnalysisPerformed;
        filesAnalyzed = analysisResult.filesAnalyzed;
        toolsUsed = analysisResult.toolsUsed;
      } catch (error) {
        // Suppress logging to prevent stdout contamination
        projectAnalysis =
          "Project file analysis failed, proceeding with limited context.";
        fileAnalysisPerformed = false;
        filesAnalyzed = 0;
        toolsUsed = [];
      }
    }

    const prompt = this.buildThinkingValidationPrompt(request, projectAnalysis);

    try {
      // Validate provider override before API call
      this.validateProviderOverride(provider);

      const response = await generateTextService({
        systemPrompt: THINKING_VALIDATION_PROMPT,
        prompt: prompt,
        providerOverride: provider,
      });

      const validationResult: ThinkingValidationResponse =
        this.parseThinkingValidationResponse(response);

      // Add provider metadata
      const actualProviderUsed = provider || getBestAvailableProvider();
      validationResult.metadata = {
        providerUsed: actualProviderUsed || undefined,
        overrideRequested: !!provider,
        overrideSuccessful: provider ? isProviderConfigured(provider) : true,
        fileAnalysisPerformed,
        filesAnalyzed,
        toolsUsed,
      };

      // Store in memory
      const attempt: ValidationAttempt = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        tool: "thinking_validation",
        request,
        response: validationResult,
        confidence: validationResult.validation.confidence,
      };

      session.validationHistory.push(attempt);
      this.activeSessions.set(session.id, session);

      // Persist the validation attempt to memory system
      await this.memorySystem.addValidationAttempt(
        session.id,
        "thinking_validation",
        request,
        validationResult,
        validationResult.validation.confidence
      );

      return validationResult;
    } catch (error) {
      // Suppress error logging to prevent stdout contamination
      throw new Error(
        `Failed to validate thinking: ${(error as Error).message}`
      );
    }
  }

  async analyzeImpact(
    request: ImpactAnalysisRequest,
    sessionId?: string,
    provider?: string
  ): Promise<ImpactAnalysisResponse> {
    const session = await this.getOrCreateSession(sessionId, {
      sessionId: sessionId || uuidv4(),
      problem: request.change.description,
      architecture: request.systemContext.architecture,
      keyDependencies: request.systemContext.keyDependencies,
      files: request.change.files,
      changeDescription: request.change.description,
    });

    // Analyze project files if project context is provided
    let projectAnalysis = "";
    let fileAnalysisPerformed = false;
    let filesAnalyzed = 0;
    let toolsUsed: string[] = [];
    if (request.projectContext && this.toolCallingService) {
      try {
        const analysisResult = await this.analyzeProjectFiles(
          request.projectContext
        );
        projectAnalysis = analysisResult.content;
        fileAnalysisPerformed = analysisResult.fileAnalysisPerformed;
        filesAnalyzed = analysisResult.filesAnalyzed;
        toolsUsed = analysisResult.toolsUsed;
      } catch (error) {
        // Suppress logging to prevent stdout contamination
        projectAnalysis =
          "Project file analysis failed, proceeding with limited context.";
        fileAnalysisPerformed = false;
        filesAnalyzed = 0;
        toolsUsed = [];
      }
    }

    const prompt = this.buildImpactAnalysisPrompt(request, projectAnalysis);

    try {
      // Validate provider override before API call
      this.validateProviderOverride(provider);

      const response = await generateTextService({
        systemPrompt: IMPACT_ANALYSIS_PROMPT,
        prompt: prompt,
        providerOverride: provider,
      });

      const impactResult: ImpactAnalysisResponse =
        this.parseImpactAnalysisResponse(response);

      // Add provider metadata
      const actualProviderUsed = provider || getBestAvailableProvider();
      impactResult.metadata = {
        providerUsed: actualProviderUsed || undefined,
        overrideRequested: !!provider,
        overrideSuccessful: provider ? isProviderConfigured(provider) : true,
        fileAnalysisPerformed,
        filesAnalyzed,
        toolsUsed,
      };

      // Store in memory
      const attempt: ValidationAttempt = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        tool: "impact_analysis",
        request,
        response: impactResult,
        confidence: 90, // Default confidence for impact analysis
      };

      session.validationHistory.push(attempt);
      this.activeSessions.set(session.id, session);

      // Persist the validation attempt to memory system
      await this.memorySystem.addValidationAttempt(
        session.id,
        "impact_analysis",
        request,
        impactResult,
        90
      );

      return impactResult;
    } catch (error) {
      // Suppress error logging to prevent stdout contamination
      throw new Error(`Failed to analyze impact: ${(error as Error).message}`);
    }
  }

  async checkAssumptions(
    request: AssumptionCheckerRequest,
    sessionId?: string,
    provider?: string
  ): Promise<AssumptionCheckerResponse> {
    // Analyze project files if project context is provided
    let projectAnalysis = "";
    let fileAnalysisPerformed = false;
    let filesAnalyzed = 0;
    let toolsUsed: string[] = [];
    if (request.projectContext && this.toolCallingService) {
      try {
        const analysisResult = await this.analyzeProjectFiles(
          request.projectContext
        );
        projectAnalysis = analysisResult.content;
        fileAnalysisPerformed = analysisResult.fileAnalysisPerformed;
        filesAnalyzed = analysisResult.filesAnalyzed;
        toolsUsed = analysisResult.toolsUsed;
      } catch (error) {
        // Suppress logging to prevent stdout contamination
        projectAnalysis =
          "Project file analysis failed, proceeding with limited context.";
        fileAnalysisPerformed = false;
        filesAnalyzed = 0;
        toolsUsed = [];
      }
    }

    const prompt = this.buildAssumptionCheckerPrompt(request, projectAnalysis);
    const session = await this.getOrCreateSession(sessionId, {
      sessionId: sessionId || uuidv4(),
      problem: request.context.component,
      component: request.context.component,
      environment: request.context.environment,
    });

    try {
      // Validate provider override before API call
      this.validateProviderOverride(provider);

      const response = await generateTextService({
        systemPrompt: ASSUMPTION_CHECKER_PROMPT,
        prompt: prompt,
        providerOverride: provider,
      });

      const assumptionResult: AssumptionCheckerResponse =
        this.parseAssumptionCheckerResponse(response);

      // Add provider metadata
      const actualProviderUsed = provider || getBestAvailableProvider();
      assumptionResult.metadata = {
        providerUsed: actualProviderUsed || undefined,
        overrideRequested: !!provider,
        overrideSuccessful: provider ? isProviderConfigured(provider) : true,
        fileAnalysisPerformed,
        filesAnalyzed,
        toolsUsed,
      };

      // Store in memory
      const attempt: ValidationAttempt = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        tool: "assumption_checker",
        request,
        response: assumptionResult,
        confidence: 85, // Default confidence for assumption checking
      };

      session.validationHistory.push(attempt);
      this.activeSessions.set(session.id, session);

      // Persist the validation attempt to memory system
      await this.memorySystem.addValidationAttempt(
        session.id,
        "assumption_checker",
        request,
        assumptionResult,
        85
      );

      return assumptionResult;
    } catch (error) {
      // Suppress error logging to prevent stdout contamination
      throw new Error(
        `Failed to check assumptions: ${(error as Error).message}`
      );
    }
  }

  async mapDependencies(
    request: DependencyMapperRequest,
    sessionId?: string,
    provider?: string
  ): Promise<DependencyMapperResponse> {
    // Analyze project files if project context is provided
    let projectAnalysis = "";
    let fileAnalysisPerformed = false;
    let filesAnalyzed = 0;
    let toolsUsed: string[] = [];
    if (request.projectContext && this.toolCallingService) {
      try {
        const analysisResult = await this.analyzeProjectFiles(
          request.projectContext
        );
        projectAnalysis = analysisResult.content;
        fileAnalysisPerformed = analysisResult.fileAnalysisPerformed;
        filesAnalyzed = analysisResult.filesAnalyzed;
        toolsUsed = analysisResult.toolsUsed;
      } catch (error) {
        // Suppress logging to prevent stdout contamination
        projectAnalysis =
          "Project file analysis failed, proceeding with limited context.";
        fileAnalysisPerformed = false;
        filesAnalyzed = 0;
        toolsUsed = [];
      }
    }

    const prompt = this.buildDependencyMapperPrompt(request, projectAnalysis);
    const session = await this.getOrCreateSession(sessionId, {
      sessionId: sessionId || uuidv4(),
      problem: request.change.description,
      files: request.change.files,
      component: request.change.components?.[0],
      changeDescription: request.change.description,
    });

    try {
      // Validate provider override before API call
      this.validateProviderOverride(provider);

      const response = await generateTextService({
        systemPrompt: DEPENDENCY_MAPPER_PROMPT,
        prompt: prompt,
        providerOverride: provider,
      });

      const dependencyResult: DependencyMapperResponse =
        this.parseDependencyMapperResponse(response);

      // Add provider metadata
      const actualProviderUsed = provider || getBestAvailableProvider();
      dependencyResult.metadata = {
        providerUsed: actualProviderUsed || undefined,
        overrideRequested: !!provider,
        overrideSuccessful: provider ? isProviderConfigured(provider) : true,
        fileAnalysisPerformed,
        filesAnalyzed,
        toolsUsed,
      };

      // Store in memory
      const attempt: ValidationAttempt = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        tool: "dependency_mapper",
        request,
        response: dependencyResult,
        confidence: 80, // Default confidence for dependency mapping
      };

      session.validationHistory.push(attempt);
      this.activeSessions.set(session.id, session);

      // Persist the validation attempt to memory system
      await this.memorySystem.addValidationAttempt(
        session.id,
        "dependency_mapper",
        request,
        dependencyResult,
        80
      );

      return dependencyResult;
    } catch (error) {
      // Suppress error logging to prevent stdout contamination
      throw new Error(
        `Failed to map dependencies: ${(error as Error).message}`
      );
    }
  }

  async optimizeThinking(
    request: ThinkingOptimizerRequest,
    sessionId?: string,
    provider?: string
  ): Promise<ThinkingOptimizerResponse> {
    // Analyze project files if project context is provided
    let projectAnalysis = "";
    let fileAnalysisPerformed = false;
    let filesAnalyzed = 0;
    let toolsUsed: string[] = [];
    if (request.projectContext && this.toolCallingService) {
      try {
        const analysisResult = await this.analyzeProjectFiles(
          request.projectContext
        );
        projectAnalysis = analysisResult.content;
        fileAnalysisPerformed = analysisResult.fileAnalysisPerformed;
        filesAnalyzed = analysisResult.filesAnalyzed;
        toolsUsed = analysisResult.toolsUsed;
      } catch (error) {
        // Suppress logging to prevent stdout contamination
        projectAnalysis =
          "Project file analysis failed, proceeding with limited context.";
        fileAnalysisPerformed = false;
        filesAnalyzed = 0;
        toolsUsed = [];
      }
    }

    const prompt = this.buildThinkingOptimizerPrompt(request, projectAnalysis);
    const session = await this.getOrCreateSession(sessionId, {
      sessionId: sessionId || uuidv4(),
      problem: request.currentApproach,
      problemType: request.problemType,
      complexity: request.complexity,
      timeConstraint: request.timeConstraint,
      currentApproach: request.currentApproach,
    });

    try {
      // Validate provider override before API call
      this.validateProviderOverride(provider);

      const response = await generateTextService({
        systemPrompt: THINKING_OPTIMIZER_PROMPT,
        prompt: prompt,
        providerOverride: provider,
      });

      const optimizationResult: ThinkingOptimizerResponse =
        this.parseThinkingOptimizerResponse(response);

      // Add provider metadata
      const actualProviderUsed = provider || getBestAvailableProvider();
      optimizationResult.metadata = {
        providerUsed: actualProviderUsed || undefined,
        overrideRequested: !!provider,
        overrideSuccessful: provider ? isProviderConfigured(provider) : true,
        fileAnalysisPerformed,
        filesAnalyzed,
        toolsUsed,
      };

      // Store in memory
      const attempt: ValidationAttempt = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        tool: "thinking_optimizer",
        request,
        response: optimizationResult,
        confidence: optimizationResult.optimizedStrategy.successProbability,
      };

      session.validationHistory.push(attempt);
      this.activeSessions.set(session.id, session);

      // Persist the validation attempt to memory system
      await this.memorySystem.addValidationAttempt(
        session.id,
        "thinking_optimizer",
        request,
        optimizationResult,
        optimizationResult.optimizedStrategy.successProbability
      );

      return optimizationResult;
    } catch (error) {
      // Suppress error logging to prevent stdout contamination
      throw new Error(
        `Failed to optimize thinking: ${(error as Error).message}`
      );
    }
  }

  private async analyzeProjectFiles(projectContext: ProjectContext): Promise<{
    content: string;
    fileAnalysisPerformed: boolean;
    filesAnalyzed: number;
    toolsUsed: string[];
  }> {
    if (!this.toolCallingService) {
      throw new Error("Tool calling service not available");
    }

    const { projectRoot, filesToAnalyze, workingDirectory, analysisTargets } = projectContext;
    
    // NEW: Check if client provides targeted analysis
    if (analysisTargets && analysisTargets.length > 0) {
      return await this.analyzeTargetedSections(
        analysisTargets,
        projectRoot,
        workingDirectory
      );
    }

    // FALLBACK: Use enhanced generic analysis with filesToAnalyze
    const analysis: string[] = [];
    let filesAnalyzed = 0;
    const toolsUsed: string[] = [];

    // Analyze key files using CONCURRENT reading with modes
    if (filesToAnalyze && filesToAnalyze.length > 0) {
      analysis.push("## Key Files Analysis");
      analysis.push(
        "*(Analysis performed using concurrent file reading for efficiency)*"
      );

      // ENHANCED: Prepare concurrent read requests with head mode (first 100 lines)
      const fileRequests = filesToAnalyze.map((filePath) => ({
        path: isAbsolute(filePath)
          ? filePath
          : workingDirectory
            ? resolve(workingDirectory, filePath)
            : resolve(projectRoot, filePath),
        mode: "head" as const,
        lines: 100, // Read first 100 lines for overview
      }));

      // CONCURRENT reading (much faster than sequential)
      const readResults = await this.toolCallingService.readMultipleFiles(fileRequests);
      toolsUsed.push("readMultipleFiles");

      if (readResults.success) {
        filesAnalyzed = readResults.results.filter((r) => r.content).length;

        for (let i = 0; i < filesToAnalyze.length; i++) {
          const filePath = filesToAnalyze[i];
          const result = readResults.results[i];

          analysis.push(`### ${filePath}`);

          if (result.content) {
            const lines = result.content.split("\n");
            analysis.push("**File Content (first 100 lines):**");
            analysis.push("```");
            analysis.push(result.content);
            analysis.push("```");

            if (lines.length >= 100) {
              analysis.push(`*(File has more content, showing first 100 lines)*`);
            }
          } else {
            analysis.push(`Failed to read file: ${result.error}`);
          }
        }
      } else {
        analysis.push(`Failed to read files: ${readResults.error}`);
      }

      // LEGACY: Still use grep for pattern discovery (keeping for backward compat)
      for (const filePath of filesToAnalyze) {
        try {
          // Properly handle both absolute and relative paths
          let fullPath: string;
          if (isAbsolute(filePath)) {
            // File path is already absolute, use it directly
            fullPath = filePath;
          } else {
            // File path is relative, resolve relative to workingDirectory or projectRoot
            fullPath = workingDirectory
              ? resolve(workingDirectory, filePath)
              : resolve(projectRoot, filePath);
          }

          analysis.push(`### ${filePath}`);

          // GREP-FIRST: Search for key patterns to understand file structure
          const grepPatterns = [
            "function|const|class|export|import",
            "component|Component|render|return",
            "error|catch|try|throw",
            "async|await|promise|Promise",
          ];

          let fileContent = "";
          let grepResults: string[] = [];

          for (const pattern of grepPatterns) {
            try {
              const grepResult = await this.toolCallingService.grep(
                pattern,
                fullPath
              );
              if (grepResult.success && grepResult.matches) {
                grepResults.push(
                  `${pattern}: ${grepResult.matches.length} matches`
                );
                // Add a few key matches to analysis
                const keyMatches = grepResult.matches
                  .slice(0, 3)
                  .map((m) => `Line ${m.line}: ${m.content}`);
                if (keyMatches.length > 0) {
                  grepResults.push(...keyMatches);
                }
              }
            } catch (error) {
              // Continue with other patterns
            }
          }

          if (grepResults.length > 0) {
            analysis.push("**Key Patterns Found:**");
            analysis.push("```");
            analysis.push(grepResults.join("\n"));
            analysis.push("```");
            toolsUsed.push("grep");
          }

          // TARGETED READ: Read specific sections based on grep findings
          const result = await this.toolCallingService.readFile(fullPath);
          toolsUsed.push("readFile");
          if (result.success && result.content) {
            filesAnalyzed++;
            const lines = result.content.split("\n");

            // Read first 50 lines (imports/exports/setup)
            analysis.push("**File Content (first 50 lines):**");
            analysis.push("```");
            analysis.push(lines.slice(0, 50).join("\n"));
            analysis.push("```");

            // If file is larger, show targeted sections around key patterns
            if (lines.length > 100) {
              // Try to find main function/component definitions
              const mainFunctionStart = lines.findIndex((line) =>
                /^\s*(function|const|class|export)/.test(line)
              );

              if (mainFunctionStart >= 0) {
                const endLine = Math.min(mainFunctionStart + 30, lines.length);
                analysis.push(
                  `**Main Implementation (lines ${
                    mainFunctionStart + 1
                  }-${endLine}):**`
                );
                analysis.push("```");
                analysis.push(
                  lines.slice(mainFunctionStart, endLine).join("\n")
                );
                analysis.push("```");
              }

              analysis.push(
                `*(File has ${lines.length} total lines, showing targeted sections)*`
              );
            }
          } else {
            analysis.push(`Failed to read file: ${result.error}`);
          }
        } catch (error) {
          analysis.push(`Error analyzing file: ${(error as Error).message}`);
        }
      }
    }

    // Get project structure overview
    try {
      analysis.push("\n## Project Structure");
      const listResult = await this.toolCallingService.listFiles(
        projectRoot,
        false
      );
      toolsUsed.push("listFiles");
      if (listResult.success && listResult.files) {
        const fileNames = listResult.files.map((file) =>
          file.replace(projectRoot + "/", "").replace(projectRoot + "\\", "")
        );
        analysis.push(`Root directory contains ${fileNames.length} files:`);
        analysis.push(fileNames.slice(0, 20).join(", "));
        if (fileNames.length > 20) {
          analysis.push(`... and ${fileNames.length - 20} more files`);
        }
      }
    } catch (error) {
      analysis.push("Failed to analyze project structure");
    }

    return {
      content: analysis.join("\n"),
      fileAnalysisPerformed: filesAnalyzed > 0,
      filesAnalyzed,
      toolsUsed: [...new Set(toolsUsed)], // Remove duplicates
    };
  }

  private buildThinkingValidationPrompt(
    request: ThinkingValidationRequest,
    projectAnalysis: string = ""
  ): string {
    return `Analyze this thinking and proposed change:

Thinking: ${request.thinking}

Proposed Change:
Description: ${request.proposedChange.description}
${request.proposedChange.code ? `Code: ${request.proposedChange.code}` : ""}
${
  request.proposedChange.files
    ? `Files: ${request.proposedChange.files.join(", ")}`
    : ""
}

Context:
Problem: ${request.context.problem}
Tech Stack: ${request.context.techStack}
${
  request.context.constraints
    ? `Constraints: ${request.context.constraints.join(", ")}`
    : ""
}

Urgency: ${request.urgency}

${
  projectAnalysis ? `Project Analysis:\n${projectAnalysis}\n\n` : ""
}Provide your validation in the specified JSON format.`;
  }

  private buildImpactAnalysisPrompt(
    request: ImpactAnalysisRequest,
    projectAnalysis: string = ""
  ): string {
    return `Analyze the impact of this change:

Change:
Description: ${request.change.description}
${request.change.code ? `Code: ${request.change.code}` : ""}
${request.change.files ? `Files: ${request.change.files.join(", ")}` : ""}

System Context:
${
  request.systemContext.architecture
    ? `Architecture: ${request.systemContext.architecture}`
    : ""
}
${
  request.systemContext.keyDependencies
    ? `Key Dependencies: ${request.systemContext.keyDependencies.join(", ")}`
    : ""
}

${
  projectAnalysis ? `Project Analysis:\n${projectAnalysis}\n\n` : ""
}Provide your impact analysis in the specified JSON format.`;
  }

  private buildAssumptionCheckerPrompt(
    request: AssumptionCheckerRequest,
    projectAnalysis: string = ""
  ): string {
    return `Check these assumptions:

Assumptions:
${request.assumptions
  .map((assumption, i) => `${i + 1}. ${assumption}`)
  .join("\n")}

Context:
Component: ${request.context.component}
Environment: ${request.context.environment}

${
  projectAnalysis ? `Project Analysis:\n${projectAnalysis}\n\n` : ""
}Provide your assumption validation in the specified JSON format.`;
  }

  private buildDependencyMapperPrompt(
    request: DependencyMapperRequest,
    projectAnalysis: string = ""
  ): string {
    return `Map dependencies for this change:

Change:
Description: ${request.change.description}
${request.change.files ? `Files: ${request.change.files.join(", ")}` : ""}
${
  request.change.components
    ? `Components: ${request.change.components.join(", ")}`
    : ""
}

${
  projectAnalysis ? `Project Analysis:\n${projectAnalysis}\n\n` : ""
}Provide your dependency mapping in the specified JSON format.`;
  }

  private buildThinkingOptimizerPrompt(
    request: ThinkingOptimizerRequest,
    projectAnalysis: string = ""
  ): string {
    return `Optimize thinking for this approach:

Problem Type: ${request.problemType}
Complexity: ${request.complexity}
Time Constraint: ${request.timeConstraint}
Current Approach: ${request.currentApproach}

${
  projectAnalysis ? `Project Analysis:\n${projectAnalysis}\n\n` : ""
}Provide your thinking optimization in the specified JSON format.`;
  }

  private parseThinkingValidationResponse(
    response: string
  ): ThinkingValidationResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("No valid JSON found in response");
    } catch (error) {
      // Suppress error logging to prevent stdout contamination
      // Return a default response
      return {
        validation: {
          confidence: 50,
          goAhead: false,
          criticalIssues: [],
          recommendations: ["Unable to parse response, please try again"],
          testCases: [],
        },
      };
    }
  }

  private parseImpactAnalysisResponse(
    response: string
  ): ImpactAnalysisResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("No valid JSON found in response");
    } catch (error) {
      // Suppress error logging to prevent stdout contamination
      // Return a default response
      return {
        impacts: {
          overallRisk: "medium",
          affectedAreas: [],
          cascadingRisks: [],
          quickTests: ["Unable to parse response, please try again"],
        },
      };
    }
  }

  private parseAssumptionCheckerResponse(
    response: string
  ): AssumptionCheckerResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("No valid JSON found in response");
    } catch (error) {
      // Suppress error logging to prevent stdout contamination
      // Return a default response
      return {
        validation: {
          validAssumptions: [],
          riskyAssumptions: [],
          quickVerifications: ["Unable to parse response, please try again"],
        },
      };
    }
  }

  private parseDependencyMapperResponse(
    response: string
  ): DependencyMapperResponse {
    try {
      // Debug logging suppressed to prevent stdout contamination
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("No valid JSON found in response");
    } catch (error) {
      // Suppress error logging to prevent stdout contamination
      // Return a default response
      return {
        dependencies: {
          critical: [],
          secondary: [],
          testFocus: ["Unable to parse response, please try again"],
        },
      };
    }
  }

  private parseThinkingOptimizerResponse(
    response: string
  ): ThinkingOptimizerResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("No valid JSON found in response");
    } catch (error) {
      // Suppress error logging to prevent stdout contamination
      // Return a default response
      return {
        optimizedStrategy: {
          approach: "Unable to parse response",
          toolsToUse: [],
          timeAllocation: {
            thinking: "30%",
            implementation: "60%",
            testing: "10%",
          },
          successProbability: 50,
          keyFocus: "Please try again",
        },
      };
    }
  }

  private async getOrCreateSession(
    sessionId: string | undefined,
    context: Partial<ValidationProjectContext>
  ): Promise<ValidationSession> {
    const id = sessionId || uuidv4();
    let session = this.activeSessions.get(id);

    if (!session) {
      // Try to load from persistent storage first
      session = await this.memorySystem.getSession(id);

      if (!session) {
        // Create a complete ValidationProjectContext with required fields
        const completeContext: ValidationProjectContext = {
          sessionId: context.sessionId || id,
          techStack: context.techStack || "",
          problem: context.problem || "",
          constraints: context.constraints,
          component: context.component,
          environment: context.environment,
          architecture: context.architecture,
          keyDependencies: context.keyDependencies,
          files: context.files,
          changeDescription: context.changeDescription,
          currentApproach: context.currentApproach,
          problemType: context.problemType,
          complexity: context.complexity,
          timeConstraint: context.timeConstraint,
        };

        session = {
          id,
          timestamp: new Date().toISOString(),
          context: completeContext,
          validationHistory: [],
        };

        // Create and save the new session to persistent storage
        await this.memorySystem.createSession(completeContext);
      }

      this.activeSessions.set(id, session);
    }

    return session;
  }

  async getSession(sessionId: string): Promise<ValidationSession | null> {
    // First check active sessions
    let session = this.activeSessions.get(sessionId);

    // If not found in active sessions, try to load from memory system
    if (!session) {
      session = await this.memorySystem.getSession(sessionId);
      if (session) {
        this.activeSessions.set(sessionId, session);
      }
    }

    return session || null;
  }

  async listSessions(): Promise<{ id: string; timestamp: string }[]> {
    // Get sessions from memory system
    const persistentData = await this.memorySystem["loadPersistentStorage"]();
    return Object.keys(persistentData).map((sessionId) => ({
      id: sessionId,
      timestamp:
        persistentData[sessionId].timestamp ||
        persistentData[sessionId].lastUpdated ||
        new Date().toISOString(),
    }));
  }

  /**
   * NEW: Analyze targeted sections specified by the client
   * This is the smart client implementation - client specifies exact sections
   */
  private async analyzeTargetedSections(
    targets: import("../types/thinking-validation-types.js").AnalysisTarget[],
    projectRoot: string,
    workingDirectory?: string
  ): Promise<{
    content: string;
    fileAnalysisPerformed: boolean;
    filesAnalyzed: number;
    toolsUsed: string[];
  }> {
    const analysis: string[] = [];
    const filesProcessed = new Set<string>();
    const toolsUsed = ["readMultipleFiles"];

    analysis.push("## Targeted Code Analysis");
    analysis.push("*(Client-specified code sections with mode support)*\n");

    // Group targets by priority
    const criticalTargets = targets.filter((t) => t.priority === "critical");
    const importantTargets = targets.filter(
      (t) => t.priority === "important" || !t.priority
    );
    const supplementaryTargets = targets.filter(
      (t) => t.priority === "supplementary"
    );

    // Process in priority order
    for (const targetGroup of [
      criticalTargets,
      importantTargets,
      supplementaryTargets,
    ]) {
      if (targetGroup.length === 0) continue;

      // Convert to read requests
      const fileRequests = targetGroup.map((target) => {
        const fullPath = isAbsolute(target.file)
          ? target.file
          : workingDirectory
            ? resolve(workingDirectory, target.file)
            : resolve(projectRoot, target.file);

        return {
          path: fullPath,
          mode: target.mode || "range",
          lines: target.lines,
          startLine: target.startLine,
          endLine: target.endLine,
        };
      });

      // Read all files in this priority group concurrently
      const readResults = await this.toolCallingService!.readMultipleFiles(
        fileRequests
      );

      if (readResults.success) {
        for (let i = 0; i < targetGroup.length; i++) {
          const target = targetGroup[i];
          const result = readResults.results[i];

          filesProcessed.add(target.file);

          // Format section header
          const priorityLabel =
            target.priority === "critical" ? " [CRITICAL]" : "";

          analysis.push(`### ${target.file}${priorityLabel}`);

          if (target.mode || target.startLine) {
            const modeInfo = target.mode
              ? `Mode: ${target.mode}${target.lines ? ` (${target.lines} lines)` : ""
              }`
              : `Lines ${target.startLine}-${target.endLine}`;
            analysis.push(`**${modeInfo}**`);
          }

          if (result.content) {
            analysis.push("```");
            analysis.push(result.content);
            analysis.push("```\n");
          } else {
            analysis.push(`Failed to read section: ${result.error}\n`);
          }
        }
      }
    }

    return {
      content: analysis.join("\n"),
      fileAnalysisPerformed: true,
      filesAnalyzed: filesProcessed.size,
      toolsUsed,
    };
  }
}
