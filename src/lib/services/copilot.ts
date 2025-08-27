import { openaiService } from './openai';
import { getAllBlocks, getBlockConfig, blockRegistry } from '../blocks/registry';
import { useAppStore } from '../store';
import type { WorkflowNode, WorkflowEdge } from '../types';

interface BlockSuggestion {
  type: string;
  name: string;
  description: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  connections?: {
    from?: string;
    to?: string[];
  };
}

interface WorkflowPlan {
  description: string;
  blocks: BlockSuggestion[];
  connections: Array<{
    from: string;
    to: string;
    description?: string;
  }>;
}

interface WorkflowPattern {
  name: string;
  keywords: string[];
  blocks: string[];
  description: string;
  complexity: 'simple' | 'moderate' | 'complex';
}

interface IntentAnalysis {
  primaryIntent: string;
  entities: string[];
  patterns: WorkflowPattern[];
  suggestedBlocks: string[];
  confidence: number;
}

export class CopilotService {
  // Removed hardcoded patterns - now fully dynamic based on user input

  private getAvailableBlocks() {
    return getAllBlocks()
      .filter(block => block.type !== 'starter')
      .map(block => ({
        type: block.type,
        name: block.name,
        description: block.description || '',
        category: block.category,
        inputs: block.inputs || {},
        outputs: block.outputs || {},
        subBlocks: block.subBlocks?.map(sb => ({
          id: sb.id,
          title: sb.title,
          type: sb.type,
          required: sb.required || false,
          placeholder: sb.placeholder || ''
        })) || []
      }));
  }

  private getAllAvailableBlocks() {
    // Get ALL blocks from registry for comprehensive workflow building
    return getAllBlocks()
      .filter(block => block.type !== 'starter')
      .map(block => ({
        type: block.type,
        name: block.name,
        description: block.description || '',
        category: block.category,
        inputs: block.inputs || {},
        outputs: block.outputs || {},
        useCases: this.getBlockUseCases(block.type),
        keywords: this.getBlockKeywords(block.type, block.name)
      }))
      .sort((a, b) => {
        // Sort by relevance: core blocks first, then popular integrations
        const coreBlocks = ['agent', 'api', 'condition', 'response', 'function'];
        const popularBlocks = ['slack', 'gmail', 'pinecone', 'discord', 'notion', 'airtable', 'github'];
        
        if (coreBlocks.includes(a.type) && !coreBlocks.includes(b.type)) return -1;
        if (!coreBlocks.includes(a.type) && coreBlocks.includes(b.type)) return 1;
        if (popularBlocks.includes(a.type) && !popularBlocks.includes(b.type)) return -1;
        if (!popularBlocks.includes(a.type) && popularBlocks.includes(b.type)) return 1;
        
        return a.name.localeCompare(b.name);
      });
  }

  private getBlockUseCases(type: string): string[] {
    const useCases: Record<string, string[]> = {
      // Core blocks
      agent: ['AI chat/conversation', 'Content generation', 'Text analysis', 'Decision making', 'Data processing'],
      api: ['Fetch external data', 'Send data to services', 'Webhook calls', 'Authentication', 'Integration'],
      condition: ['Route workflow based on data', 'Error handling', 'Validate responses', 'Branch logic'],
      response: ['Send final output', 'User notifications', 'Return results', 'Workflow completion'],
      function: ['Transform data format', 'Calculate values', 'Parse/extract data', 'Clean/validate input'],
      
      // Popular integrations
      slack: ['Team notifications', 'Workflow alerts', 'Chat messages', 'Channel updates'],
      discord: ['Community notifications', 'Bot messages', 'Server alerts', 'Channel posts'],
      gmail: ['Email sending', 'Email automation', 'Notifications via email', 'Email workflows'],
      pinecone: ['Vector search', 'RAG systems', 'Semantic search', 'AI memory', 'Embeddings storage'],
      notion: ['Knowledge base', 'Note taking', 'Database operations', 'Documentation'],
      airtable: ['Database operations', 'Spreadsheet automation', 'Data storage', 'CRM workflows'],
      github: ['Code management', 'Issue tracking', 'Repository operations', 'CI/CD integration'],
      file: ['File operations', 'Data reading', 'Content processing', 'File management'],
      openai: ['AI processing', 'GPT integration', 'Content generation', 'Text analysis'],
      googledrive: ['File storage', 'Document sharing', 'Cloud operations', 'File sync'],
      googlesheets: ['Spreadsheet automation', 'Data analysis', 'Report generation', 'Data tracking'],
      telegram: ['Bot messages', 'Notifications', 'Chat automation', 'Instant messaging'],
      youtube: ['Video search', 'Content discovery', 'Video management', 'YouTube automation'],
      linkedin: ['Professional networking', 'Content sharing', 'Social automation', 'Lead generation'],
      x: ['Social media posting', 'Twitter automation', 'Content sharing', 'Social engagement']
    };
    return useCases[type] || [`${type} integration`, 'External service connection'];
  }

