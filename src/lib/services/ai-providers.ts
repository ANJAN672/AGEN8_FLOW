interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: string;
  model: string;
  tokens: number;
  toolCalls?: unknown;
}

interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIProviderService {
  async callProvider(
    provider: string,
    model: string,
    messages: AIMessage[],
    config: AIProviderConfig = {},
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const { temperature = 0.7, maxTokens = 1000 } = config;

    // Parse provider and model
    const [providerName, modelName] = model.includes(':') 
      ? model.split(':', 2) 
      : ['openai', model];

    switch (providerName.toLowerCase()) {
      case 'openai':
        return this.callOpenAI(modelName, messages, config, abortSignal);
      
      case 'google':
        return this.callGoogle(modelName, messages, config, abortSignal);
      
      case 'mistral':
        return this.callMistral(modelName, messages, config, abortSignal);
      
      case 'azure':
        return this.callAzureOpenAI(modelName, messages, config, abortSignal);
      
      case 'ollama':
        return this.callOllama(modelName, messages, config, abortSignal);
      
      case 'anthropic':
        return this.callAnthropic(modelName, messages, config, abortSignal);
      
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }
  }

  private async callOpenAI(
    model: string,
    messages: AIMessage[],
    config: AIProviderConfig,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not provided. Please enter your API key in the node configuration.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.error?.message || error.message || response.statusText;
      
      // Provide more specific error messages for common issues
      if (response.status === 401) {
        throw new Error(`OpenAI API error: Invalid API key. Please check your API key.`);
      } else if (response.status === 429) {
        throw new Error(`OpenAI API error: Rate limit exceeded. Please try again later.`);
      } else if (response.status === 400 && errorMessage.includes('model')) {
        throw new Error(`OpenAI API error: Model "${model}" not found or not supported. Please check the model name.`);
      } else {
        throw new Error(`OpenAI API error: ${response.status} - ${errorMessage}`);
      }
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || 'No response',
      model: `openai:${model}`,
      tokens: data.usage?.total_tokens || 0,
      toolCalls: data.choices[0]?.message?.tool_calls,
    };
  }

  private async callGoogle(
    model: string,
    messages: AIMessage[],
    config: AIProviderConfig,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error('Google API key not provided. Please enter your API key in the node configuration.');
    }

    // Separate system message from other messages
    const systemMessage = messages.find(msg => msg.role === 'system');
    const userMessages = messages.filter(msg => msg.role !== 'system');

    // Convert messages to Google format (excluding system messages from contents)
    const contents = userMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Check if model supports systemInstruction
    const supportsSystemInstruction = model.includes('2.0-flash') || model.includes('2.0-flash-lite');
    
    // Use v1beta for all models to ensure compatibility
    const apiVersion = 'v1beta';
    
    const requestBody: {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      generationConfig: { temperature?: number; maxOutputTokens?: number };
      systemInstruction?: { parts: Array<{ text: string }> };
    } = {
      contents,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
      },
    };

    // Add system instruction only for supported models
    if (systemMessage && supportsSystemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage.content }]
      };
    } else if (systemMessage) {
      // For models that don't support systemInstruction, prepend system message to first user message
      if (contents.length > 0 && contents[0].role === 'user') {
        contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
      } else {
        // If no user messages, add system message as user message
        contents.unshift({
          role: 'user',
          parts: [{ text: systemMessage.content }]
        });
      }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.error?.message || error.message || response.statusText;
      
      // Provide more specific error messages for common issues
      if (response.status === 400 && errorMessage.includes('model')) {
        throw new Error(`Google API error: Model "${model}" not found or not supported. Please check the model name and try again.`);
      } else if (response.status === 403) {
        throw new Error(`Google API error: Invalid API key or insufficient permissions. Please check your API key.`);
      } else if (response.status === 429) {
        throw new Error(`Google API error: Rate limit exceeded. Please try again later.`);
      } else {
        throw new Error(`Google API error: ${response.status} - ${errorMessage}`);
      }
    }

    const data = await response.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response',
      model: `google:${model}`,
      tokens: data.usageMetadata?.totalTokenCount || 0,
    };
  }

  private async callMistral(
    model: string,
    messages: AIMessage[],
    config: AIProviderConfig,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error('Mistral API key not provided. Please enter your API key in the node configuration.');
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.error?.message || error.message || response.statusText;
      throw new Error(`Mistral API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || 'No response',
      model: `mistral:${model}`,
      tokens: data.usage?.total_tokens || 0,
    };
  }

  private async callAzureOpenAI(
    deploymentName: string,
    messages: AIMessage[],
    config: AIProviderConfig,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const apiKey = config.apiKey;
    const endpoint = config.baseUrl;
    const apiVersion = '2024-02-15-preview';

    if (!apiKey || !endpoint) {
      throw new Error('Azure OpenAI API key and endpoint not provided. Please enter your API key and endpoint in the node configuration.');
    }

    const response = await fetch(`${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.error?.message || error.message || response.statusText;
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || 'No response',
      model: `azure:${deploymentName}`,
      tokens: data.usage?.total_tokens || 0,
    };
  }

  private async callOllama(
    model: string,
    messages: AIMessage[],
    config: AIProviderConfig,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: config.temperature,
        },
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      content: data.message?.content || 'No response',
      model: `ollama:${model}`,
      tokens: data.eval_count || data.prompt_eval_count || 0,
    };
  }

  private async callAnthropic(
    model: string,
    messages: AIMessage[],
    config: AIProviderConfig,
    abortSignal?: AbortSignal
  ): Promise<AIResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error('Anthropic API key not provided. Please enter your API key in the node configuration.');
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages.filter(msg => msg.role !== 'system').map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Extract system message
    const systemMessage = messages.find(msg => msg.role === 'system');

    const requestBody: {
      model: string;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
      system?: string;
      temperature?: number;
    } = {
      model,
      max_tokens: config.maxTokens || 1000,
      messages: anthropicMessages,
      temperature: config.temperature,
    };

    if (systemMessage) {
      requestBody.system = systemMessage.content;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.error?.message || error.message || response.statusText;
      
      // Provide more specific error messages for common issues
      if (response.status === 401) {
        throw new Error(`Anthropic API error: Invalid API key. Please check your API key.`);
      } else if (response.status === 429) {
        throw new Error(`Anthropic API error: Rate limit exceeded. Please try again later.`);
      } else if (response.status === 400 && errorMessage.includes('model')) {
        throw new Error(`Anthropic API error: Model "${model}" not found or not supported. Please check the model name.`);
      } else {
        throw new Error(`Anthropic API error: ${response.status} - ${errorMessage}`);
      }
    }

    const data = await response.json();
    return {
      content: data.content?.[0]?.text || 'No response',
      model: `anthropic:${model}`,
      tokens: data.usage?.total_tokens || 0,
    };
  }
}

export const aiProviderService = new AIProviderService();