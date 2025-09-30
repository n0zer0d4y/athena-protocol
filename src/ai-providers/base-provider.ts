import {
  generateText,
  generateObject,
  streamText,
  streamObject,
  zodSchema,
  JSONParseError,
  NoObjectGeneratedError,
} from "ai";
import { jsonrepair } from "jsonrepair";

/**
 * Base class for all AI providers
 */
export abstract class BaseAIProvider {
  protected name: string;

  constructor() {
    if (this.constructor === BaseAIProvider) {
      throw new Error("BaseAIProvider cannot be instantiated directly");
    }

    // Each provider must set their name
    this.name = this.constructor.name;
  }

  /**
   * Validates authentication parameters - can be overridden by providers
   * @param params - Parameters to validate
   */
  validateAuth(params: any) {
    // Default: require API key (most providers need this)
    if (!params.apiKey) {
      throw new Error(`${this.name} API key is required`);
    }
  }

  /**
   * Validates common parameters across all methods
   * @param params - Parameters to validate
   */
  validateParams(params: any) {
    // Validate authentication (can be overridden by providers)
    this.validateAuth(params);

    // Validate required model ID
    if (!params.modelId) {
      throw new Error(`${this.name} Model ID is required`);
    }

    // Validate optional parameters
    this.validateOptionalParams(params);
  }