  private getBlockKeywords(type: string, name: string): string[] {
    const keywords: Record<string, string[]> = {
      agent: ['ai', 'chat', 'chatbot', 'conversation', 'generate', 'gpt', 'llm', 'gemini', 'claude'],
      api: ['fetch', 'request', 'http', 'rest', 'webhook', 'endpoint', 'service'],
      condition: ['if', 'check', 'validate', 'branch', 'route', 'logic', 'decision'],
      response: ['output', 'result', 'reply', 'send', 'return', 'respond'],
      function: ['transform', 'process', 'calculate', 'parse', 'format', 'convert'],
      
      slack: ['slack', 'team', 'notification', 'message', 'channel', 'workspace'],
      discord: ['discord', 'server', 'bot', 'community', 'gaming', 'chat'],
      gmail: ['email', 'mail', 'send', 'gmail', 'google', 'notification'],
      pinecone: ['vector', 'embedding', 'search', 'rag', 'similarity', 'semantic', 'knowledge', 'vectordb', 'database'],
      notion: ['notes', 'database', 'workspace', 'documentation', 'wiki'],
      airtable: ['database', 'table', 'record', 'spreadsheet', 'crm'],
      github: ['code', 'repository', 'git', 'issue', 'pull request', 'ci/cd'],
      file: ['file', 'read', 'write', 'document', 'text', 'data'],
      openai: ['openai', 'gpt', 'ai', 'generate', 'completion'],
      googledrive: ['drive', 'file', 'storage', 'document', 'share'],
      googlesheets: ['sheet', 'spreadsheet', 'data', 'excel', 'table'],
      telegram: ['telegram', 'bot', 'message', 'notification'],
      youtube: ['youtube', 'video', 'search', 'content'],
      linkedin: ['linkedin', 'professional', 'network', 'business'],
      x: ['twitter', 'x', 'tweet', 'social', 'post'],
      whatsapp: ['whatsapp', 'whats app', 'wa', 'message', 'chat'],
    };
    
    return [...(keywords[type] || []), type, name.toLowerCase()];
  }

  private analyzeWorkflowComplexity(userPrompt: string): 'simple' | 'moderate' | 'complex' {
    const lc = userPrompt.toLowerCase();
    
    // Let the user decide complexity with their words
    if (lc.includes('simple') || lc.includes('basic') || lc.includes('quick') || 
        lc.includes('just') || lc.includes('only') || lc.includes('minimal')) {
      return 'simple';
    }
    
    if (lc.includes('comprehensive') || lc.includes('complete') || lc.includes('advanced') ||
        lc.includes('robust') || lc.includes('enterprise') || lc.includes('full-featured') ||
        lc.includes('complex') || lc.includes('detailed')) {
      return 'complex';
    }
    
    // Count the number of different services/actions mentioned
    const actionWords = lc.split(' ').filter(word => 
      ['send', 'receive', 'process', 'analyze', 'transform', 'store', 'fetch', 'notify', 'validate', 'check'].includes(word)
    );
    
    // Default to simple unless multiple actions are mentioned
    return actionWords.length >= 3 ? 'moderate' : 'simple';
  }

  private analyzeUserIntent(userPrompt: string): IntentAnalysis {
    const lc = userPrompt.toLowerCase();
    
    // Extract entities (services, tools, platforms mentioned)
    const entities = this.extractEntities(lc);
    
    // Determine primary intent based on keywords in the prompt
    let primaryIntent = 'custom_workflow';
    if (lc.includes('chatbot') || lc.includes('chat') || lc.includes('conversation')) {
      primaryIntent = 'chatbot';
    } else if (lc.includes('notification') || lc.includes('notify') || lc.includes('alert')) {
      primaryIntent = 'notification';
    } else if (lc.includes('analyze') || lc.includes('process') || lc.includes('transform')) {
      primaryIntent = 'data_processing';
    } else if (lc.includes('api') || lc.includes('fetch') || lc.includes('integration')) {
      primaryIntent = 'api_integration';
    }
    
    // Dynamic block suggestion based purely on entities and intent
    const suggestedBlocks = this.dynamicBlockAnalysis(lc, entities, primaryIntent);
    
    return {
      primaryIntent,
      entities,
      patterns: [], // No more hardcoded patterns
      suggestedBlocks: suggestedBlocks.slice(0, 8), // Allow more blocks for flexibility
      confidence: entities.length > 0 ? 0.8 : 0.6 // Higher confidence if specific services mentioned
    };
  }

  private extractEntities(prompt: string): string[] {
    const entityMap: Record<string, string> = {
      // Communication platforms
      'whatsapp': 'whatsapp',
      'whats app': 'whatsapp',
      'wa': 'whatsapp',
      'slack': 'slack',
      'discord': 'discord',
      'telegram': 'telegram',
      
      // Email services  
      'gmail': 'gmail',
      'email': 'gmail',
      'mail': 'gmail',
      'outlook': 'outlook',
      
      // AI services
      'openai': 'openai',
      'gpt': 'openai',
      'gemini': 'openai',
      'claude': 'openai',
      
      // Vector databases
      'pinecone': 'pinecone',
      'vector': 'pinecone',
      'qdrant': 'qdrant',
      'vectordb': 'pinecone',
      
      // Social media
      'youtube': 'youtube',
      'twitter': 'x',
      'x.com': 'x',
      'linkedin': 'linkedin',
      
      // Productivity
      'notion': 'notion',
      'airtable': 'airtable',
      'sheets': 'googlesheets',
      'excel': 'googlesheets',
      'drive': 'googledrive',
      
      // Development
      'github': 'github',
      'git': 'github',
      'api': 'api',
      'webhook': 'api',
      
      // File operations
      'file': 'file',
      'document': 'file',
      'pdf': 'file',
      'text': 'file'
    };

    const entities: string[] = [];
    
    Object.keys(entityMap).forEach(keyword => {
      if (prompt.includes(keyword)) {
        const blockType = entityMap[keyword];
        if (!entities.includes(blockType)) {
          entities.push(blockType);
        }
      }
    });

    return entities;
  }

