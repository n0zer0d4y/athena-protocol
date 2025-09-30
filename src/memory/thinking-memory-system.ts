import { v4 as uuidv4 } from "uuid";
import {
  ValidationSession,
  ValidationProjectContext,
  ValidationAttempt,
} from "../types/thinking-validation-types.js";
import * as fs from "fs";
import * as path from "path";

export class ThinkingMemorySystem {
  private shortTermMemory: Map<string, ValidationAttempt[]> = new Map();
  private persistentStoragePath: string;
  private maxShortTermEntries: number = 100;
  private maxPersistentEntries: number = 1000;
  private compressionThreshold: number = 0.7;
  private relevanceThreshold: number = 0.6;

  constructor(storagePath?: string) {
    this.persistentStoragePath =
      storagePath || path.join(process.cwd(), "thinking-memory.json");
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      if (!fs.existsSync(this.persistentStoragePath)) {
        await fs.promises.writeFile(
          this.persistentStoragePath,
          JSON.stringify({})
        );
      }
    } catch (error) {
      console.error("Failed to initialize persistent storage:", error);
      throw new Error(
        `Failed to initialize persistent storage: ${(error as Error).message}`
      );
    }
  }

  // Create or update a validation session
  async createSession(
    context: ValidationProjectContext
  ): Promise<ValidationSession> {
    const sessionId = context.sessionId;
    const session: ValidationSession = {
      id: sessionId,
      timestamp: new Date().toISOString(),
      context,
      validationHistory: [],
    };

    await this.saveSession(session);
    return session;
  }

  // Save session to both short-term and persistent storage
  async saveSession(session: ValidationSession): Promise<void> {
    // Save to short-term memory
    this.shortTermMemory.set(session.id, session.validationHistory);

    // Save to persistent storage
    await this.saveToPersistentStorage(session);
  }

  // Add validation attempt to session
  async addValidationAttempt(
    sessionId: string,
    tool: string,
    request: any,
    response: any,
    confidence: number = 0.5
  ): Promise<string> {
    const attempt: ValidationAttempt = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      tool,
      request,
      response,
      confidence,
    };

    // Add to short-term memory
    if (!this.shortTermMemory.has(sessionId)) {
      this.shortTermMemory.set(sessionId, []);
    }

    const sessionAttempts = this.shortTermMemory.get(sessionId)!;
    sessionAttempts.push(attempt);

    // Maintain short-term memory size limit
    if (sessionAttempts.length > this.maxShortTermEntries) {
      const sortedAttempts = sessionAttempts.sort(
        (a, b) => b.confidence * b.confidence - a.confidence * a.confidence
      );
      this.shortTermMemory.set(
        sessionId,
        sortedAttempts.slice(0, this.maxShortTermEntries)
      );
    }

    // Update persistent storage
    await this.updatePersistentStorage(sessionId, attempt);

    return attempt.id;
  }

  // Retrieve session with validation history
  async getSession(sessionId: string): Promise<ValidationSession | undefined> {
    // Try short-term memory first
    const shortTermAttempts = this.shortTermMemory.get(sessionId);
    if (shortTermAttempts) {
      const session = await this.loadSessionFromPersistentStorage(sessionId);
      if (session) {
        session.validationHistory = shortTermAttempts;
        return session;
      }
    }

    // Fall back to persistent storage
    return await this.loadSessionFromPersistentStorage(sessionId);
  }

  // Get relevant validation attempts for context
  async getRelevantValidationHistory(
    sessionId: string,
    context: ValidationProjectContext,
    limit: number = 10
  ): Promise<ValidationAttempt[]> {
    const session = await this.getSession(sessionId);
    if (!session) return [];

    // Calculate relevance scores for all validation attempts
    const scoredAttempts = session.validationHistory.map((attempt) => ({
      ...attempt,
      confidence: this.calculateRelevanceScore(attempt, context),
    }));

    // Filter by relevance threshold and sort by score
    const relevantAttempts = scoredAttempts
      .filter((attempt) => attempt.confidence >= this.relevanceThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);

    // Update access counts and last accessed time
    relevantAttempts.forEach((attempt) => {
      attempt.confidence += 0.1; // Boost for recent access
    });

    return relevantAttempts;
  }

  // Calculate relevance score for validation attempt
  private calculateRelevanceScore(
    attempt: ValidationAttempt,
    context: ValidationProjectContext
  ): number {
    let score = attempt.confidence;

    // Boost score for recent attempts
    const attemptAge = Date.now() - new Date(attempt.timestamp).getTime();
    const ageInHours = attemptAge / (1000 * 60 * 60);
    score *= Math.max(0.1, 1 - ageInHours / 24); // Decay over 24 hours

    // Boost score based on context similarity
    if (attempt.tool && context.problem) {
      // Simple string similarity for now
      const toolMatch =
        attempt.tool.toLowerCase().includes(context.problem.toLowerCase()) ||
        context.problem.toLowerCase().includes(attempt.tool.toLowerCase());
      if (toolMatch) {
        score += 0.2;
      }
    }

    // Boost score for same tech stack
    if (attempt.request?.context?.techStack && context.techStack) {
      if (attempt.request.context.techStack === context.techStack) {
        score += 0.15;
      }
    }

    return Math.min(1.0, score);
  }

  // Save to persistent storage
  private async saveToPersistentStorage(
    session: ValidationSession
  ): Promise<void> {
    try {
      const persistentData = await this.loadPersistentStorage();
      persistentData[session.id] = {
        id: session.id,
        timestamp: session.timestamp,
        context: session.context,
        validationHistory: session.validationHistory.slice(
          -this.maxPersistentEntries
        ), // Limit persistent entries
        lastUpdated: new Date().toISOString(),
      };

      await fs.promises.writeFile(
        this.persistentStoragePath,
        JSON.stringify(persistentData, null, 2)
      );
    } catch (error) {
      console.error("Failed to save to persistent storage:", error);
      throw new Error(
        `Failed to save to persistent storage: ${(error as Error).message}`
      );
    }
  }

  // Update persistent storage with new attempt
  private async updatePersistentStorage(
    sessionId: string,
    attempt: ValidationAttempt
  ): Promise<void> {
    try {
      const persistentData = await this.loadPersistentStorage();

      // If session doesn't exist, create a minimal structure
      if (!persistentData[sessionId]) {
        persistentData[sessionId] = {
          id: sessionId,
          timestamp: new Date().toISOString(),
          context: {
            sessionId: sessionId,
            techStack: "",
            problem: "",
          },
          validationHistory: [],
          lastUpdated: new Date().toISOString(),
        };
      }

      // Ensure validationHistory exists
      if (!persistentData[sessionId].validationHistory) {
        persistentData[sessionId].validationHistory = [];
      }

      // Add the new attempt
      persistentData[sessionId].validationHistory.push(attempt);
      persistentData[sessionId].lastUpdated = new Date().toISOString();

      // Limit persistent entries
      if (
        persistentData[sessionId].validationHistory.length >
        this.maxPersistentEntries
      ) {
        persistentData[sessionId].validationHistory = persistentData[
          sessionId
        ].validationHistory
          .sort(
            (a: any, b: any) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, this.maxPersistentEntries);
      }

      await fs.promises.writeFile(
        this.persistentStoragePath,
        JSON.stringify(persistentData, null, 2)
      );
    } catch (error) {
      console.error("Failed to update persistent storage:", error);
      throw new Error(
        `Failed to update persistent storage: ${(error as Error).message}`
      );
    }
  }

  // Load session from persistent storage
  private async loadSessionFromPersistentStorage(
    sessionId: string
  ): Promise<ValidationSession | undefined> {
    try {
      const persistentData = await this.loadPersistentStorage();
      const sessionData = persistentData[sessionId] as any;

      if (sessionData) {
        return {
          id: sessionData.id || sessionId,
          timestamp:
            sessionData.timestamp ||
            sessionData.lastUpdated ||
            new Date().toISOString(),
          context: sessionData.context || {
            sessionId: sessionId,
            techStack: "",
            problem: "",
          },
          validationHistory: sessionData.validationHistory || [],
        };
      }
    } catch (error) {
      console.error("Failed to load session from persistent storage:", error);
      throw new Error(
        `Failed to load session from persistent storage: ${
          (error as Error).message
        }`
      );
    }

    return undefined;
  }

  // Load all persistent storage data
  private async loadPersistentStorage(): Promise<any> {
    try {
      if (fs.existsSync(this.persistentStoragePath)) {
        const data = await fs.promises.readFile(
          this.persistentStoragePath,
          "utf-8"
        );
        if (data.trim()) {
          return JSON.parse(data);
        }
      }
    } catch (error) {
      console.error("Failed to load persistent storage:", error);
      throw new Error(
        `Failed to load persistent storage: ${(error as Error).message}`
      );
    }

    return {};
  }

  // Clean up old sessions and memory
  async cleanup(): Promise<void> {
    try {
      const persistentData = await this.loadPersistentStorage();
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      for (const [sessionId, sessionData] of Object.entries(persistentData)) {
        const data = sessionData as any;
        const sessionAge =
          now - new Date(data.lastUpdated || data.timestamp).getTime();

        if (sessionAge > maxAge) {
          delete persistentData[sessionId];
          this.shortTermMemory.delete(sessionId);
        }
      }

      await fs.promises.writeFile(
        this.persistentStoragePath,
        JSON.stringify(persistentData, null, 2)
      );
    } catch (error) {
      console.error("Failed to cleanup persistent storage:", error);
      throw new Error(
        `Failed to cleanup persistent storage: ${(error as Error).message}`
      );
    }
  }

  // Get session statistics
  async getSessionStats(sessionId: string): Promise<any> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    return {
      sessionId,
      validationAttempts: session.validationHistory.length,
      averageConfidence:
        session.validationHistory.length > 0
          ? session.validationHistory.reduce(
              (sum, attempt) => sum + attempt.confidence,
              0
            ) / session.validationHistory.length
          : 0,
      mostConfident:
        session.validationHistory.length > 0
          ? session.validationHistory.sort(
              (a, b) => b.confidence - a.confidence
            )[0]
          : null,
      recentActivity: session.validationHistory.filter((attempt) => {
        const age = Date.now() - new Date(attempt.timestamp).getTime();
        return age < 60 * 60 * 1000; // Last hour
      }).length,
    };
  }
}
