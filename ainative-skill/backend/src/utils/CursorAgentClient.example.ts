/**
 * Cursor Agent API Client Usage Examples
 * 
 * This file demonstrates how to use the CursorAgentClient
 */

import { cursorAgentClient, CreateAgentRequest } from './CursorAgentClient';
// import { CursorAgentClient } from './CursorAgentClient'; // Unused in examples

// Example 1: List all agents
async function listAgentsExample() {
  try {
    const response = await cursorAgentClient.listAgents(20);
    console.log('Agents:', response.agents);
    console.log('Next cursor:', response.nextCursor);
  } catch (error) {
    console.error('Error listing agents:', error);
  }
}

// Example 2: Create a new agent
async function createAgentExample() {
  const request: CreateAgentRequest = {
    // name: 'Add README Documentation', // Note: name is not part of CreateAgentRequest interface
    prompt: {
      text: 'Add a comprehensive README.md file with installation instructions and usage examples',
    },
    source: {
      repository: 'https://github.com/your-org/your-repo',
      ref: 'main',
    },
    target: {
      branchName: 'cursor/add-readme-1234',
      autoCreatePr: true,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
    // model is optional - if not provided, Cursor will auto-select
  };

  try {
    const response = await cursorAgentClient.createAgent(request);
    console.log('Created agent with ID:', response.id);
  } catch (error) {
    console.error('Error creating agent:', error);
  }
}

// Example 3: Get agent status
async function getAgentStatusExample(agentId: string) {
  try {
    const agent = await cursorAgentClient.getAgent(agentId);
    console.log('Agent status:', agent.status);
    console.log('Agent summary:', agent.summary);
  } catch (error) {
    console.error('Error getting agent status:', error);
  }
}

// Example 4: Send followup prompt
async function sendFollowupExample(agentId: string) {
  try {
    const response = await cursorAgentClient.sendFollowup(agentId, {
      prompt: {
        text: 'Also add a troubleshooting section',
      },
    });
    console.log('Followup sent, agent ID:', response.id);
  } catch (error) {
    console.error('Error sending followup:', error);
  }
}

// Example 5: Get agent conversation
async function getConversationExample(agentId: string) {
  try {
    const conversation = await cursorAgentClient.getAgentConversation(agentId);
    console.log('Conversation messages:', conversation.messages);
  } catch (error) {
    console.error('Error getting conversation:', error);
  }
}

// Example 6: Stop a running agent
async function stopAgentExample(agentId: string) {
  try {
    const response = await cursorAgentClient.stopAgent(agentId);
    console.log('Agent stopped:', response.id);
  } catch (error) {
    console.error('Error stopping agent:', error);
  }
}

// Example 7: Delete an agent
async function deleteAgentExample(agentId: string) {
  try {
    const response = await cursorAgentClient.deleteAgent(agentId);
    console.log('Agent deleted:', response.id);
  } catch (error) {
    console.error('Error deleting agent:', error);
  }
}

// Example 8: Get API key information
async function getApiKeyInfoExample() {
  try {
    const info = await cursorAgentClient.getApiKeyInfo();
    console.log('API Key Name:', info.apiKeyName);
    console.log('User Email:', info.userEmail);
    console.log('Created At:', info.createdAt);
  } catch (error) {
    console.error('Error getting API key info:', error);
  }
}

// Example 9: List available models
async function listModelsExample() {
  try {
    const response = await cursorAgentClient.listModels();
    console.log('Available models:', response.models);
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

// Example 10: List GitHub repositories
// Note: This endpoint has strict rate limits: 1 request per user per minute, 30 requests per user per hour
async function listRepositoriesExample() {
  try {
    const response = await cursorAgentClient.listRepositories();
    console.log('Repositories:', response.repositories);
  } catch (error) {
    console.error('Error listing repositories:', error);
  }
}

// Example 11: Create client with custom API key
function createCustomClientExample() {
  // const customApiKey = 'your-custom-api-key';
  // const client = new CursorAgentClient(customApiKey);
  // Use client...
}

// Example 12: Complete workflow - Create agent, monitor, and get results
async function completeWorkflowExample() {
  try {
    // 1. Create agent
    const createResponse = await cursorAgentClient.createAgent({
      // name: 'Fix authentication bug', // Note: name is not part of CreateAgentRequest interface
      prompt: {
        text: 'Fix the authentication bug in the login flow',
      },
      source: {
        repository: 'https://github.com/your-org/your-repo',
        ref: 'main',
      },
      target: {
        branchName: 'cursor/fix-auth-5678',
        autoCreatePr: true,
      },
    });

    const agentId = createResponse.id;
    console.log('Created agent:', agentId);

    // 2. Monitor agent status
    let agent = await cursorAgentClient.getAgent(agentId);
    while (agent.status === 'RUNNING') {
      console.log('Agent is running, waiting...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      agent = await cursorAgentClient.getAgent(agentId);
    }

    // 3. Get final status
    console.log('Agent finished with status:', agent.status);
    if (agent.summary) {
      console.log('Summary:', agent.summary);
    }

    // 4. Get conversation
    const conversation = await cursorAgentClient.getAgentConversation(agentId);
    console.log('Total messages:', conversation.messages.length);

    // 5. Get PR URL if available
    if (agent.target.prUrl) {
      console.log('PR URL:', agent.target.prUrl);
    }
  } catch (error) {
    console.error('Error in workflow:', error);
  }
}

export {
  listAgentsExample,
  createAgentExample,
  getAgentStatusExample,
  sendFollowupExample,
  getConversationExample,
  stopAgentExample,
  deleteAgentExample,
  getApiKeyInfoExample,
  listModelsExample,
  listRepositoriesExample,
  createCustomClientExample,
  completeWorkflowExample,
};