  private dynamicBlockAnalysis(prompt: string, entities: string[], primaryIntent: string): string[] {
    const blocks: string[] = [...entities];
    
    // Add blocks based on what the user actually asks for
    if (prompt.includes('chat') || prompt.includes('bot') || prompt.includes('conversation') || primaryIntent === 'chatbot') {
      if (!blocks.includes('agent')) blocks.push('agent');
    }
    
    if (prompt.includes('analyze') || prompt.includes('process') || prompt.includes('transform') || primaryIntent === 'data_processing') {
      if (!blocks.includes('agent')) blocks.push('agent');
      if (prompt.includes('function') || prompt.includes('transform')) {
        if (!blocks.includes('function')) blocks.push('function');
      }
    }
    
    if (prompt.includes('condition') || prompt.includes('if') || prompt.includes('check') || prompt.includes('validate')) {
      if (!blocks.includes('condition')) blocks.push('condition');
    }
    
    if (prompt.includes('api') || prompt.includes('fetch') || prompt.includes('request') || primaryIntent === 'api_integration') {
      if (!blocks.includes('api')) blocks.push('api');
    }
    
    if (prompt.includes('file') || prompt.includes('document') || prompt.includes('upload')) {
      if (!blocks.includes('file')) blocks.push('file');
    }
    
    // Handle notification requests more intelligently
    if (prompt.includes('notify') || prompt.includes('send') || prompt.includes('alert') || primaryIntent === 'notification') {
      // Only add notification blocks if user specifically mentions them or if no specific service is mentioned
      if (entities.length === 0) {
        // No specific service mentioned, ask AI to decide
        blocks.push('response'); // Generic output
      }
      // If specific services are mentioned, they're already in entities
    }
    
    // Only add response if no other output blocks are present and user doesn't specify output method
    const outputBlocks = ['response', 'whatsapp', 'slack', 'gmail', 'discord', 'telegram', 'x', 'linkedin'];
    if (!blocks.some(b => outputBlocks.includes(b)) && !prompt.includes('send') && !prompt.includes('notify')) {
      blocks.push('response');
    }
    
    return blocks;
  }

  private validateAndCorrectBlockTypes(plan: WorkflowPlan, userPrompt: string): WorkflowPlan {
    const availableBlockTypes = getAllBlocks().map(b => b.type);
    const correctionMap: Record<string, string> = {
      // Common AI mistakes → Correct block types
      'ai_chatbot': 'agent',
      'ai chatbot': 'agent', 
      'chatbot': 'agent',
      'ai_agent': 'agent',
      'ai agent': 'agent',
      'llm': 'agent',
      'gpt': 'agent',
      'gemini': 'agent',
      'claude': 'agent',
      'user interaction agent': 'agent',
      'user_interaction_agent': 'agent',
      'interaction agent': 'agent',
      'chatbot agent': 'agent',
      
      'vector_database': 'pinecone',
      'vector database': 'pinecone',
      'vector_search': 'pinecone',
      'vector search': 'pinecone',
      'vectordb': 'pinecone',
      'vector_db': 'pinecone',
      'vector db': 'pinecone',
      'database_query': 'pinecone',
      'database query': 'pinecone',
      'vector_database_query': 'pinecone',
      'vector database query': 'pinecone',
      
      // WhatsApp corrections
      'whatsapp_notification': 'whatsapp',
      'whatsapp notification': 'whatsapp',
      'whatsapp_message': 'whatsapp',
      'whatsapp message': 'whatsapp',
      'send_whatsapp': 'whatsapp',
      'send whatsapp': 'whatsapp',
      'whatsapp integration': 'whatsapp',
      'whatsapp_integration': 'whatsapp',
      
      'slack_notification': 'slack',
      'slack notification': 'slack',
      'slack notification block': 'slack',
      'slack_notification_block': 'slack',
      'send_notification': 'slack',
      'send notification': 'slack',
      'notification': 'whatsapp', // Default notification to whatsapp if mentioned
      'notify': 'whatsapp',
      'alert': 'slack',
      'send_message': 'slack',
      'send message': 'slack',
      'message': 'slack',
      
      'email_notification': 'gmail',
      'email notification': 'gmail',
      'send_email': 'gmail',
      'send email': 'gmail',
      'email': 'gmail',
      'mail': 'gmail',
      
      'file_reader': 'file',
      'file reader': 'file',
      'read_file': 'file',
      'read file': 'file',
      'file_input': 'file',
      'file input': 'file',
      'data_input': 'file',
      'data input': 'file',
      
      'http_request': 'api',
      'http request': 'api',
      'rest_api': 'api',
      'rest api': 'api',
      'web_request': 'api',
      'web request': 'api',
      'fetch_data': 'api',
      'fetch data': 'api',
      
      'condition_check': 'condition',
      'condition check': 'condition',
      'if_condition': 'condition',
      'if condition': 'condition',
      'branch': 'condition',
      'decision': 'condition',
      'logic': 'condition',
      
      'output': 'response',
      'result': 'response',
      'send_response': 'response',
      'send response': 'response',
      'user response': 'response',
      'user_response': 'response',
      'reply': 'response',
      'return': 'response',
      'final_output': 'response',
      'final output': 'response',
      
      'data_processing': 'function',
      'data processing': 'function',
      'transform': 'function',
      'process': 'function',
      'parse': 'function',
      'format': 'function'
    };

    console.log('🔍 Validating block types...');
    
    const correctedBlocks = plan.blocks.map((block, index) => {
      const originalType = block.type.toLowerCase().trim();
      
      // Check if the block type exists in registry
      if (availableBlockTypes.includes(originalType)) {
        console.log(`✅ Block ${index + 1}: "${originalType}" - Valid`);
        return { ...block, type: originalType };
      }
      
      // Try to find a correction
      let correctedType = correctionMap[originalType];
      
      // If no direct correction, try fuzzy matching with keywords
      if (!correctedType) {
        const lc = userPrompt.toLowerCase();
        
        // Smart keyword matching based on user input
        if (originalType.includes('vector') || originalType.includes('database') || originalType.includes('pinecone')) {
          if (lc.includes('pinecone')) correctedType = 'pinecone';
          else if (lc.includes('qdrant')) correctedType = 'qdrant'; 
          else correctedType = 'pinecone'; // default vector db
        }
        else if (originalType.includes('whatsapp') || (originalType.includes('notification') && lc.includes('whatsapp'))) {
          correctedType = 'whatsapp';
        }
        else if (originalType.includes('slack') || originalType.includes('notification')) {
          if (lc.includes('whatsapp')) correctedType = 'whatsapp';
          else if (lc.includes('slack')) correctedType = 'slack';
          else if (lc.includes('discord')) correctedType = 'discord';
          else if (lc.includes('telegram')) correctedType = 'telegram';
          else correctedType = 'slack'; // default notification
        }
        else if (originalType.includes('email') || originalType.includes('mail')) {
          if (lc.includes('gmail')) correctedType = 'gmail';
          else if (lc.includes('outlook')) correctedType = 'outlook';
          else correctedType = 'gmail'; // default email
        }
        else if (originalType.includes('ai') || originalType.includes('chat') || originalType.includes('agent')) {
          correctedType = 'agent';
        }
        else if (originalType.includes('file') || originalType.includes('read') || originalType.includes('input')) {
          correctedType = 'file';
        }
        else if (originalType.includes('condition') || originalType.includes('if') || originalType.includes('check')) {
          correctedType = 'condition';
        }
        else if (originalType.includes('response') || originalType.includes('output') || originalType.includes('result')) {
          correctedType = 'response';
        }
        else if (originalType.includes('api') || originalType.includes('http') || originalType.includes('request')) {
          correctedType = 'api';
        }
        else if (originalType.includes('function') || originalType.includes('process') || originalType.includes('transform')) {
          correctedType = 'function';
        }
        else {
          // Last resort: default to agent for AI-related tasks
          correctedType = 'agent';
        }
      }
      
      console.log(`🔧 Block ${index + 1}: "${originalType}" → "${correctedType}" (${availableBlockTypes.includes(correctedType) ? 'Valid' : 'STILL INVALID!'})`);
      
      return {
        ...block,
        type: correctedType,
        name: block.name || `${correctedType} Block`
      };
    });
    
    return {
      ...plan,
      blocks: correctedBlocks
    };
  }

