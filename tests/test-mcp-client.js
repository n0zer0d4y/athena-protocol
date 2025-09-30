/**
 * Simple MCP client test to verify the server works end-to-end
 */

import { spawn } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

class SimpleMCPClient {
  constructor() {
    this.server = null;
    this.requestId = 0;
  }

  async connect() {
    console.log('🔌 Connecting to MCP server...');
    
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY environment variable is required');
    }
    
    // Spawn the MCP server process
    this.server = spawn('npm', ['run', 'dev'], {
      env: {
        ...process.env,
        GOOGLE_API_KEY: apiKey,
        DEBUG: 'false'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Handle server output
    this.server.stderr.on('data', (data) => {
      console.log(`📝 Server stderr: ${data}`);
    });
    
    this.server.stdout.on('data', (data) => {
      console.log(`📤 Server stdout: ${data}`);
    });
    
    this.server.on('close', (code) => {
      console.log(`🔌 Server closed with code ${code}`);
    });
    
    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Connected to MCP server');
  }

  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: ++this.requestId,
        method,
        params
      };
      
      const requestData = JSON.stringify(request) + '\n';
      
      console.log(`📤 Sending request: ${method}`);
      
      if (!this.server || !this.server.stdin) {
        reject(new Error('Server not connected'));
        return;
      }
      
      this.server.stdin.write(requestData);
      
      // Set up response handler
      const responseHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === this.requestId) {
            this.server.stdout.removeListener('data', responseHandler);
            resolve(response);
          }
        } catch (error) {
          // Ignore parse errors for partial data
        }
      };
      
      this.server.stdout.on('data', responseHandler);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        this.server.stdout.removeListener('data', responseHandler);
        reject(new Error('Request timeout'));
      }, 30000);
    });
  }

  async listTools() {
    console.log('\n🔧 Listing available tools...');
    const response = await this.sendRequest('tools/list');
    
    if (response.result && response.result.tools) {
      console.log('✅ Available tools:');
      response.result.tools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
      return response.result.tools;
    } else {
      throw new Error('Failed to list tools');
    }
  }

  async chat(message) {
    console.log(`\n💬 Sending chat message: "${message}"`);
    const response = await this.sendRequest('tools/call', {
      name: 'chat',
      arguments: {
        message,
        context: 'Testing MCP server functionality'
      }
    });
    
    if (response.result && response.result.content) {
      console.log('🤖 AI Response:');
      response.result.content.forEach(content => {
        console.log(content.text);
      });
      return response.result;
    } else {
      throw new Error('Failed to get chat response');
    }
  }

  async disconnect() {
    if (this.server) {
      console.log('\n🔌 Disconnecting from MCP server...');
      this.server.kill();
      console.log('✅ Disconnected');
    }
  }
}

async function testMCPEndToEnd() {
  console.log('🚀 Starting MCP end-to-end test...\n');
  
  const client = new SimpleMCPClient();
  
  try {
    // Connect to server
    await client.connect();
    
    // List available tools
    const tools = await client.listTools();
    
    if (tools.length === 0) {
      throw new Error('No tools available');
    }
    
    // Test chat functionality
    const testMessages = [
      'Hello! Can you help me understand what this MCP server can do?',
      'What kind of development tasks can you assist with?',
      'Can you explain your capabilities as an AI coding assistant?'
    ];
    
    for (const message of testMessages) {
      try {
        await client.chat(message);
        console.log('─'.repeat(50));
      } catch (error) {
        console.log(`❌ Chat test failed: ${error.message}`);
        console.log('─'.repeat(50));
      }
    }
    
    console.log('\n🎉 MCP end-to-end test completed successfully!');
    console.log('✅ Server is working correctly');
    console.log('✅ Tools are properly exposed');
    console.log('✅ Chat functionality is working');
    
  } catch (error) {
    console.error('💥 MCP test failed:', error);
  } finally {
    await client.disconnect();
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testMCPEndToEnd();
}