  /**
   * Validates optional parameters like temperature and maxTokens
   * @param params - Parameters to validate
   */
  validateOptionalParams(params: any) {
    if (
      params.temperature !== undefined &&
      (params.temperature < 0 || params.temperature > 1)
    ) {
      throw new Error("Temperature must be between 0 and 1");
    }
    if (params.maxTokens !== undefined) {
      const maxTokens = Number(params.maxTokens);
      if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
        throw new Error("maxTokens must be a finite number greater than 0");
      }
    }
  }

  /**
   * Validates message array structure
   */
  validateMessages(messages: any[]) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Invalid or empty messages array provided");
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        throw new Error(
          "Invalid message format. Each message must have role and content"
        );
      }
    }
  }

  /**
   * Common error handler
   */
  handleError(operation: string, error: Error) {
    console.error(`${this.name} ${operation} failed: ${error.message}`);
    throw new Error(
      `${this.name} API error during ${operation}: ${error.message}`
    );
  }

  /**
   * Creates and returns a client instance for the provider
   * @abstract
   */
  abstract getClient(params: any): any;

  /**
   * Returns if the API key is required
   * @returns if the API key is required, defaults to true
   */
  isRequiredApiKey(): boolean {
    return true;
  }

  /**
   * Returns the required API key environment variable name
   * @returns The environment variable name, or null if no API key is required
   */
  abstract getRequiredApiKeyName(): string | null;

  /**
   * Determines if a model requires max_completion_tokens instead of maxTokens
   * Can be overridden by providers to specify their model requirements
   * @param modelId - The model ID to check
   * @returns True if the model requires max_completion_tokens
   */
  requiresMaxCompletionTokens(modelId: string): boolean {
    return false; // Default behavior - most models use maxTokens
  }

  /**
   * Prepares token limit parameter based on model requirements
   * @param modelId - The model ID
   * @param maxTokens - The maximum tokens value
   * @returns Object with either maxTokens or max_completion_tokens
   */
  prepareTokenParam(modelId: string, maxTokens?: number) {
    if (maxTokens === undefined) {
      return {};
    }

    // Ensure maxTokens is an integer
    const tokenValue = Math.floor(Number(maxTokens));

    if (this.requiresMaxCompletionTokens(modelId)) {
      return { max_completion_tokens: tokenValue };
    } else {
      return { maxTokens: tokenValue };
    }
  }

  /**
   * Generates text using the provider's model
   */
  async generateText(params: any) {
    try {
      this.validateParams(params);
      this.validateMessages(params.messages);

      console.log(`Generating ${this.name} text with model: ${params.modelId}`);

      const client = await this.getClient(params);
      const result = await generateText({
        model: client(params.modelId),
        messages: params.messages,
        ...this.prepareTokenParam(params.modelId, params.maxTokens),
        temperature: params.temperature,
      });

      console.log(
        `${this.name} generateText completed successfully for model: ${params.modelId}`
      );

      return {
        text: result.text,
        usage: result.usage || {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      this.handleError("text generation", error as Error);
    }
  }

  /**
   * Streams text using the provider's model
   */
  async streamText(params: any) {
    try {
      this.validateParams(params);
      this.validateMessages(params.messages);

      console.log(`Streaming ${this.name} text with model: ${params.modelId}`);

      const client = await this.getClient(params);
      const stream = await streamText({
        model: client(params.modelId),
        messages: params.messages,
        ...this.prepareTokenParam(params.modelId, params.maxTokens),
        temperature: params.temperature,
      });

      console.log(
        `${this.name} streamText initiated successfully for model: ${params.modelId}`
      );

      return stream;
    } catch (error) {
      this.handleError("text streaming", error as Error);
    }
  }

  /**
   * Streams a structured object using the provider's model
   */
  async streamObject(params: any) {
    try {
      this.validateParams(params);
      this.validateMessages(params.messages);

      if (!params.schema) {
        throw new Error("Schema is required for object streaming");
      }

      console.log(
        `Streaming ${this.name} object with model: ${params.modelId}`
      );

      const client = await this.getClient(params);
      const result = await streamObject({
        model: client(params.modelId),
        messages: params.messages,
        schema: zodSchema(params.schema),
        mode: params.mode || "auto",
        ...this.prepareTokenParam(params.modelId, params.maxTokens),
        temperature: params.temperature,
      });

      console.log(
        `${this.name} streamObject initiated successfully for model: ${params.modelId}`
      );

      // Return the stream result directly
      // The stream result contains partialObjectStream and other properties
      return result;
    } catch (error) {
      this.handleError("object streaming", error as Error);
    }
  }

  /**
   * Generates a structured object using the provider's model
   */
  async generateObject(params: any) {
    try {
      this.validateParams(params);
      this.validateMessages(params.messages);

      if (!params.schema) {
        throw new Error("Schema is required for object generation");
      }
      if (!params.objectName) {
        throw new Error("Object name is required for object generation");
      }

      console.log(
        `Generating ${this.name} object ('${params.objectName}') with model: ${params.modelId}`
      );

      const client = await this.getClient(params);
      const result = await generateObject({
        model: client(params.modelId),
        messages: params.messages,
        schema: zodSchema(params.schema),
        mode: params.mode || "auto",
        ...this.prepareTokenParam(params.modelId, params.maxTokens),
        temperature: params.temperature,
      });

      console.log(
        `${this.name} generateObject completed successfully for model: ${params.modelId}`
      );

      return {
        object: result.object,
        usage: result.usage || {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      // Check if this is a JSON parsing error that we can potentially fix
      if (
        NoObjectGeneratedError.isInstance(error) &&
        JSONParseError.isInstance(error.cause) &&
        error.cause.text
      ) {
        console.warn(
          `${this.name} generated malformed JSON, attempting to repair...`
        );

        try {
          // Use jsonrepair to fix the malformed JSON
          const repairedJson = jsonrepair(error.cause.text);
          const parsed = JSON.parse(repairedJson);

          console.log(`Successfully repaired ${this.name} JSON output`);

          // Return in the expected format
          return {
            object: parsed,
            usage: {
              // Extract usage information from the error if available
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            },
          };
        } catch (repairError) {
          console.error(
            `Failed to repair ${this.name} JSON: ${
              (repairError as Error).message
            }`
          );
          // Fall through to handleError with original error
        }
      }

      this.handleError("object generation", error as Error);
    }
  }
}