  private createSystemPrompt(analysis: IntentAnalysis): string {
    const availableTypes = getAllBlocks().filter(b => b.type !== 'starter').map(b => b.type);
    
    return `You are an expert workflow architect. Create a workflow using ONLY these exact block types: ${availableTypes.join(', ')}

ANALYZED USER INTENT:
- Primary Intent: ${analysis.primaryIntent}
- Confidence: ${(analysis.confidence * 100).toFixed(0)}%
- Detected Entities: ${analysis.entities.join(', ') || 'none'}
- Suggested Blocks: ${analysis.suggestedBlocks.join(', ')}
- Matching Patterns: ${analysis.patterns.map(p => p.name).join(', ') || 'custom workflow'}

WORKFLOW PATTERNS DATABASE:
${this.workflowPatterns.map(pattern => 
  `• ${pattern.name}: ${pattern.blocks.join(' → ')} (${pattern.complexity})`
).join('\n')}

SMART WORKFLOW RULES:
1. Use the suggested blocks from analysis: ${analysis.suggestedBlocks.join(', ')}
2. Follow logical flow: input → processing → output
3. For bidirectional communication (WhatsApp, Slack): use block twice (input & output)
4. For RAG workflows: file → pinecone → agent → (notification/response)
5. For API workflows: api → function → condition → response
6. Always connect from "starter" to first block

PERFECT EXAMPLES:
WhatsApp Chatbot: [{"type":"whatsapp","name":"Receive Message"}, {"type":"agent","name":"AI Agent"}, {"type":"whatsapp","name":"Send Reply"}]
RAG + Slack: [{"type":"file","name":"Load Data"}, {"type":"pinecone","name":"Vector Search"}, {"type":"agent","name":"AI Process"}, {"type":"slack","name":"Send to Slack"}]
YouTube Analysis: [{"type":"youtube","name":"Search Videos"}, {"type":"agent","name":"Analyze Content"}, {"type":"response","name":"Return Results"}]

JSON RESPONSE FORMAT:
{
  "description": "Clear workflow description based on user intent",
  "blocks": [
    {"type": "exact_block_type", "name": "Descriptive Name", "description": "What this block does", "data": {"label": "Display Name"}}
  ],
  "connections": [
    {"from": "starter", "to": "first_block_name", "description": "Workflow starts"},
    {"from": "first_block_name", "to": "second_block_name", "description": "Data flows"}
  ]
}

CRITICAL: Use ONLY block types from this list: ${availableTypes.join(', ')}
Never create fake types like "User Interaction Agent" or "WhatsApp Integration"!`;
  }

  private parseUserSequence(userPrompt: string): string[] {
    // Help identify sequential language patterns
    const sequenceWords = ['then', 'after', 'next', 'followed by', 'and then', 'afterwards', 'subsequently', 'and after'];
    const lc = userPrompt.toLowerCase();
    
    // Split by sequence words to identify steps
    let steps: string[] = [];
    let currentStep = userPrompt;
    
    for (const word of sequenceWords) {
      if (lc.includes(word)) {
        const parts = currentStep.split(new RegExp(word, 'i'));
        if (parts.length > 1) {
          steps = parts.map(p => p.trim()).filter(p => p.length > 0);
          break;
        }
      }
    }
    
    // Special handling for your specific pattern
    if (steps.length === 0 && lc.includes('emailing') && lc.includes('summarise')) {
      // Try to split on "and" for compound sentences
      if (lc.includes(' and ')) {
        const parts = userPrompt.split(/ and /i);
        if (parts.length > 1) {
          steps = parts.map(p => p.trim()).filter(p => p.length > 0);
        }
      }
    }
    
    // If no sequence words found, treat as single step
    if (steps.length === 0) {
      steps = [userPrompt.trim()];
    }
    
    // Sequence parsed silently
    return steps;
  }

