import { Bot } from 'lucide-react';
import { createElement } from 'react';
import type { FC } from 'react';
import { BlockConfig } from '../types';
import { aiProviderService } from '../services/ai-providers';

const BotIcon: FC<{ size?: number }> = ({ size }) => createElement(Bot, { size });

export const agentBlock: BlockConfig = {
  type: 'agent',
  name: 'AI Agent',
  description: 'Chat with AI models (OpenAI, Anthropic, Ollama)',
  longDescription: 'Send prompts to AI models and get responses. Supports OpenAI GPT models, Anthropic Claude, and local Ollama models.',
  category: 'blocks',
  bgColor: '#6366f1',
  icon: BotIcon,
  subBlocks: [
    {
      id: 'systemPrompt',
      title: 'System Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'You are a helpful assistant...',
      rows: 4,
      wandConfig: {
        enabled: true,
        generationType: 'system-prompt',
        prompt: 'Generate a system prompt for an AI assistant',
        placeholder: 'Describe what the AI should do...'
      }
    },
    {
      id: 'userPrompt',
      title: 'User Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Ask me anything...',
      rows: 3,
      required: true
    },
    {
      id: 'model',
      title: 'Model',
      type: 'combobox',
      layout: 'half',
      required: true,
      options: () => [
        // OpenAI (latest models first)
        { id: 'openai:gpt-5', label: 'OpenAI — GPT-5' },
        { id: 'openai:gpt-5-mini', label: 'OpenAI — GPT-5 Mini' },
        { id: 'openai:gpt-4.1', label: 'OpenAI — GPT-4.1' },
        { id: 'openai:gpt-4.1-mini', label: 'OpenAI — GPT-4.1 Mini' },
        { id: 'openai:gpt-4o', label: 'OpenAI — GPT-4o' },
        { id: 'openai:gpt-4o-mini', label: 'OpenAI — GPT-4o Mini' },
        { id: 'openai:gpt-4-turbo', label: 'OpenAI — GPT-4 Turbo' },
        { id: 'openai:gpt-4', label: 'OpenAI — GPT-4' },
        { id: 'openai:gpt-3.5-turbo', label: 'OpenAI — GPT-3.5 Turbo' },

        // Google (latest models first)
        { id: 'google:gemini-2.5-flash', label: 'Google — Gemini 2.5 Flash' },
        { id: 'google:gemini-2.5-pro', label: 'Google — Gemini 2.5 Pro' },
        { id: 'google:gemini-2.0-flash-exp', label: 'Google — Gemini 2.0 Flash Experimental' },
        { id: 'google:gemini-1.5-pro-002', label: 'Google — Gemini 1.5 Pro (002)' },
        { id: 'google:gemini-1.5-flash-002', label: 'Google — Gemini 1.5 Flash (002)' },
        { id: 'google:gemini-1.5-pro', label: 'Google — Gemini 1.5 Pro' },
        { id: 'google:gemini-1.5-flash', label: 'Google — Gemini 1.5 Flash' },
        { id: 'google:gemini-1.5-flash-8b', label: 'Google — Gemini 1.5 Flash 8B' },

        // Mistral (latest models first)
        { id: 'mistral:mistral-small-2503', label: 'Mistral — Small 3.1 (2503)' },
        { id: 'mistral:mistral-large-2407', label: 'Mistral — Large 2.1 (2407)' },
        { id: 'mistral:codestral-latest', label: 'Mistral — Codestral' },
        { id: 'mistral:mistral-large-latest', label: 'Mistral — Large (latest)' },
        { id: 'mistral:mistral-small-latest', label: 'Mistral — Small (latest)' },
        { id: 'mistral:open-mixtral-8x7b', label: 'Mistral — Mixtral 8x7B Instruct' },
        { id: 'mistral:open-mixtral-8x22b', label: 'Mistral — Mixtral 8x22B Instruct' },

        // Anthropic (latest models first)
        { id: 'anthropic:claude-opus-4-1-20250805', label: 'Anthropic — Claude Opus 4.1' },
        { id: 'anthropic:claude-3-7-sonnet-20250219', label: 'Anthropic — Claude 3.7 Sonnet' },
        { id: 'anthropic:claude-3-5-haiku-20241022', label: 'Anthropic — Claude 3.5 Haiku' },
        { id: 'anthropic:claude-3-5-sonnet-20241022', label: 'Anthropic — Claude 3.5 Sonnet' },
        { id: 'anthropic:claude-3-opus-20240229', label: 'Anthropic — Claude 3 Opus' },

        // Azure OpenAI (use deployment name via id after prefix)
        { id: 'azure:gpt-5', label: 'Azure OpenAI — GPT-5 (deployment)' },
        { id: 'azure:gpt-4.1', label: 'Azure OpenAI — GPT-4.1 (deployment)' },
        { id: 'azure:gpt-4o', label: 'Azure OpenAI — GPT-4o (deployment)' },
        { id: 'azure:gpt-4o-mini', label: 'Azure OpenAI — GPT-4o Mini (deployment)' },
        { id: 'azure:gpt-4-turbo', label: 'Azure OpenAI — GPT-4 Turbo (deployment)' },

        // Local (kept at end)
        { id: 'ollama:llama3.3', label: 'Ollama — Llama 3.3' },
        { id: 'ollama:llama3.2', label: 'Ollama — Llama 3.2' },
        { id: 'ollama:llama3.1', label: 'Ollama — Llama 3.1' },
        { id: 'ollama:qwen2.5', label: 'Ollama — Qwen 2.5' },
        { id: 'ollama:deepseek-r1', label: 'Ollama — DeepSeek R1' },
        { id: 'ollama:gemma2', label: 'Ollama — Gemma 2' },
        { id: 'ollama:mistral', label: 'Ollama — Mistral' }
      ]
    },
    {
      id: 'temperature',
      title: 'Temperature',
      type: 'slider',
      layout: 'half',
      min: 0,
      max: 2,
      step: 0.1
    },
    {
      id: 'maxTokens',
      title: 'Max Tokens',
      type: 'number',
      layout: 'half',
      placeholder: '4000'
    },
    {
      id: 'apiKey',
      title: 'API Key',
      type: 'short-input',
      layout: 'half',
      password: true,
      placeholder: 'Required: Your API key for the selected provider',
      required: true,
      condition: {
        field: 'model',
        value: 'ollama',
        not: true
      }
    },
    {
      id: 'endpoint',
      title: 'Endpoint (Azure only)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'https://your-resource.openai.azure.com',
      condition: {
        field: 'model',
        value: 'azure',
        operator: 'startsWith'
      }
    },
    {
      id: 'responseFormat',
      title: 'Response Format',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{"type": "object", "properties": {...}}',
      wandConfig: {
        enabled: true,
        generationType: 'json-schema',
        prompt: 'Generate a JSON schema for the expected response format',
        placeholder: 'Describe the expected response structure...'
      }
    }
  ],
  inputs: {
    systemPrompt: { type: 'string', description: 'System instructions for the AI' },
    userPrompt: { type: 'string', description: 'User message to send' },
    model: { type: 'string', description: 'Model to use' },
    temperature: { type: 'number', description: 'Creativity level (0-2)' },
    maxTokens: { type: 'number', description: 'Maximum tokens in response' },
    apiKey: { type: 'string', description: 'API key for the service' },
    endpoint: { type: 'string', description: 'Endpoint URL (for Azure)' },
    responseFormat: { type: 'json', description: 'Expected response format' }
  },
  outputs: {
    content: { type: 'string', description: 'AI response content' },
    model: { type: 'string', description: 'Model used' },
    tokens: { type: 'number', description: 'Tokens used' },
    toolCalls: { type: 'json', description: 'Tool calls made by AI' }
  },
  async run(ctx) {
    const { systemPrompt, userPrompt, model, temperature = 0.7, maxTokens = 4000, apiKey, endpoint, responseFormat } = ctx.inputs;
    
    const modelStr = String(model ?? '');
    
    // Prepare messages
    const messages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: String(systemPrompt) }] : []),
      { role: 'user' as const, content: String(userPrompt) }
    ];

    // Add response format instruction if provided
    if (responseFormat && typeof responseFormat === 'string' && responseFormat.trim()) {
      const formatStr = responseFormat.trim();
      
      // Skip empty objects, null strings, etc.
      if (formatStr !== '{}' && formatStr !== 'null' && formatStr !== 'undefined' && formatStr !== '') {
        try {
          let format;
          
          // Try to parse as JSON if it looks like JSON
          if (formatStr.startsWith('{') || formatStr.startsWith('[')) {
            format = JSON.parse(formatStr);
            // Skip empty objects
            if (typeof format === 'object' && Object.keys(format).length === 0) {
              return; // Don't add format instruction for empty objects
            }
          } else {
            // Treat as plain text description
            format = formatStr;
          }
          
          if (format) {
            const formatInstruction = typeof format === 'object' 
              ? `\n\nPlease respond with valid JSON that matches this schema: ${JSON.stringify(format)}`
              : `\n\nPlease format your response according to: ${format}`;
              
            if (messages[0]?.role === 'system') {
              messages[0].content += formatInstruction;
            } else {
              messages.unshift({ role: 'system', content: `You are a helpful assistant.${formatInstruction}` });
            }
          }
        } catch (e) {
          // Only log if there was actual content that failed to parse
          if (formatStr.length > 2) {
            ctx.log(`⚠️ Response format parsing failed: ${e instanceof Error ? e.message : 'Invalid JSON'}`);
          }
          // Continue execution - don't fail the entire node for format issues
        }
      }
    }

    try {
      const result = await aiProviderService.callProvider(
        modelStr,
        modelStr,
        messages,
        {
          apiKey,
          baseUrl: endpoint,
          temperature: Number(temperature),
          maxTokens: Number(maxTokens) || 4000
        },
        ctx.abortSignal
      );
      
      // Clean up the content - comprehensive formatting cleanup
      let cleanContent = result.content || '';
      
      // Remove "text " prefix if present
      if (cleanContent.startsWith('text ')) {
        cleanContent = cleanContent.substring(5);
      }
      
      // Format content for better readability
      cleanContent = cleanContent
        // Remove markdown bold formatting
        .replace(/\*\*(.*?)\*\*/g, '$1')
        // Remove markdown italic formatting  
        .replace(/\*(.*?)\*/g, '$1')
        // Clean up quotes
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        // Remove bullet points and list formatting
        .replace(/^\s*[*\-+]\s+/gm, '')
        // Clean up excessive punctuation
        .replace(/\*{2,}/g, '')
        .replace(/_{2,}/g, '')
        // Fix spacing
        .replace(/\s+/g, ' ')
        .trim();
      
      // Debug log to see what we got
      ctx.log(`📤 AI Response: ${cleanContent || 'No content'}`);
      
      ctx.setNodeOutput('content', cleanContent);
      ctx.setNodeOutput('model', result.model);
      ctx.setNodeOutput('tokens', result.tokens);
      if (result.toolCalls) {
        ctx.setNodeOutput('toolCalls', result.toolCalls);
      }

      // If the AI returned JSON (common for structured outputs), expose keys as outputs for easy templating
      try {
        const parsed = JSON.parse(cleanContent);
        if (parsed && typeof parsed === 'object') {
          ctx.setNodeOutput('json', parsed);
          for (const [k, v] of Object.entries(parsed)) {
            // Avoid clobbering existing outputs
            if (k === 'content' || k === 'model' || k === 'tokens' || k === 'toolCalls') continue;
            ctx.setNodeOutput(k, v as unknown);
          }
        }
      } catch {}
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ctx.log(`❌ API error: ${errorMessage}`);
      
      // Throw the error to stop workflow execution
      throw new Error(`AI model call failed: ${errorMessage}`);
    }
  }
};