  async generateWorkflowPlan(userPrompt: string): Promise<WorkflowPlan> {
    if (!openaiService.isConfigured()) {
      throw new Error('OpenAI API is not configured. Please set up your API key.');
    }

    // Get all available blocks for dynamic selection
    const availableBlocks = this.getAllAvailableBlocks();
    const availableTypes = availableBlocks.map(b => b.type);
    
    // Parse the user's sequence
    const sequenceSteps = this.parseUserSequence(userPrompt);
    
    // Internal processing - no user-facing logs

    // NUCLEAR FIX: Ultra-explicit system prompt that forces literal interpretation
    const systemPrompt = `You are a LITERAL workflow builder. Your ONLY job is to translate user words into blocks EXACTLY as they describe.

🚨 ABSOLUTE RULES - NO EXCEPTIONS:
1. EVERY ACTION = SEPARATE BLOCK: If user mentions "emailing" and "summarizing", that's 2 different blocks
2. EVERY SERVICE = SEPARATE BLOCK: If they say "email" and "slack", you MUST use both email block AND slack block
3. NO COMBINING: Never merge steps - if they say "A then B", create block A then block B
4. NO ASSUMPTIONS: Don't add what you think they need - only what they explicitly say

AVAILABLE BLOCKS: ${availableBlocks.map(b => `${b.type} (${b.name}): ${b.description}`).join('\n')}

🎯 TRANSLATION RULES:
- "AI agent" = agent block
- "emailing" or "send email" = gmail block (or email service they mention)
- "summarize" = agent block (for summarization)
- "slack" = slack block
- "WhatsApp" = whatsapp block
- "analyze" = agent block
- "process file" = file block

🔥 CRITICAL EXAMPLES:
User: "cold emailing from ai agent at start and after emailing agent has to summarise and send the summary through slack channel"
TRANSLATION: 
1. "cold emailing from ai agent" = agent block (creates email)
2. "emailing" = gmail block (sends the email)  
3. "agent has to summarise" = agent block (summarizes)
4. "send the summary through slack" = slack block (sends to slack)
RESULT: agent → gmail → agent → slack (4 blocks!)

User: "AI creates content then posts to Twitter"
TRANSLATION:
1. "AI creates content" = agent block
2. "posts to Twitter" = x block  
RESULT: agent → x (2 blocks!)

🚨 MANDATORY OUTPUT FORMAT (JSON only):
{
  "description": "Exact description of what user asked for",
  "blocks": [
    {
      "type": "exact_block_type_from_available_list",
      "name": "Action name from user request",
      "description": "What this block does in user's sequence",
      "position": {"x": 100, "y": 100},
      "data": {}
    }
  ],
  "connections": [
    {"from": "starter", "to": "first_block_name", "description": "Starts workflow"},
    {"from": "first_block_name", "to": "second_block_name", "description": "Next step"}
  ]
}

🚨 FINAL WARNING: If user mentions 4 actions, create 4 blocks. If they mention email AND slack, use BOTH blocks. NO SHORTCUTS!`;
    
    const response = await openaiService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `🚨 TRANSLATE THIS LITERALLY: "${userPrompt}"

STEP-BY-STEP BREAKDOWN:
${sequenceSteps.map((step, i) => `${i + 1}. "${step}" → What blocks does this need?`).join('\n')}

🔥 MANDATORY REQUIREMENTS:
- If they mention "AI agent" AND "emailing" AND "summarize" AND "slack" → That's 4 SEPARATE blocks!
- If they say "emailing" → You MUST include an email block (gmail/email service)
- If they say "slack" → You MUST include a slack block
- If they say "agent" → You MUST include an agent block
- NO COMBINING! Each action = separate block!

TRANSLATE EACH WORD INTO BLOCKS. NO SHORTCUTS. NO ASSUMPTIONS.` }
    ], {
      temperature: 0.3, // Higher temperature for better creativity while following rules
      maxTokens: 2000,
      model: 'gpt-4o-mini'
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      let plan = JSON.parse(jsonMatch[0]) as WorkflowPlan;
      
      console.log('🤖 AI Generated Plan:', plan);
      console.log('📦 Blocks in plan:', plan.blocks?.map(b => `${b.name} (${b.type})`));
      
      // Validate the plan structure
      if (!plan.blocks || !Array.isArray(plan.blocks)) {
        throw new Error('Invalid workflow plan: missing blocks array');
      }

      // Validate block types exist
      plan.blocks.forEach(block => {
        if (!availableTypes.includes(block.type)) {
          // Invalid block type detected
          throw new Error(`Invalid block type: ${block.type}. Available types: ${availableTypes.join(', ')}`);
        }
      });

      // Silent validation - no user-facing logs
      return plan;
    } catch (error) {
      console.error('Failed to parse AI response:', content);
      throw new Error(`Failed to parse workflow plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async implementWorkflowPlan(plan: WorkflowPlan): Promise<{
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  }> {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];
    const nodeIdMap = new Map<string, string>(); // Map from plan block key to actual node ID

    // Track aliases to ensure uniqueness
    const usedAliases = new Set<string>();
    const makeAlias = (base: string) => {
      let slug = base.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      if (!slug) slug = 'node';
      let a = slug;
      let i = 2;
      while (usedAliases.has(a)) {
        a = `${slug}_${i++}`;
      }
      usedAliases.add(a);
      return a;
    };

    // Get current workflow to position nodes near existing canvas area
    const store = useAppStore.getState();
    const currentWorkspace = store.workspaces.find(ws => ws.id === store.currentWorkspaceId);
    const currentWorkflow = currentWorkspace?.workflows.find(wf => wf.id === store.currentWorkflowId);

    let baseX = 80;
    let baseY = 80;
    const xGap = 260; // spacing similar to n8n/sim.ai
    const yGap = 140;

    let starterNodeId = 'starter'; // Default starter ID
    
    if (currentWorkflow && currentWorkflow.nodes.length > 0) {
      const starterNode = currentWorkflow.nodes.find(n => n.type === 'starter' || n.type?.toLowerCase() === 'start');
      if (starterNode) {
        // Always reuse the single starter node; never create another
        starterNodeId = starterNode.id;
        nodeIdMap.set('starter', starterNode.id);
        nodeIdMap.set('start', starterNode.id);
        baseX = starterNode.position.x + xGap;
        baseY = starterNode.position.y;
      } else {
        const maxX = Math.max(...currentWorkflow.nodes.map(n => n.position.x));
        const minY = Math.min(...currentWorkflow.nodes.map(n => n.position.y));
        baseX = maxX + xGap;
        baseY = minY;
      }
    }

    // helper: normalize key names for robust mapping
    const norm = (s: string | undefined) => String(s || '').trim().toLowerCase();

    // Create nodes from the plan and position them in a compact grid near baseX/baseY
    plan.blocks.forEach((blockSuggestion, index) => {
      // Never create another starter/start block; reuse existing
      const bt = norm(blockSuggestion.type);
      if (bt === 'starter' || bt === 'start') {
        return; // skip creating duplicates
      }

      const blockConfig = getBlockConfig(blockSuggestion.type);
      if (!blockConfig) {
        console.error(`❌ Unknown block type: "${blockSuggestion.type}". Available types:`, Object.keys(blockRegistry));
        console.error('Block suggestion:', blockSuggestion);
        return;
      }
      
      console.log(`✅ Creating block: ${blockSuggestion.type} -> ${blockConfig.name}`);

      const nodeId = `${blockSuggestion.type}-${Date.now()}-${index}`;

      // Map by a stable key: prefer provided name, else type+index
      const mapKey = norm(blockSuggestion.name || `${blockSuggestion.type}-${index}`);
      nodeIdMap.set(mapKey, nodeId);

      // Prepare default data based on block configuration
      const defaultData: Record<string, unknown> = {
        label: blockSuggestion.name || blockConfig.name,
        ...blockSuggestion.data
      };

      // Assign a friendly alias if none provided
      if (!defaultData.alias) {
        // Base alias from provided alias/name/type
        const desiredBase = String(blockSuggestion.data?.alias || blockSuggestion.name || blockSuggestion.type || '').trim();
        defaultData.alias = makeAlias(desiredBase || blockSuggestion.type);
      } else {
        defaultData.alias = makeAlias(String(defaultData.alias));
      }

      // Smart field population - only fill safe fields, leave sensitive ones empty
      blockConfig.subBlocks?.forEach(subBlock => {
        if (!defaultData[subBlock.id]) {
          // Fields that should NEVER be auto-filled (user must configure)
          const sensitiveFields = [
            'apikey', 'api_key', 'key', 'token', 'secret', 'password', 'auth',
            'credential', 'bearer', 'oauth', 'jwt', 'private_key', 'client_secret'
          ];
          
          // Fields that should be left empty for user input
          const userInputFields = [
            'prompt', 'message', 'input', 'query', 'question', 'text', 'content',
            'url', 'endpoint', 'webhook', 'email', 'phone', 'address'
          ];
          
          const fieldId = subBlock.id.toLowerCase();
          const fieldTitle = (subBlock.title || '').toLowerCase();
          
          // Check if this is a sensitive field that should be left empty
          const isSensitive = sensitiveFields.some(sensitive => 
            fieldId.includes(sensitive) || fieldTitle.includes(sensitive)
          );
          
          // Check if this is a user input field that should be left empty
          const isUserInput = userInputFields.some(input => 
            fieldId.includes(input) || fieldTitle.includes(input)
          );
          
          // Only auto-fill safe, non-sensitive fields
          if (!isSensitive && !isUserInput) {
            switch (subBlock.type) {
              case 'toggle':
                defaultData[subBlock.id] = false;
                break;
              case 'number':
                // Only set default numbers for safe fields
                if (!fieldId.includes('port') && !fieldId.includes('timeout')) {
                  defaultData[subBlock.id] = 0;
                }
                break;
              case 'combobox': {
                const options = typeof subBlock.options === 'function' ? subBlock.options() : subBlock.options || [];
                // Only set default for model selection and similar safe dropdowns
                if (fieldId.includes('model') || fieldId.includes('provider') || fieldId.includes('method')) {
                  defaultData[subBlock.id] = options[0]?.id || '';
                }
                break;
              }
              // Don't auto-fill text inputs - let users configure them
            }
          }
          
          // For required fields that we didn't fill, set empty string to avoid errors
          if (subBlock.required && defaultData[subBlock.id] === undefined) {
            defaultData[subBlock.id] = '';
          }
        }
      });

      // Gmail sensible defaults
      if (bt === 'gmail') {
        if (!defaultData['operation']) defaultData['operation'] = 'send';
      }
      // Slack sensible defaults
      if (bt === 'slack') {
        if (!defaultData['operation']) defaultData['operation'] = 'send_message';
        if (!defaultData['messageFormat']) defaultData['messageFormat'] = 'text';
      }

      // Compute a compact position near existing nodes; ignore absolute plan coordinates
      const col = index % 3;
      const row = Math.floor(index / 3);
      const position = {
        x: baseX + col * xGap,
        y: baseY + row * yGap,
      };

      const node: WorkflowNode = {
        id: nodeId,
        type: blockSuggestion.type,
        position,
        data: defaultData
      };

      nodes.push(node);
    });

    // Create edges from the plan with improved mapping
    const createdConnections = new Set<string>();
    
    plan.connections.forEach((connection, index) => {
      const fromKey = norm(connection.from);
      const toKey = norm(connection.to);

      // Enhanced mapping strategies
      const findNodeId = (key: string, originalKey: string) => {
        // Handle starter node specially
        if (key === 'starter' || key === 'start' || originalKey === 'starter' || originalKey === 'start') {
          return starterNodeId;
        }
        
        // Try exact matches first
        if (nodeIdMap.has(key)) return nodeIdMap.get(key);
        if (nodeIdMap.has(originalKey)) return nodeIdMap.get(originalKey);
        
        // Try synonyms
        const synonyms = {
          'input': 'input',
          'output': 'response',
          'result': 'response',
          'end': 'response'
        };
        
        if (synonyms[key] && nodeIdMap.has(synonyms[key])) {
          return nodeIdMap.get(synonyms[key]);
        }
        
        // Try partial matches (find node whose key contains the search term)
        for (const [nodeKey, nodeId] of nodeIdMap.entries()) {
          if (nodeKey.includes(key) || key.includes(nodeKey)) {
            return nodeId;
          }
        }
        
        // Try by block type matching
        const matchingNode = nodes.find(node => 
          norm(node.type).includes(key) || key.includes(norm(node.type))
        );
        
        return matchingNode?.id || null;
      };

      const fromId = findNodeId(fromKey, connection.from);
      const toId = findNodeId(toKey, connection.to);

      // Only create edge if both nodes exist and connection is valid
      if (fromId && toId && fromId !== toId) {
        const connectionKey = `${fromId}-${toId}`;
        if (!createdConnections.has(connectionKey)) {
          const edge: WorkflowEdge = {
            id: `edge-${fromId}-${toId}-${index}`,
            source: fromId,
            target: toId
          };
          edges.push(edge);
          createdConnections.add(connectionKey);
        }
      }
    });

    // ENSURE STARTER CONNECTION: If no connection from starter exists, connect to first node
    const hasStarterConnection = edges.some(edge => edge.source === starterNodeId);
    if (!hasStarterConnection && nodes.length > 0) {
      const firstNode = nodes[0];
      const starterEdge: WorkflowEdge = {
        id: `edge-starter-${firstNode.id}`,
        source: starterNodeId,
        target: firstNode.id
      };
      edges.unshift(starterEdge); // Add at beginning
    }

    // ENSURE CHAIN CONNECTIONS: Connect unconnected nodes in sequence
    const connectedNodes = new Set<string>();
    connectedNodes.add(starterNodeId);
    
    edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    // Find unconnected nodes and connect them in sequence
    const unconnectedNodes = nodes.filter(node => !connectedNodes.has(node.id));
    if (unconnectedNodes.length > 0) {
      let lastConnectedNode = starterNodeId;
      
      // Find the last node in the current chain
      const targetNodes = new Set(edges.map(e => e.target));
      const sourceNodes = new Set(edges.map(e => e.source));
      const endNodes = nodes.filter(n => !sourceNodes.has(n.id) && targetNodes.has(n.id));
      
      if (endNodes.length > 0) {
        lastConnectedNode = endNodes[endNodes.length - 1].id;
      }

      // Connect unconnected nodes in sequence
      unconnectedNodes.forEach((node, index) => {
        const connectionKey = `${lastConnectedNode}-${node.id}`;
        if (!createdConnections.has(connectionKey)) {
          const edge: WorkflowEdge = {
            id: `edge-auto-${lastConnectedNode}-${node.id}`,
            source: lastConnectedNode,
            target: node.id
          };
          edges.push(edge);
          createdConnections.add(connectionKey);
        }
        lastConnectedNode = node.id;
      });
    }

    // POST-PROCESSING: Apply smart aliases and template wiring for common patterns
    const nodeById = Object.fromEntries(nodes.map(n => [n.id, n] as const));
    const incoming = (id: string) => edges.filter(e => e.target === id).map(e => e.source);
    const outgoing = (id: string) => edges.filter(e => e.source === id).map(e => e.target);

    const findNearestUpstreamOfType = (startId: string, type: string, maxHops = 4): string | null => {
      const visited = new Set<string>();
      const queue: Array<{ id: string; hops: number }> = incoming(startId).map(s => ({ id: s, hops: 1 }));
      while (queue.length) {
        const { id, hops } = queue.shift()!;
        if (visited.has(id) || hops > maxHops) continue;
        visited.add(id);
        const n = nodeById[id];
        if (n?.type === type) return id;
        incoming(id).forEach(s => queue.push({ id: s, hops: hops + 1 }));
      }
      return null;
    };

    const renameAlias = (node: WorkflowNode, desired: string) => {
      const current = String((node.data as any)?.alias || '');
      if (current && current !== node.type && !usedAliases.has(current)) {
        usedAliases.add(current);
        return current;
      }
      const newAlias = makeAlias(desired);
      (node.data as any).alias = newAlias;
      return newAlias;
    };

    // Prefill usedAliases with any aliases we set during creation
    nodes.forEach(n => {
      const a = String((n.data as any)?.alias || '').trim();
      if (a) usedAliases.add(a);
    });

    // 1) Agent → Gmail: name agent as email_agent, gmail as gmail_node and wire fields
    const gmailNodes = nodes.filter(n => n.type === 'gmail');
    gmailNodes.forEach(gm => {
      const upstreamAgentId = findNearestUpstreamOfType(gm.id, 'agent');
      let emailAgentAlias = '';
      if (upstreamAgentId) {
        const ag = nodeById[upstreamAgentId];
        emailAgentAlias = renameAlias(ag, 'email_agent');
        // Suggest system prompt template for composing email if empty
        const agData = ag.data as Record<string, unknown>;
        if (!agData['systemPrompt']) {
          agData['systemPrompt'] = `You are an expert cold emailing assistant. Always return pure JSON with keys: recipient_email, subject, cc, bcc, body.`;
        }
        if (!agData['model']) {
          agData['model'] = 'google:gemini-2.5-flash';
        }
      }

      const gmData = gm.data as Record<string, unknown>;
      renameAlias(gm, 'gmail_node');
      if (!gmData['operation']) gmData['operation'] = 'send';
      if (emailAgentAlias) {
        if (!gmData['to']) gmData['to'] = `{{${emailAgentAlias}.recipient_email}}`;
        if (!gmData['subject']) gmData['subject'] = `{{${emailAgentAlias}.subject}}`;
        if (!gmData['body']) gmData['body'] = `{{${emailAgentAlias}.body}}`;
        if (!gmData['cc']) gmData['cc'] = `{{${emailAgentAlias}.cc}}`;
        if (!gmData['bcc']) gmData['bcc'] = `{{${emailAgentAlias}.bcc}}`;
      }
    });

    // 2) Gmail → Agent (summarizer): name as email_summ, wire prompts
    const agentNodes = nodes.filter(n => n.type === 'agent');
    agentNodes.forEach(ag => {
      const inc = incoming(ag.id);
      const hasGmailUpstream = inc.some(id => nodeById[id]?.type === 'gmail');
      if (hasGmailUpstream) {
        const alias = renameAlias(ag, 'email_summ');
        const agData = ag.data as Record<string, unknown>;
        if (!agData['systemPrompt']) {
          agData['systemPrompt'] = 'Summarize the email content and return pure JSON with key "summary". No markdown.';
        }
        // Prefer previous composer agent output if available
        const composer = agentNodes.find(n => n.id !== ag.id && outgoing(n.id).includes(gmailNodes[0]?.id || ''));
        const composerAlias = composer ? String((composer.data as any)?.alias || '') : '';
        if (!agData['userPrompt']) {
          agData['userPrompt'] = composerAlias ? `{{${composerAlias}.body}}` : '{{prev.data}}';
        }
        if (!agData['model']) {
          agData['model'] = 'google:gemini-2.5-flash';
        }
      }
    });

    // 3) Agent (summarizer) → Slack: name slack as slack_nf, wire message
    const slackNodes = nodes.filter(n => n.type === 'slack');
    slackNodes.forEach(sl => {
      const slData = sl.data as Record<string, unknown>;
      renameAlias(sl, 'slack_nf');
      if (!slData['operation']) slData['operation'] = 'send_message';
      // Try to find summarizer agent upstream
      const upstreamAgentId = findNearestUpstreamOfType(sl.id, 'agent');
      if (upstreamAgentId) {
        const a = nodeById[upstreamAgentId];
        const aAlias = String((a.data as any)?.alias || 'agent');
        if (!slData['message']) slData['message'] = `{{${aAlias}.summary}}`;
        if (!slData['messageFormat']) slData['messageFormat'] = 'json';
      } else {
        if (!slData['message']) slData['message'] = '{{prev.data}}';
      }
    });

    console.log('🎯 Final Result:', { 
      nodesCreated: nodes.length, 
      edgesCreated: edges.length,
      nodeTypes: nodes.map(n => n.type),
      connections: edges.map(e => `${e.source} -> ${e.target}`)
    });
    
    return { nodes, edges };
  }

  async chatWithContext(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    if (!openaiService.isConfigured()) {
      return "I'm sorry, but the OpenAI API is not configured. Please set up your API key to use the AI copilot.";
    }

    const systemPrompt = `You are an AI copilot for AGEN8, a visual workflow builder. You help users create, modify, and understand workflows.

Available capabilities:
- Create complete workflows from user descriptions
- Explain how workflows work
- Suggest improvements to existing workflows
- Help with block configuration
- Troubleshoot workflow issues

Available blocks: ${this.getAvailableBlocks().map(b => `${b.name} (${b.type})`).join(', ')}

Be helpful, concise, and practical. When users ask to create workflows, offer to build them automatically.`;

    try {
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversationHistory,
        { role: 'user' as const, content: message }
      ];

      const response = await openaiService.chat(messages, {
        temperature: 0.7,
        maxTokens: 800,
        model: 'gpt-4o-mini' // Use faster model
      });

      return response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error('Copilot chat error:', error);
      return `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
    }
  }

  async streamChatWithContext(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    onChunk: (content: string) => void
  ): Promise<void> {
    if (!openaiService.isConfigured()) {
      onChunk("I'm sorry, but the OpenAI API is not configured. Please set up your API key to use the AI copilot.");
      return;
    }

    const systemPrompt = `You are an AI copilot for AGEN8, a visual workflow builder. You help users create, modify, and understand workflows.

Available capabilities:
- Create complete workflows from user descriptions
- Explain how workflows work
- Suggest improvements to existing workflows
- Help with block configuration
- Troubleshoot workflow issues

Available blocks: ${this.getAvailableBlocks().map(b => `${b.name} (${b.type})`).join(', ')}

Be helpful, concise, and practical. When users ask to create workflows, offer to build them automatically.`;

    try {
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversationHistory,
        { role: 'user' as const, content: message }
      ];

      await openaiService.chatStream(messages, onChunk, {
        temperature: 0.7,
        maxTokens: 800, // Faster response
        model: 'gpt-4o-mini' // Use faster model
      });
    } catch (error) {
      console.error('Copilot stream chat error:', error);
      onChunk(`I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  }
}

export const copilotService = new CopilotService();