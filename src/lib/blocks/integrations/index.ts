import { Plug, Database, FileText, Bot, Mail, Calendar, Users, Github, Search, Image, Phone, MessageSquare, Globe, Video, Zap } from 'lucide-react';
import { createElement } from 'react';
import type { FC } from 'react';
import { BlockConfig, RunContext } from '../../types';

// Import the new reactive channel manager
import { slackChannelManager, setSlackChannels, getSlackChannels, hasSlackChannels } from '../../realtime/SlackChannelManager';
import { createAutoLoadingSlackChannelOptions } from '../../realtime/ReactiveSlackOptions';

// Legacy cache for backward compatibility (will be migrated)
const slackChannelCache = new Map<string, Array<{ id: string; label: string }>>();
let channelCacheVersion = 0;
let lastChannelUpdate = 0;

// Simple function to get all cached channels with cache-busting
const getAllCachedChannels = (): Array<{ id: string; label: string }> => {
  // Use new reactive manager first, fallback to legacy cache
  const reactiveChannels = getSlackChannels();
  if (reactiveChannels.length > 0) {
    return reactiveChannels;
  }
  
  const allChannels: Array<{ id: string; label: string }> = [];
  
  for (const [token, channels] of slackChannelCache.entries()) {
    if (channels && channels.length > 0) {
      allChannels.push(...channels);
    }
  }
  
  return allChannels;
};

// Custom SVG logo component for integration blocks
const createSvgIcon = (logoUrl: string, fallbackIcon = Plug): FC<{ size?: number }> => {
  return ({ size = 24 }) => createElement('img', {
    src: logoUrl,
    alt: 'Logo',
    width: size,
    height: size,
    style: { objectFit: 'contain' }
  });
};

// Common integration configuration
const createIntegrationBlock = (
  type: string,
  name: string,
  description: string,
  logoUrl?: string,
  fallbackIcon = Plug,
  additionalFields: Array<{
    id: string;
    title: string;
    type: 'short-input' | 'long-input' | 'code' | 'slider' | 'combobox' | 'tool-input' | 'toggle' | 'number' | 'datetime';
    layout: 'full' | 'half';
    placeholder?: string;
    required?: boolean;
    options?: () => Array<{ id: string; label: string }>;
    rows?: number;
    language?: 'json' | 'typescript' | 'javascript' | 'text';
  }> = []
): BlockConfig => ({
  type,
  name,
  description,
  category: 'integrations',
  bgColor: '#ec4899', // Pink for integrations
  icon: logoUrl ? createSvgIcon(logoUrl, fallbackIcon) : (({ size }) => createElement(fallbackIcon, { size })) as FC<{ size?: number }>,
  subBlocks: [
    {
      id: 'purpose',
      title: 'Purpose',
      type: 'combobox',
      layout: 'full',
      options: () => [
        { id: 'auto', label: 'Auto (minimal check)' },
        { id: 'whoami', label: 'Who Am I / Verify Credentials' },
        { id: 'list', label: 'List (resources/records)' },
        { id: 'get', label: 'Get (by id)' },
        { id: 'create', label: 'Create' },
        // OAuth/email related purposes
        { id: 'oauthStart', label: 'OAuth: Start (get consent URL)' },
        { id: 'oauthExchange', label: 'OAuth: Exchange Code for Tokens' },
        { id: 'send', label: 'Send (e.g., email)' }
      ]
    },
    {
      id: 'apiKey',
      title: 'API Key',
      type: 'short-input',
      layout: 'full',
      password: true,
      placeholder: `Enter your ${name} API key`,
      required: true
    },
    {
      id: 'endpoint',
      title: 'Endpoint URL (optional, overrides default for purpose)',
      type: 'short-input',
      layout: 'full',
      placeholder: `${name} API endpoint`
    },
    {
      id: 'skipLiveCheck',
      title: 'Skip Live Check',
      type: 'toggle',
      layout: 'half'
    },
    ...additionalFields
  ],
  inputs: {
    purpose: { type: 'string', description: 'Selected purpose for this integration' },
    apiKey: { type: 'string', description: 'API key for authentication' },
    endpoint: { type: 'string', description: 'Custom endpoint URL (overrides default for purpose)' },
    skipLiveCheck: { type: 'any', description: 'Skip live API credential check' }
  },
  outputs: {
    data: { type: 'json', description: 'Response data from the service' },
    status: { type: 'string', description: 'Request status' }
  },
  async run(ctx) {
    const inputs = ctx.inputs as Record<string, unknown>;

    // Decide behavior: real calls by default; default purpose to 'whoami' for easy verification
    const purpose = String(inputs.purpose ?? 'whoami');
    const endpointOverride = String(inputs.endpoint ?? '').trim();
    const skipLiveCheck = Boolean(inputs.skipLiveCheck); // false by default = perform real call
    const resolvedPurpose = purpose === 'auto' ? 'whoami' : purpose

    // Provider type is this block's type
    const providerType = String((ctx as any)?.blockType || (ctx as any)?.inputs?.type || (ctx as any)?.nodeType || '').trim() || type;

    // OAuth/email flows might not need an API key (e.g., Gmail with OAuth)
    const apiKey = String(inputs.apiKey ?? '').trim();
    const isOAuthFlow = ['oauthStart', 'oauthExchange', 'send'].includes(resolvedPurpose);

    // 1) Basic API key validation (only enforce for real calls and non-OAuth flows)
    if (!isOAuthFlow && (!skipLiveCheck || (purpose && purpose !== 'auto' && purpose !== 'whoami'))) {
      if (!apiKey) {
        throw new Error(`${name} API key is required`);
      }
      // reject too-short or numeric-only keys
      const numericOnly = /^[0-9]+$/.test(apiKey);
      if (apiKey.length < 10 || numericOnly) {
        throw new Error(`${name}: Invalid API key format`);
      }
    }

    // 2) Validate required additional fields are present and non-empty
    // Enforce for all non-whoami purposes in real mode
    if (!skipLiveCheck && purpose !== 'whoami') {
      for (const field of additionalFields) {
        if (field.required) {
          const v = inputs[field.id];
          if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
            throw new Error(`${name}: Missing required field '${field.title}'`);
          }
        }
      }
    }

    // 3) Optional live endpoint check or purpose-driven call (values already set above)

    // Define sensible defaults per provider/purpose
    const defaultEndpoints: Record<string, Record<string, { url: (inps: Record<string, unknown>) => string; method?: string }>> = {
      airtable: {
        whoami: { url: () => 'https://api.airtable.com/v0/meta/whoami' },
        list: { url: (i) => `https://api.airtable.com/v0/${i.baseId}/${i.tableId}`, method: 'GET' },
        get: { url: (i) => `https://api.airtable.com/v0/${i.baseId}/${i.tableId}/${i.recordId}`, method: 'GET' },
        create: { url: (i) => `https://api.airtable.com/v0/${i.baseId}/${i.tableId}`, method: 'POST' },
      },
      github: {
        whoami: { url: () => 'https://api.github.com/user' },
        list: { url: () => 'https://api.github.com/user/repos', method: 'GET' },
        get: { url: (i) => `https://api.github.com/repos/${i.repository}`, method: 'GET' },
        create: { url: () => 'https://api.github.com/user/repos', method: 'POST' },
      },
      notion: {
        whoami: { url: () => 'https://api.notion.com/v1/users/me' },
        list: { url: () => 'https://api.notion.com/v1/search', method: 'POST' },
      },
      slack: {
        whoami: { url: () => 'https://slack.com/api/auth.test' },
        list: { url: () => 'https://slack.com/api/conversations.list' },
      },
      discord: {
        whoami: { url: () => 'https://discord.com/api/users/@me' },
      },
      webhook: {
        create: { url: (i) => String(i.url || i.endpoint || ''), method: 'POST' },
      },
    };

    const defaultProvider = defaultEndpoints[providerType] || {};
    const def = defaultProvider[resolvedPurpose as keyof typeof defaultProvider] as { url?: (inps: Record<string, unknown>) => string; method?: string } | undefined;
    let checkUrl = endpointOverride;
    let method: string = 'GET';
    if (!checkUrl && def?.url) {
      const u = def.url(inputs);
      if (u) checkUrl = u;
      if (typeof def.method === 'string') method = def.method;
    }

    if (!skipLiveCheck) {
      try {
        // Build final URL/method using defaults if not provided
        let checkUrlFinal = checkUrl;
        let methodFinal = method;
        if (!checkUrlFinal) {
          const provider = defaultEndpoints[providerType] || {};
          const def2 = provider[resolvedPurpose as keyof typeof provider] as { url?: (inps: Record<string, unknown>) => string; method?: string } | undefined;
          if (def2?.url) checkUrlFinal = def2.url(inputs);
          if (def2?.method) methodFinal = def2.method;
        }

        if (!checkUrlFinal) {
          throw new Error(`${name}: Missing endpoint. Provide 'endpoint' or required ids for '${resolvedPurpose}'.`);
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        // Provider-specific auth header styles
        if (providerType === 'airtable' || providerType === 'github' || providerType === 'notion') {
          headers.Authorization = `Bearer ${apiKey}`;
        } else if (providerType === 'slack' || providerType === 'discord') {
          headers.Authorization = `Bot ${apiKey}`;
        } else {
          headers.Authorization = `Bearer ${apiKey}`;
        }
        if (providerType === 'notion') {
          headers['Notion-Version'] = '2022-06-28';
        }

        const res = await ctx.fetch(checkUrlFinal, { method: methodFinal, headers });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          if (providerType === 'airtable' && res.status === 404) {
            const hint = resolvedPurpose === 'list' ? "Check Base ID (starts with 'app') and Table ID (starts with 'tbl'), and that your API key has access." :
                         resolvedPurpose === 'get' ? "Check Base ID ('app...'), Table ID ('tbl...') and Record ID ('rec...'). The record must exist." :
                         resolvedPurpose === 'create' ? "Check Base ID ('app...') and Table ID ('tbl...'). Table must exist and key must have write access." :
                         "Check your endpoint and credentials.";
            throw new Error(`${name}: Credential/endpoint check failed (status ${res.status}) - ${text || 'NOT_FOUND'}. ${hint}`);
          }
          throw new Error(`${name}: Credential/endpoint check failed (status ${res.status})${text ? ` - ${text}` : ''}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`${name}: Endpoint check error - ${msg}`);
      }
    }

    ctx.log(`Executing ${name} integration`);

    // Perform real calls for Airtable based on purpose when not skipping live check
    if (!skipLiveCheck && providerType === 'airtable') {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };

      let url = checkUrl;
      let methodToUse = method;
      const p = resolvedPurpose;
      if (!url) {
        if (p === 'whoami') {
          url = 'https://api.airtable.com/v0/meta/whoami';
          methodToUse = 'GET';
        } else if (p === 'list') {
          const baseId = String(inputs.baseId || '').trim();
          const tableId = String(inputs.tableId || '').trim();
          if (!baseId || !tableId) throw new Error('Airtable: baseId and tableId are required for list');
          url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
          methodToUse = 'GET';
        } else if (p === 'get') {
          const baseId = String(inputs.baseId || '').trim();
          const tableId = String(inputs.tableId || '').trim();
          const recordId = String((inputs as any).recordId || '').trim();
          if (!baseId || !tableId || !recordId) throw new Error('Airtable: baseId, tableId and recordId are required for get');
          url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
          methodToUse = 'GET';
        } else if (p === 'create') {
          const baseId = String(inputs.baseId || '').trim();
          const tableId = String(inputs.tableId || '').trim();
          let fields = (inputs as any).fields ?? {};
          if (typeof fields === 'string') {
            try { fields = JSON.parse(fields); } catch {}
          }
          if (!baseId || !tableId) throw new Error('Airtable: baseId and tableId are required for create');
          url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
          methodToUse = 'POST';
          // attach to inputs for request later
          (inputs as any).__body = JSON.stringify({ records: Array.isArray(fields) ? fields : [{ fields }] });
        }
      }

      if (!url) throw new Error('Airtable: Unable to determine endpoint');

      const reqInit: RequestInit = { method: methodToUse, headers };
      if (methodToUse !== 'GET' && (inputs as any).__body) reqInit.body = (inputs as any).__body;

      const res = await ctx.fetch(url, reqInit);
      const contentType = res.headers.get('content-type');
      const data = contentType?.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        throw new Error(`Airtable request failed (${res.status}) ${typeof data === 'string' ? data : ''}`);
      }

      // Flatten useful fields to top-level outputs for easy templating via aliases
      try {
        if (purpose === 'whoami' && data && typeof data === 'object') {
          const id = (data as any).id;
          const email = (data as any).email;
          if (id) ctx.setNodeOutput('id', id);
          if (email) ctx.setNodeOutput('email', email);
        } else if (purpose === 'list' && data && typeof data === 'object') {
          const records = Array.isArray((data as any).records) ? (data as any).records : [];
          ctx.setNodeOutput('records', records);
          ctx.setNodeOutput('count', records.length);
        } else if (purpose === 'get' && data && typeof data === 'object') {
          const rec = data as any;
          if (rec.id) ctx.setNodeOutput('id', rec.id);
          if (rec.fields) ctx.setNodeOutput('fields', rec.fields);
          if (rec.createdTime) ctx.setNodeOutput('createdTime', rec.createdTime);
        } else if (purpose === 'create' && data && typeof data === 'object') {
          const records = Array.isArray((data as any).records) ? (data as any).records : [];
          ctx.setNodeOutput('records', records);
          const createdIds = records.map((r: any) => r?.id).filter(Boolean);
          if (createdIds.length) ctx.setNodeOutput('createdIds', createdIds);
        }
      } catch {}

      const result = { data, status: 'success' as const };
      ctx.setNodeOutput('data', result.data);
      ctx.setNodeOutput('status', result.status);

      // Pretty-print Airtable response in logs so users can reuse outputs easily
      try {
        const pretty = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        ctx.log(`📦 Airtable ${purpose} response:\n${pretty}`);
      } catch {}

      return result;
    }

    // Default behavior: if skipping live check or other providers, just acknowledge without mocks
    const result = {
      data: { ok: true, provider: type, purpose, skippedLiveCheck: skipLiveCheck, endpoint: checkUrl || 'default' },
      status: 'success' as const,
    };

    ctx.setNodeOutput('data', result.data);
    ctx.setNodeOutput('status', result.status);

    return result;
  }
});

// Define all integration blocks
export const airtableBlock = createIntegrationBlock(
  'airtable',
  'Airtable',
  'Connect to Airtable bases and tables',
  'https://www.vectorlogo.zone/logos/airtable/airtable-icon.svg',
  Database,
  [
    {
      id: 'baseId',
      title: 'Base ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'app1234567890',
      required: true
    },
    {
      id: 'tableId',
      title: 'Table ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'tbl1234567890',
      required: true
    },
    {
      id: 'recordId',
      title: 'Record ID (for Get)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'recXXXXXXXXXXXX'
    },
    {
      id: 'fields',
      title: 'Fields (for Create) - JSON object or array of records',
      type: 'long-input',
      layout: 'full',
      placeholder: '{ "Name": "John" }',
      rows: 6,
      language: 'json'
    }
  ]
);

export const arxivBlock = createIntegrationBlock(
  'arxiv',
  'ArXiv',
  'Search and retrieve academic papers from ArXiv',
  'https://arxiv.org/favicon.ico',
  FileText,
  [
    {
      id: 'query',
      title: 'Search Query',
      type: 'short-input',
      layout: 'full',
      placeholder: 'machine learning',
      required: true
    },
    {
      id: 'maxResults',
      title: 'Max Results',
      type: 'short-input',
      layout: 'half',
      placeholder: '10'
    }
  ]
);

export const browserUseBlock = createIntegrationBlock(
  'browseruse',
  'BrowserUse',
  'Automate browser interactions and web scraping',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/googlechrome.svg',
  Globe
);

export const clayBlock = createIntegrationBlock(
  'clay',
  'Clay',
  'Connect to Clay for data enrichment and workflows',
  '/clay-logo.png',
  Database
);

export const confluenceBlock = createIntegrationBlock(
  'confluence',
  'Confluence',
  'Access and manage Confluence pages and spaces',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/confluence.svg',
  FileText,
  [
    {
      id: 'domain',
      title: 'Confluence Domain',
      type: 'short-input',
      layout: 'full',
      placeholder: 'your-domain.atlassian.net',
      required: true
    }
  ]
);

export const discordBlock = createIntegrationBlock(
  'discord',
  'Discord',
  'Send messages and manage Discord servers',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/discord.svg',
  MessageSquare,
  [
    {
      id: 'webhookUrl',
      title: 'Webhook URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Discord webhook URL'
    }
  ]
);

export const elevenLabsBlock = createIntegrationBlock(
  'elevenlabs',
  'ElevenLabs',
  'Generate speech with AI voices',
  'https://elevenlabs.io/favicon.ico',
  Bot,
  [
    {
      id: 'voiceId',
      title: 'Voice ID',
      type: 'short-input',
      layout: 'half',
      placeholder: '21m00Tcm4TlvDq8ikWAM'
    },
    {
      id: 'model',
      title: 'Model',
      type: 'combobox',
      layout: 'half',
      options: () => [
        { id: 'eleven_multilingual_v2', label: 'Multilingual v2' },
        { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5' }
      ]
    }
  ]
);

export const exaBlock = createIntegrationBlock(
  'exa',
  'Exa',
  'Search the web with AI-powered search engine',
  '/exa-logo.png',
  Search
);

export const fileBlock = createIntegrationBlock(
  'file',
  'File',
  'Read and write files from various sources',
  undefined,
  FileText,
  [
    {
      id: 'filePath',
      title: 'File Path',
      type: 'short-input',
      layout: 'full',
      placeholder: '/path/to/file.txt',
      required: true
    },
    {
      id: 'operation',
      title: 'Operation',
      type: 'combobox',
      layout: 'half',
      options: () => [
        { id: 'read', label: 'Read' },
        { id: 'write', label: 'Write' },
        { id: 'append', label: 'Append' }
      ]
    }
  ]
);

export const firecrawlBlock = createIntegrationBlock(
  'firecrawl',
  'Firecrawl',
  'Scrape and crawl websites with AI',
  'https://firecrawl.dev/favicon.ico',
  Globe,
  [
    {
      id: 'url',
      title: 'URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://example.com',
      required: true
    }
  ]
);

export const githubBlock = createIntegrationBlock(
  'github',
  'GitHub',
  'Interact with GitHub repositories and issues',
  'https://www.vectorlogo.zone/logos/github/github-icon.svg',
  Github,
  [
    {
      id: 'repository',
      title: 'Repository',
      type: 'short-input',
      layout: 'full',
      placeholder: 'owner/repo',
      required: true
    }
  ]
);

// Dedicated Gmail block with OAuth 2.0 support
export const gmailBlock: BlockConfig = {
  type: 'gmail',
  name: 'Gmail',
  description: 'Send emails using Gmail with seamless OAuth 2.0 authentication',
  category: 'integrations',
  bgColor: '#ea4335', // Gmail red
  icon: createSvgIcon('https://www.vectorlogo.zone/logos/gmail/gmail-icon.svg', Mail),
  subBlocks: [
    {
      id: 'operation',
      title: 'Operation',
      type: 'combobox',
      layout: 'full',
      options: () => [
        { id: 'send', label: 'Send Email' },
        { id: 'draft', label: 'Create Draft' },
        { id: 'list', label: 'List Messages' }
      ],
      required: true
    },
    {
      id: 'clientId',
      title: 'OAuth Client ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com',
      required: true
    },
    {
      id: 'clientSecret',
      title: 'OAuth Client Secret',
      type: 'short-input',
      layout: 'full',
      placeholder: 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET',
      password: true,
      required: true
    },
    {
      id: 'gmailAuth',
      title: 'Gmail Authentication',
      type: 'tool-input' as any, // Custom field type for Gmail auth
      layout: 'full',
      placeholder: 'Click to authenticate with Google'
    },
    {
      id: 'to',
      title: 'To',
      type: 'short-input',
      layout: 'full',
      placeholder: 'recipient@example.com',
      required: true
    },
    {
      id: 'cc',
      title: 'CC (optional)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'cc@example.com'
    },
    {
      id: 'bcc',
      title: 'BCC (optional)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'bcc@example.com'
    },
    {
      id: 'subject',
      title: 'Subject',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Email subject',
      required: true
    },
    {
      id: 'body',
      title: 'Email Body',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Write your email content here...\n\nSupports HTML formatting and template variables like {{prev.data}}',
      rows: 6
    },
    {
      id: 'isHtml',
      title: 'HTML Format',
      type: 'toggle',
      layout: 'half'
    },
    {
      id: 'maxResults',
      title: 'Max Results (for List operation)',
      type: 'number',
      layout: 'half',
      placeholder: '10',
      condition: { field: 'operation', value: 'list' }
    },
    {
      id: 'skipLiveCheck',
      title: 'Skip Live Check (Mock Mode)',
      type: 'toggle',
      layout: 'half'
    }
  ],
  inputs: {
    operation: { type: 'string', description: 'Gmail operation to perform' },
    clientId: { type: 'string', description: 'OAuth 2.0 Client ID' },
    clientSecret: { type: 'string', description: 'OAuth 2.0 Client Secret' },
    to: { type: 'string', description: 'Recipient email address' },
    cc: { type: 'string', description: 'CC email addresses (comma-separated)' },
    bcc: { type: 'string', description: 'BCC email addresses (comma-separated)' },
    subject: { type: 'string', description: 'Email subject' },
    body: { type: 'string', description: 'Email body content' },
    isHtml: { type: 'any', description: 'Whether the email body is HTML formatted' },
    maxResults: { type: 'number', description: 'Maximum number of messages to retrieve' },
    skipLiveCheck: { type: 'any', description: 'Skip live API check and run in mock mode' }
  },
  outputs: {
    messageId: { type: 'string', description: 'Gmail message ID' },
    threadId: { type: 'string', description: 'Gmail thread ID' },
    status: { type: 'string', description: 'Operation status' },
    data: { type: 'json', description: 'Full response from Gmail API' },
    messages: { type: 'json', description: 'List of messages (for list operation)' },
    userEmail: { type: 'string', description: 'Authenticated user email' }
  },
  async run(ctx) {
    const inputs = ctx.inputs as Record<string, unknown>;
    const operation = String(inputs.operation || 'send');
    const skipLiveCheck = Boolean(inputs.skipLiveCheck);
    
    ctx.log(`🔄 Gmail ${operation} operation starting...`);
    
    // If skip live check is enabled, run in mock mode
    if (skipLiveCheck) {
      ctx.log('⚠️ Running in mock mode (Skip Live Check enabled)');
      return await runGmailMockMode(ctx, inputs, operation);
    }
    
    try {
      // Import Gmail services dynamically to avoid issues during build
      const { gmailAuth } = await import('../../services/gmailAuth');
      const { gmailApi } = await import('../../services/gmailApi');
      
      // Get credentials
      const clientId = String(inputs.clientId || '').trim();
      const clientSecret = String(inputs.clientSecret || '').trim();
      
      if (!clientId || !clientSecret) {
        throw new Error('OAuth Client ID and Client Secret are required. Enable "Skip Live Check" to test without authentication.');
      }
      
      // Initialize Gmail auth service
      gmailAuth.initialize({ clientId, clientSecret });
      
      // Check if user is authenticated
      if (!gmailAuth.isAuthenticated()) {
        ctx.log('⚠️ User not authenticated. Please sign in with Google first.');
        return {
          status: 'auth_required',
          message: 'Gmail authentication required. Please click the "Authenticate with Google" button in the node configuration to sign in.',
          authRequired: true,
          data: null
        };
      }
      
      // Initialize Gmail API with the auth service
      gmailApi.initialize(gmailAuth);
      
      // Get user info for logging and proper email headers
      let userInfo;
      try {
        userInfo = await gmailApi.getUserInfo();
        ctx.log(`✅ Authenticated as: ${userInfo.name} (${userInfo.email})`);
        ctx.log(`📧 Emails will be sent from: ${userInfo.name} <${userInfo.email}>`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        ctx.log(`⚠️ Authentication issue: ${errorMsg}`);
        
        // Try fallback methods to get user info
        let fallbackUserInfo = null;
        try {
          // Try to get email from token info
          const accessToken = await gmailAuth.getAccessToken();
          const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
          if (response.ok) {
            const tokenInfo = await response.json();
            if (tokenInfo.email) {
              // Extract name from email
              const emailPart = tokenInfo.email.split('@')[0];
              const extractedName = emailPart
                .replace(/[._-]/g, ' ')
                .split(' ')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ') || 'Gmail User';
              
              fallbackUserInfo = {
                email: tokenInfo.email,
                name: extractedName,
                picture: ''
              };
              ctx.log(`🔄 Fallback: Using ${fallbackUserInfo.name} <${fallbackUserInfo.email}> from token info`);
            }
          }
        } catch (fallbackError) {
          ctx.log('⚠️ Could not get fallback user info either');
        }
        
        // For send operations, we can try to proceed with fallback or default info
        if ((operation === 'send' || operation === 'draft') && gmailAuth.isAuthenticated()) {
          ctx.log('⚠️ Proceeding with operation using fallback user info...');
          userInfo = fallbackUserInfo || { email: 'unknown@gmail.com', name: 'Gmail User', picture: '' };
        } else {
          // Return a more helpful error response
          return {
            status: 'auth_error',
            message: 'Gmail authentication failed. Please re-authenticate using the Gmail Auth button in the node configuration.',
            error: errorMsg,
            authRequired: true,
            data: null
          };
        }
      }
      
      switch (operation) {
        case 'send':
          return await performSendEmail(ctx, inputs, gmailApi, userInfo.email);
        case 'draft':
          return await performCreateDraft(ctx, inputs, gmailApi, userInfo.email);
        case 'list':
          return await performListMessages(ctx, inputs, gmailApi, userInfo.email);
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ctx.log(`❌ Gmail operation failed: ${errorMessage}`);
      throw error;
    }
  }
};

// Helper function to run Gmail in mock mode (for testing without authentication)
async function runGmailMockMode(ctx: any, inputs: Record<string, unknown>, operation: string) {
  let to = String(inputs.to || '').trim();
  let cc = String(inputs.cc || '').trim();
  let bcc = String(inputs.bcc || '').trim();
  let subject = String(inputs.subject || '').trim();
  let body = String(inputs.body || '').trim();
  const isHtml = Boolean(inputs.isHtml);
  
  // Debug: Log what we received
  ctx.log(`🔍 Debug - Raw inputs received:`);
  ctx.log(`   to: "${to}"`);
  ctx.log(`   subject: "${subject}"`);
  ctx.log(`   body: "${body ? body.substring(0, 50) + '...' : '(empty)'}"`);
  
  // Auto-fix: If fields are empty but we have template variables, try to resolve from previous node
  if ((!to || !subject) && ctx.getNodeOutput) {
    ctx.log('🔧 Attempting auto-fix: Looking for email data in previous nodes...');
    
    // Try to get outputs from all previous nodes
    const allOutputs = ctx.getNodeOutput('*') || {};
    ctx.log(`🔍 Available node outputs: ${Object.keys(allOutputs).join(', ')}`);
    
    for (const [nodeId, outputs] of Object.entries(allOutputs)) {
      if (outputs && typeof outputs === 'object') {
        const nodeOutputs = outputs as Record<string, unknown>;
        ctx.log(`🔍 Checking node ${nodeId}: ${Object.keys(nodeOutputs).join(', ')}`);
        
        // Look for email fields in this node's outputs
        if (!to && (nodeOutputs.recipient_email || nodeOutputs.to)) {
          to = String(nodeOutputs.recipient_email || nodeOutputs.to || '').trim();
          ctx.log(`✅ Found recipient_email in ${nodeId}: "${to}"`);
        }
        if (!subject && nodeOutputs.subject) {
          subject = String(nodeOutputs.subject || '').trim();
          ctx.log(`✅ Found subject in ${nodeId}: "${subject}"`);
        }
        if (!body && nodeOutputs.body) {
          body = String(nodeOutputs.body || '').trim();
          ctx.log(`✅ Found body in ${nodeId}: "${body.substring(0, 50)}..."`);
        }
        if (!cc && nodeOutputs.cc) {
          cc = String(nodeOutputs.cc || '').trim();
        }
        if (!bcc && nodeOutputs.bcc) {
          bcc = String(nodeOutputs.bcc || '').trim();
        }
      }
    }
  }
  
  // Single node execution auto-fill: If still missing required fields and this is individual node testing
  if ((!to || !subject) && ctx.isSingleNodeExecution) {
    ctx.log(`🔧 Single node testing mode detected!`);
    ctx.log(`💡 Auto-filling missing fields with test values:`);
    
    if (!to) {
      to = 'test@example.com';
      ctx.log(`   ✅ To: ${to} (auto-filled for testing)`);
    }
    if (!subject) {
      subject = 'Test Email - Single Node Execution';
      ctx.log(`   ✅ Subject: ${subject} (auto-filled for testing)`);
    }
    
    ctx.log(`🎯 Continuing with test values for individual node testing...`);
  }
  
  ctx.log('📧 Mock Gmail Operation Details:');
  ctx.log(`   Operation: ${operation}`);
  ctx.log(`   From: Mock User <mock-user@gmail.com> (In real mode, this will be your authenticated Gmail account)`);
  ctx.log(`   To: ${to || '(not specified)'}`);
  if (cc) ctx.log(`   CC: ${cc}`);
  if (bcc) ctx.log(`   BCC: ${bcc}`);
  ctx.log(`   Subject: ${subject || '(not specified)'}`);
  ctx.log(`   Body: ${body ? `${body.substring(0, 100)}${body.length > 100 ? '...' : ''}` : '(not specified)'}`);
  ctx.log(`   HTML Format: ${isHtml ? 'Yes' : 'No'}`);
  
  // Validate required fields - provide helpful guidance for testing
  if (operation === 'send' || operation === 'draft') {
    if (!to || !subject) {
      // For individual node testing, provide more helpful error message
      const missingFields = [];
      if (!to) missingFields.push('To address');
      if (!subject) missingFields.push('Subject');
      
      ctx.log(`⚠️  Missing required fields: ${missingFields.join(', ')}`);
      
      // If this is single node execution, provide auto-fill suggestion
      if (ctx.isSingleNodeExecution) {
        ctx.log(`🔧 Single node testing mode detected!`);
        ctx.log(`💡 Auto-filling missing fields with test values:`);
        
        if (!to) {
          to = 'test@example.com';
          ctx.log(`   ✅ To: ${to} (auto-filled)`);
        }
        if (!subject) {
          subject = 'Test Email - Single Node Execution';
          ctx.log(`   ✅ Subject: ${subject} (auto-filled)`);
        }
        
        ctx.log(`🎯 Continuing with test values for individual node testing...`);
      } else {
        ctx.log(`💡 For testing: Add sample values like:`);
        if (!to) ctx.log(`   To: test@example.com`);
        if (!subject) ctx.log(`   Subject: Test Email`);
        
        throw new Error(`${missingFields.join(' and ')} ${missingFields.length > 1 ? 'are' : 'is'} required. Add sample values for testing.`);
      }
    }
  }
  
  // Generate mock response
  const mockMessageId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const mockThreadId = `thread-${Date.now()}`;
  
  ctx.log(`✅ Mock ${operation} operation completed successfully!`);
  ctx.log(`   Mock Message ID: ${mockMessageId}`);
  
  return {
    messageId: mockMessageId,
    threadId: mockThreadId,
    status: 'mock_success',
    userEmail: 'mock-user@gmail.com',
    data: {
      id: mockMessageId,
      threadId: mockThreadId,
      labelIds: ['SENT']
    },
    // Include the email details for verification
    emailDetails: {
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      body,
      isHtml
    }
  };
}

// Helper function to send email using Gmail API service
async function performSendEmail(ctx: RunContext, inputs: Record<string, unknown>, gmailApi: any, userEmail: string) {
  let to = String(inputs.to || '').trim();
  let cc = String(inputs.cc || '').trim();
  let bcc = String(inputs.bcc || '').trim();
  let subject = String(inputs.subject || '').trim();
  let body = String(inputs.body || '').trim();
  const isHtml = Boolean(inputs.isHtml);
  
  // Debug: Log what we received
  ctx.log(`🔍 Debug - Raw inputs received:`);
  ctx.log(`   to: "${to}"`);
  ctx.log(`   subject: "${subject}"`);
  ctx.log(`   body: "${body ? body.substring(0, 50) + '...' : '(empty)'}"`);
  
  // Auto-fix: If fields are empty but we have template variables, try to resolve from previous node
  if ((!to || !subject) && ctx.getNodeOutput) {
    ctx.log('🔧 Attempting auto-fix: Looking for email data in previous nodes...');
    
    // Try to get outputs from all previous nodes
    const allOutputs = ctx.getNodeOutput('*') || {};
    ctx.log(`🔍 Available node outputs: ${Object.keys(allOutputs).join(', ')}`);
    
    for (const [nodeId, outputs] of Object.entries(allOutputs)) {
      if (outputs && typeof outputs === 'object') {
        const nodeOutputs = outputs as Record<string, unknown>;
        ctx.log(`🔍 Checking node ${nodeId}: ${Object.keys(nodeOutputs).join(', ')}`);
        
        // Look for email fields in this node's outputs
        if (!to && (nodeOutputs.recipient_email || nodeOutputs.to)) {
          to = String(nodeOutputs.recipient_email || nodeOutputs.to || '').trim();
          ctx.log(`✅ Found recipient_email in ${nodeId}: "${to}"`);
        }
        if (!subject && nodeOutputs.subject) {
          subject = String(nodeOutputs.subject || '').trim();
          ctx.log(`✅ Found subject in ${nodeId}: "${subject}"`);
        }
        if (!body && nodeOutputs.body) {
          body = String(nodeOutputs.body || '').trim();
          ctx.log(`✅ Found body in ${nodeId}: "${body.substring(0, 50)}..."`);
        }
        if (!cc && nodeOutputs.cc) {
          cc = String(nodeOutputs.cc || '').trim();
        }
        if (!bcc && nodeOutputs.bcc) {
          bcc = String(nodeOutputs.bcc || '').trim();
        }
      }
    }
  }
  
  // Single node execution auto-fill: If still missing required fields and this is individual node testing
  if ((!to || !subject) && ctx.isSingleNodeExecution) {
    ctx.log(`🔧 Single node testing mode detected!`);
    ctx.log(`💡 Auto-filling missing fields with test values:`);
    
    if (!to) {
      to = 'test@example.com';
      ctx.log(`   ✅ To: ${to} (auto-filled for testing)`);
    }
    if (!subject) {
      subject = 'Test Email - Single Node Execution';
      ctx.log(`   ✅ Subject: ${subject} (auto-filled for testing)`);
    }
    
    ctx.log(`🎯 Continuing with test values for individual node testing...`);
  }
  
  if (!to || !subject) {
    throw new Error('To address and subject are required');
  }
  
  ctx.log(`📧 Sending email to: ${to}`);
  if (cc) ctx.log(`📧 CC: ${cc}`);
  if (bcc) ctx.log(`📧 BCC: ${bcc}`);
  
  const result = await gmailApi.sendEmail({
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    body,
    isHtml
  });
  
  ctx.log(`✅ Email sent successfully! Message ID: ${result.messageId}`);
  
  return {
    messageId: result.messageId,
    threadId: result.threadId,
    status: result.status,
    userEmail,
    data: result
  };
}

// Helper function to create draft using Gmail API service
async function performCreateDraft(ctx: RunContext, inputs: Record<string, unknown>, gmailApi: any, userEmail: string) {
  const to = String(inputs.to || '').trim();
  const cc = String(inputs.cc || '').trim();
  const bcc = String(inputs.bcc || '').trim();
  const subject = String(inputs.subject || '').trim();
  const body = String(inputs.body || '').trim();
  const isHtml = Boolean(inputs.isHtml);
  
  if (!to || !subject) {
    throw new Error('To address and subject are required');
  }
  
  ctx.log(`📝 Creating draft for: ${to}`);
  
  const result = await gmailApi.createDraft({
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    body,
    isHtml
  });
  
  ctx.log(`✅ Draft created successfully! Draft ID: ${result.draftId}`);
  
  return {
    draftId: result.draftId,
    messageId: result.messageId,
    status: 'draft_created',
    userEmail,
    data: result
  };
}

// Helper function to list messages using Gmail API service
async function performListMessages(ctx: RunContext, inputs: Record<string, unknown>, gmailApi: any, userEmail: string) {
  const maxResults = Number(inputs.maxResults) || 10;
  
  ctx.log(`📧 Fetching up to ${maxResults} messages from inbox...`);
  
  const result = await gmailApi.listMessages({
    maxResults,
    query: 'in:inbox' // Only get inbox messages
  });
  
  ctx.log(`📧 Found ${result.messages.length} messages`);
  
  // Extract readable content from messages
  const processedMessages = result.messages.map((msg: any) => {
    const content = gmailApi.extractEmailContent(msg);
    return {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet,
      from: content.from,
      to: content.to,
      subject: content.subject,
      date: content.date,
      body: content.body.substring(0, 500) + (content.body.length > 500 ? '...' : '') // Truncate long bodies
    };
  });
  
  return {
    status: 'success',
    messageCount: result.messages.length,
    messages: processedMessages,
    userEmail,
    data: {
      messages: processedMessages,
      nextPageToken: result.nextPageToken,
      resultSizeEstimate: result.resultSizeEstimate
    }
  };
}

export const googleBlock = createIntegrationBlock(
  'google',
  'Google',
  'Access Google services and APIs',
  'https://www.vectorlogo.zone/logos/google/google-icon.svg',
  Search
);

export const googleCalendarBlock = createIntegrationBlock(
  'googlecalendar',
  'Google Calendar',
  'Manage Google Calendar events',
  'https://calendar.google.com/googlecalendar/images/favicon_v2014_2.ico',
  Calendar,
  [
    {
      id: 'operation',
      title: 'Operation',
      type: 'combobox',
      layout: 'full',
      options: () => [
        { id: 'create', label: 'Create Event' },
        { id: 'update', label: 'Update Event' },
        { id: 'delete', label: 'Delete Event' }
      ],
      required: true
    },
    {
      id: 'account',
      title: 'Google Calendar Account',
      type: 'combobox',
      layout: 'full',
      options: () => [{ id: 'default', label: 'Select Google Calendar account' }],
      required: true
    },
    {
      id: 'calendarId',
      title: 'Calendar',
      type: 'combobox',
      layout: 'full',
      options: () => [{ id: 'primary', label: 'Primary' }],
      required: true
    },
    {
      id: 'eventTitle',
      title: 'Event Title',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Meeting with team',
      required: true
    },
    {
      id: 'description',
      title: 'Description',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Event description',
      rows: 3
    },
    {
      id: 'location',
      title: 'Location',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Conference Room A'
    },
    {
      id: 'startDateTime',
      title: 'Start Date & Time',
      type: 'datetime',
      layout: 'half',
      placeholder: '2025-06-03T10:00'
    },
    {
      id: 'endDateTime',
      title: 'End Date & Time',
      type: 'datetime',
      layout: 'half',
      placeholder: '2025-06-03T11:00'
    },
    {
      id: 'attendees',
      title: 'Attendees (comma-separated emails)',
      type: 'long-input',
      layout: 'full',
      placeholder: 'john@example.com, jane@example.com',
      rows: 2
    },
    {
      id: 'sendNotifications',
      title: 'Send Email Notifications',
      type: 'toggle',
      layout: 'half'
    },
    {
      id: 'notificationLevel',
      title: 'Notification Recipients',
      type: 'combobox',
      layout: 'full',
      options: () => [
        { id: 'none', label: 'None' },
        { id: 'all', label: 'All attendees (recommended)' },
        { id: 'organizer', label: 'Organizer only' }
      ]
    }
  ]
);

export const googleDocsBlock = createIntegrationBlock(
  'googledocs',
  'Google Docs',
  'Create and edit Google Docs',
  'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
  FileText
);

export const googleDriveBlock = createIntegrationBlock(
  'googledrive',
  'Google Drive',
  'Access and manage Google Drive files',
  'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
  Database
);

export const googleSheetsBlock = createIntegrationBlock(
  'googlesheets',
  'Google Sheets',
  'Read and write Google Sheets data',
  'https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico',
  Database,
  [
    {
      id: 'spreadsheetId',
      title: 'Spreadsheet ID',
      type: 'short-input',
      layout: 'full',
      placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      required: true
    },
    {
      id: 'range',
      title: 'Range',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Sheet1!A1:D10'
    }
  ]
);

export const huggingFaceBlock = createIntegrationBlock(
  'huggingface',
  'HuggingFace',
  'Access HuggingFace models and datasets',
  'https://huggingface.co/favicon.ico',
  Bot,
  [
    {
      id: 'model',
      title: 'Model',
      type: 'short-input',
      layout: 'full',
      placeholder: 'gpt2',
      required: true
    }
  ]
);

export const hunterBlock = createIntegrationBlock(
  'hunter',
  'Hunter',
  'Find email addresses with Hunter.io',
  'https://hunter.io/favicon.ico',
  Search,
  [
    {
      id: 'domain',
      title: 'Domain',
      type: 'short-input',
      layout: 'full',
      placeholder: 'example.com',
      required: true
    }
  ]
);

export const imageGeneratorBlock = createIntegrationBlock(
  'imagegenerator',
  'Image Generator',
  'Generate images with AI',
  'https://openai.com/favicon.ico',
  Image,
  [
    {
      id: 'prompt',
      title: 'Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'A beautiful sunset over mountains',
      rows: 3,
      required: true
    },
    {
      id: 'size',
      title: 'Size',
      type: 'combobox',
      layout: 'half',
      options: () => [
        { id: '1024x1024', label: '1024×1024' },
        { id: '1792x1024', label: '1792×1024' },
        { id: '1024x1792', label: '1024×1792' }
      ]
    }
  ]
);

export const jinaBlock = createIntegrationBlock(
  'jina',
  'Jina',
  'Use Jina AI for embeddings and search',
  'https://jina.ai/favicon.ico',
  Bot
);

export const jiraBlock = createIntegrationBlock(
  'jira',
  'Jira',
  'Manage Jira issues and projects',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/jira.svg',
  Zap,
  [
    {
      id: 'domain',
      title: 'Jira Domain',
      type: 'short-input',
      layout: 'full',
      placeholder: 'your-domain.atlassian.net',
      required: true
    },
    {
      id: 'projectKey',
      title: 'Project Key',
      type: 'short-input',
      layout: 'half',
      placeholder: 'PROJ'
    }
  ]
);

export const linearBlock = createIntegrationBlock(
  'linear',
  'Linear',
  'Create and manage Linear issues',
  'https://linear.app/favicon.ico',
  Zap,
  [
    {
      id: 'teamId',
      title: 'Team ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'team_123456789'
    }
  ]
);

export const linkedInBlock = createIntegrationBlock(
  'linkedin',
  'LinkedIn',
  'Connect and manage professional networks',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/linkedin.svg',
  Users
);

export const mem0Block = createIntegrationBlock(
  'mem0',
  'Mem0',
  'Store and retrieve AI memories',
  'https://mem0.ai/favicon.ico',
  Database,
  [
    {
      id: 'userId',
      title: 'User ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'user_123'
    }
  ]
);

export const microsoftExcelBlock = createIntegrationBlock(
  'microsoftexcel',
  'Microsoft Excel',
  'Read and write Excel spreadsheets',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/microsoftexcel.svg',
  Database
);

export const microsoftPlannerBlock = createIntegrationBlock(
  'microsoftplanner',
  'Microsoft Planner',
  'Manage Microsoft Planner tasks',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/microsoftexcel.svg',
  Calendar
);

export const microsoftTeamsBlock = createIntegrationBlock(
  'microsoftteams',
  'Microsoft Teams',
  'Send messages and manage Teams',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/microsoftteams.svg',
  MessageSquare
);

export const mistralParseBlock = createIntegrationBlock(
  'mistralparse',
  'Mistral Parse',
  'Parse documents with Mistral AI',
  'https://mistral.ai/favicon.ico',
  FileText
);

export const notionBlock = createIntegrationBlock(
  'notion',
  'Notion',
  'Read and write Notion pages and databases',
  'https://notion.so/images/favicon.ico',
  Database,
  [
    {
      id: 'databaseId',
      title: 'Database ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'notion-database-id'
    }
  ]
);

export const oneDriveBlock = createIntegrationBlock(
  'onedrive',
  'OneDrive',
  'Access and manage OneDrive files',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/microsoftonedrive.svg',
  Database
);

export const openAIBlock = createIntegrationBlock(
  'openai',
  'OpenAI',
  'Access OpenAI models and APIs',
  'https://openai.com/favicon.ico',
  Bot,
  [
    {
      id: 'model',
      title: 'Model',
      type: 'combobox',
      layout: 'full',
      options: () => [
        { id: 'gpt-4o', label: 'GPT-4o' },
        { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
      ]
    }
  ]
);

export const outlookBlock = createIntegrationBlock(
  'outlook',
  'Outlook',
  'Send and manage Outlook emails',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/microsoftoutlook.svg',
  Mail
);

export const perplexityBlock = createIntegrationBlock(
  'perplexity',
  'Perplexity',
  'Search with Perplexity AI',
  'https://perplexity.ai/favicon.ico',
  Search
);

export const pineconeBlock = createIntegrationBlock(
  'pinecone',
  'Pinecone',
  'Store and query vector embeddings',
  'https://pinecone.io/favicon.ico',
  Database,
  [
    {
      id: 'index',
      title: 'Index Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'my-index',
      required: true
    }
  ]
);

export const qdrantBlock = createIntegrationBlock(
  'qdrant',
  'Qdrant',
  'Vector database for AI applications',
  'https://qdrant.tech/favicon.ico',
  Database
);

export const redditBlock = createIntegrationBlock(
  'reddit',
  'Reddit',
  'Access Reddit posts and comments',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/reddit.svg',
  MessageSquare,
  [
    {
      id: 'subreddit',
      title: 'Subreddit',
      type: 'short-input',
      layout: 'full',
      placeholder: 'programming'
    }
  ]
);

export const s3Block = createIntegrationBlock(
  's3',
  'AWS S3',
  'Store and retrieve files from Amazon S3',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/amazonwebservices.svg',
  Database,
  [
    {
      id: 'bucket',
      title: 'Bucket Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'my-bucket',
      required: true
    },
    {
      id: 'region',
      title: 'Region',
      type: 'short-input',
      layout: 'half',
      placeholder: 'us-east-1'
    }
  ]
);

export const serperBlock = createIntegrationBlock(
  'serper',
  'Serper',
  'Google search API integration',
  'https://serper.dev/favicon.ico',
  Search
);

export const sharePointBlock = createIntegrationBlock(
  'sharepoint',
  'SharePoint',
  'Access SharePoint sites and documents',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/microsoftsharepoint.svg',
  Database
);

// Comprehensive Slack block with OAuth token authentication
export const slackBlock: BlockConfig = {
  type: 'slack',
  name: 'Slack',
  description: 'Send messages, read channels, and manage Slack workspaces with OAuth token authentication',
  category: 'integrations',
  bgColor: '#4A154B', // Slack purple
  icon: createSvgIcon('https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/slack.svg', MessageSquare),
  subBlocks: [
    {
      id: 'operation',
      title: 'Operation',
      type: 'combobox',
      layout: 'full',
      options: () => [
        { id: 'send_message', label: 'Send Message' },
        { id: 'list_channels', label: 'List Channels' },
        { id: 'read_messages', label: 'Read Messages' },
        { id: 'get_channel_info', label: 'Get Channel Info' },
        { id: '_load_channels', label: '🔄 Load Channels (Auto)' }
      ],
      required: true
    },
    {
      id: 'token',
      title: 'OAuth Token',
      type: 'short-input',
      layout: 'full',
      placeholder: 'your-slack-bot-token',
      password: true,
      required: true
    },
    {
      id: 'channel',
      title: 'Channel',
      type: 'combobox',
      layout: 'full',
      placeholder: 'Run "Load Channels" operation first to populate this dropdown',
      condition: { field: 'operation', value: ['send_message', 'read_messages', 'get_channel_info', '_load_channels'] },
      options: createAutoLoadingSlackChannelOptions('slack-channel-selector')
    },
    {
      id: 'manual_channel',
      title: 'Manual Channel Entry',
      type: 'short-input',
      layout: 'full',
      placeholder: '#general or C1234567890',
      condition: { field: 'channel', value: 'manual' }
    },
    {
      id: 'messageFormat',
      title: 'Message Format',
      type: 'combobox',
      layout: 'half',
      condition: { field: 'operation', value: 'send_message' },
      options: () => [
        { id: 'text', label: '📝 Text' },
        { id: 'json', label: '🔧 JSON' },
        { id: 'blocks', label: '🧱 Blocks (Rich)' }
      ]
    },
    {
      id: 'message',
      title: 'Message Content',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Your message here...\n\n📝 Text: Plain text with Slack formatting (*bold*, _italic_, `code`)\n   Example: "Email summary: {{gmail.subject}} - {{gmail.body}}"\n\n🔧 JSON: {"text": "Hello {{prev.data}}", "attachments": [...]}\n\n🧱 Blocks: [{"type": "section", "text": {"type": "mrkdwn", "text": "Hello {{email.body}}"}}]\n\n💡 Template Variables:\n   {{prev.data}} - Previous node output\n   {{gmail.body}} - Gmail email body\n   {{email.subject}} - Email subject\n   {{nodeAlias.field}} - Any node output',
      rows: 4,
      condition: { field: 'operation', value: 'send_message' }
    },
    {
      id: 'thread_ts',
      title: 'Thread Timestamp (optional)',
      type: 'short-input',
      layout: 'half',
      placeholder: '1234567890.123456',
      condition: { field: 'operation', value: 'send_message' }
    },
    {
      id: 'as_user',
      title: 'Send as User',
      type: 'toggle',
      layout: 'half',
      condition: { field: 'operation', value: 'send_message' }
    },
    {
      id: 'limit',
      title: 'Message Limit',
      type: 'number',
      layout: 'half',
      placeholder: '10',
      condition: { field: 'operation', value: 'read_messages' }
    },
    {
      id: 'oldest',
      title: 'Oldest Timestamp',
      type: 'short-input',
      layout: 'half',
      placeholder: '1234567890.123456',
      condition: { field: 'operation', value: 'read_messages' }
    },
    {
      id: 'include_all_metadata',
      title: 'Include All Metadata',
      type: 'toggle',
      layout: 'half',
      condition: { field: 'operation', value: 'read_messages' }
    },
    {
      id: 'exclude_archived',
      title: 'Exclude Archived Channels',
      type: 'toggle',
      layout: 'half',
      condition: { field: 'operation', value: 'list_channels' }
    },
    {
      id: 'types',
      title: 'Channel Types',
      type: 'combobox',
      layout: 'full',
      options: () => [
        { id: 'public_channel', label: 'Public Channels' },
        { id: 'private_channel', label: 'Private Channels' },
        { id: 'mpim', label: 'Multi-party Direct Messages' },
        { id: 'im', label: 'Direct Messages' },
        { id: 'public_channel,private_channel', label: 'All Channels' },
        { id: 'public_channel,private_channel,mpim,im', label: 'All Conversation Types' }
      ],
      condition: { field: 'operation', value: 'list_channels' }
    },
    {
      id: 'skipLiveCheck',
      title: 'Skip Live Check (Mock Mode)',
      type: 'toggle',
      layout: 'half'
    }
  ],
  inputs: {
    operation: { type: 'string', description: 'Slack operation to perform' },
    token: { type: 'string', description: 'Slack OAuth bot token (xoxb-...)' },
    channel: { type: 'string', description: 'Channel ID or name (#channel)' },
    manual_channel: { type: 'string', description: 'Manual channel entry when custom option selected' },
    messageFormat: { type: 'string', description: 'Message format: text, json, or blocks' },
    message: { type: 'string', description: 'Message content to send' },
    thread_ts: { type: 'string', description: 'Timestamp of thread to reply to' },
    as_user: { type: 'any', description: 'Send message as authenticated user' },
    limit: { type: 'number', description: 'Number of messages to retrieve' },
    oldest: { type: 'string', description: 'Oldest message timestamp to include' },
    include_all_metadata: { type: 'any', description: 'Include all message metadata' },
    exclude_archived: { type: 'any', description: 'Exclude archived channels from list' },
    types: { type: 'string', description: 'Types of conversations to include' },
    skipLiveCheck: { type: 'any', description: 'Skip live API check and run in mock mode' }
  },
  outputs: {
    success: { type: 'any', description: 'Whether the operation was successful' },
    message_ts: { type: 'string', description: 'Timestamp of sent message' },
    channel_id: { type: 'string', description: 'Channel ID where message was sent' },
    channels: { type: 'json', description: 'List of channels (for list_channels operation)' },
    messages: { type: 'json', description: 'List of messages (for read_messages operation)' },
    channel_info: { type: 'json', description: 'Channel information (for get_channel_info operation)' },
    data: { type: 'json', description: 'Full response from Slack API' },
    error: { type: 'string', description: 'Error message if operation failed' }
  },
  async run(ctx) {
    const inputs = ctx.inputs as Record<string, unknown>;
    const operation = String(inputs.operation || 'send_message');
    const skipLiveCheck = Boolean(inputs.skipLiveCheck);
    const token = String(inputs.token || '').trim();
    
    ctx.log(`🔄 Slack ${operation} operation starting...`);
    
    // Auto-fetch channels if we have a token and haven't cached them yet
    if (token && token.startsWith('xoxb-') && !slackChannelCache.has(token) && !skipLiveCheck) {
      ctx.log(`🔄 Auto-fetching channels for token cache...`);
      try {
        await autoFetchSlackChannels(ctx, token);
        
        // If this was just a channel loading operation, return the channels
        if (operation === '_load_channels') {
          const cachedChannels = slackChannelCache.get(token) || [];
          return {
            success: true,
            operation: '_load_channels',
            message: 'Channels loaded successfully! They are now available in all dropdowns automatically.',
            channels_cached: cachedChannels.length,
            channels: cachedChannels,
            real_time_update: true
          };
        }
      } catch (error) {
        ctx.log(`⚠️ Failed to auto-fetch channels: ${error}`);
        // Continue with operation even if channel fetch fails
      }
    }
    
    // If skip live check is enabled, run in mock mode
    if (skipLiveCheck) {
      ctx.log('⚠️ Running in mock mode (Skip Live Check enabled)');
      return await runSlackMockMode(ctx, inputs, operation);
    }
    
    try {
      return await performSlackOperation(ctx, inputs, operation);
    } catch (error) {
      ctx.log(`❌ Slack operation failed: ${error}`);
      throw error;
    }
  }
};

export const stagehandBlock = createIntegrationBlock(
  'stagehand',
  'Stagehand',
  'Browser automation with AI',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/playwright.svg',
  Globe
);

export const stagehandAgentBlock = createIntegrationBlock(
  'stagehandagent',
  'Stagehand Agent',
  'AI-powered browser automation agent',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/playwright.svg',
  Bot
);

export const supabaseBlock = createIntegrationBlock(
  'supabase',
  'Supabase',
  'Interact with Supabase database and auth',
  'https://www.vectorlogo.zone/logos/supabase/supabase-icon.svg',
  Database,
  [
    {
      id: 'table',
      title: 'Table',
      type: 'short-input',
      layout: 'full',
      placeholder: 'users',
      required: true
    },
    {
      id: 'operation',
      title: 'Operation',
      type: 'combobox',
      layout: 'half',
      options: () => [
        { id: 'select', label: 'Select' },
        { id: 'insert', label: 'Insert' },
        { id: 'update', label: 'Update' },
        { id: 'delete', label: 'Delete' }
      ]
    }
  ]
);

export const tavilyBlock = createIntegrationBlock(
  'tavily',
  'Tavily',
  'AI-powered web search and research',
  'https://tavily.com/favicon.ico',
  Search
);

export const telegramBlock = createIntegrationBlock(
  'telegram',
  'Telegram',
  'Send messages via Telegram bot',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/telegram.svg',
  MessageSquare,
  [
    {
      id: 'chatId',
      title: 'Chat ID',
      type: 'short-input',
      layout: 'full',
      placeholder: '123456789'
    }
  ]
);

export const thinkingBlock = createIntegrationBlock(
  'thinking',
  'Thinking',
  'AI reasoning and thought processes',
  'https://openai.com/favicon.ico',
  Bot
);

export const translateBlock = createIntegrationBlock(
  'translate',
  'Translate',
  'Translate text between languages',
  'https://ssl.gstatic.com/translate/favicon.ico',
  Globe,
  [
    {
      id: 'targetLanguage',
      title: 'Target Language',
      type: 'short-input',
      layout: 'half',
      placeholder: 'es',
      required: true
    },
    {
      id: 'text',
      title: 'Text to Translate',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Hello, world!',
      rows: 3,
      required: true
    }
  ]
);

export const twilioBlock = createIntegrationBlock(
  'twilio',
  'Twilio',
  'Send SMS and make calls with Twilio',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/twilio.svg',
  Phone,
  [
    {
      id: 'phoneNumber',
      title: 'To Phone Number',
      type: 'short-input',
      layout: 'full',
      placeholder: '+1234567890'
    },
    {
      id: 'message',
      title: 'Message',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Your message here...',
      rows: 3
    }
  ]
);

export const typeformBlock = createIntegrationBlock(
  'typeform',
  'Typeform',
  'Create and manage Typeform surveys',
  'https://admin.typeform.com/favicon.ico',
  FileText
);

export const visionBlock = createIntegrationBlock(
  'vision',
  'Vision',
  'Analyze images with AI vision models',
  'https://ssl.gstatic.com/images/branding/product/1x/googleg_32dp.png',
  Image,
  [
    {
      id: 'imageUrl',
      title: 'Image URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://example.com/image.jpg',
      required: true
    },
    {
      id: 'prompt',
      title: 'Analysis Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'What do you see in this image?',
      rows: 3
    }
  ]
);

export const wealthboxBlock = createIntegrationBlock(
  'wealthbox',
  'Wealthbox',
  'Manage Wealthbox CRM data',
  'https://wealthbox.com/favicon.ico',
  Users
);

export const webhookBlock = createIntegrationBlock(
  'webhook',
  'Webhook',
  'Send HTTP webhooks to external services',
  'https://webhook.site/favicon.ico',
  Zap,
  [
    {
      id: 'url',
      title: 'Webhook URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://example.com/webhook',
      required: true
    },
    {
      id: 'method',
      title: 'HTTP Method',
      type: 'combobox',
      layout: 'half',
      options: () => [
        { id: 'POST', label: 'POST' },
        { id: 'PUT', label: 'PUT' },
        { id: 'PATCH', label: 'PATCH' }
      ]
    },
    {
      id: 'payload',
      title: 'Payload',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{"message": "Hello, world!"}'
    }
  ]
);

export const whatsappBlock = createIntegrationBlock(
  'whatsapp',
  'WhatsApp',
  'Send WhatsApp messages',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/whatsapp.svg',
  MessageSquare,
  [
    {
      id: 'phoneNumber',
      title: 'Phone Number',
      type: 'short-input',
      layout: 'full',
      placeholder: '+1234567890'
    }
  ]
);

export const wikipediaBlock = createIntegrationBlock(
  'wikipedia',
  'Wikipedia',
  'Search and retrieve Wikipedia articles',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/wikipedia.svg',
  Search,
  [
    {
      id: 'query',
      title: 'Search Query',
      type: 'short-input',
      layout: 'full',
      placeholder: 'artificial intelligence',
      required: true
    }
  ]
);

export const workflowBlock = createIntegrationBlock(
  'workflow',
  'Workflow',
  'Execute sub-workflows and nested processes',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/zapier.svg',
  Zap,
  [
    {
      id: 'workflowId',
      title: 'Workflow ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'workflow-123',
      required: true
    }
  ]
);

export const xBlock = createIntegrationBlock(
  'x',
  'X (Twitter)',
  'Post and manage X (Twitter) content',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/x.svg',
  MessageSquare,
  [
    {
      id: 'tweet',
      title: 'Tweet Content',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Your tweet here...',
      rows: 3,
      required: true
    }
  ]
);

export const youTubeBlock = createIntegrationBlock(
  'youtube',
  'YouTube',
  'Search and manage YouTube videos',
  'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/youtube.svg',
  Video,
  [
    {
      id: 'query',
      title: 'Search Query',
      type: 'short-input',
      layout: 'full',
      placeholder: 'machine learning tutorial'
    },
    {
      id: 'maxResults',
      title: 'Max Results',
      type: 'short-input',
      layout: 'half',
      placeholder: '10'
    }
  ]
);

// ===== SLACK INTEGRATION FUNCTIONS =====

// Auto-fetch channels for caching (silent background operation)
async function autoFetchSlackChannels(ctx: any, token: string) {
  const baseUrl = '/api/slack';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json; charset=utf-8',
    'User-Agent': 'AGEN8-Slack-Integration/1.0'
  };

  try {
    const params = new URLSearchParams({
      exclude_archived: 'true',
      types: 'public_channel,private_channel',
      limit: '100'
    });

    const response = await ctx.fetch(`${baseUrl}/conversations.list?${params}`, {
      method: 'GET',
      headers
    });

    if (response.ok) {
      const result = await response.json();
      if (result.ok && result.channels) {
        // Format channels for dropdown
        const formattedChannels = result.channels.map((channel: any) => ({
          id: channel.id,
          label: channel.is_private 
            ? `🔒 ${channel.name} (Private)` 
            : `📢 #${channel.name}`
        }));

        // Cache the channels in both legacy and new reactive system
        slackChannelCache.set(token, formattedChannels);
        setSlackChannels(token, formattedChannels); // New reactive system
        channelCacheVersion++;
        lastChannelUpdate = Date.now();
        ctx.log(`✅ Cached ${formattedChannels.length} channels for dropdown`);
        ctx.log(`📋 Channels: ${formattedChannels.map(c => c.label).join(', ')}`);
        ctx.log(`🚀 Real-time dropdown update: Channels are now available in all dropdowns!`);
        
        // Force UI refresh by setting node outputs
        if (ctx.setNodeOutput) {
          ctx.setNodeOutput('channels_loaded', true);
          ctx.setNodeOutput('channels_count', formattedChannels.length);
          ctx.setNodeOutput('channels_list', formattedChannels.map(c => c.label));
          ctx.setNodeOutput('refresh_ui', lastChannelUpdate);
        }
      }
    }
  } catch (error) {
    ctx.log(`⚠️ Silent channel fetch failed: ${error}`);
    // Don't throw - this is a background operation
  }
}

// Mock mode for Slack operations (for testing without live API)
async function runSlackMockMode(ctx: any, inputs: Record<string, unknown>, operation: string) {
  const token = String(inputs.token || '').trim();
  let channel = String(inputs.channel || '').trim();
  
  // Clean channel ID by removing timestamp suffix if present
  if (channel.includes('_') && channel.match(/_\d+$/)) {
    channel = channel.replace(/_\d+$/, '');
  }
  const message = String(inputs.message || '').trim();
  
  // Handle manual channel entry
  if (channel === 'manual' && inputs.manual_channel) {
    channel = String(inputs.manual_channel).trim();
    ctx.log(`🔧 Using manual channel entry: ${channel}`);
  }
  
  // Debug: Log what we received
  ctx.log(`🔍 Debug - Mock Slack ${operation}:`);
  ctx.log(`   Token: ${token ? token.substring(0, 10) + '...' : '(empty)'}`);
  ctx.log(`   Channel: "${channel}"`);
  if (operation === 'send_message') {
    ctx.log(`   Message: "${message ? message.substring(0, 50) + '...' : '(empty)'}"`);
  }
  
  // Auto-fix: If fields are empty but we have template variables, try to resolve from previous node
  let autoFilledChannel = channel;
  let autoFilledMessage = message;
  
  if ((!channel || !message) && ctx.getNodeOutput) {
    ctx.log('🔧 Attempting auto-fix: Looking for Slack data in previous nodes...');
    
    // Try to get outputs from all previous nodes
    const allOutputs = ctx.getNodeOutput('*') || {};
    ctx.log(`🔍 Available node outputs: ${Object.keys(allOutputs).join(', ')}`);
    
    for (const [nodeId, outputs] of Object.entries(allOutputs)) {
      if (outputs && typeof outputs === 'object') {
        const nodeOutputs = outputs as Record<string, unknown>;
        ctx.log(`🔍 Checking node ${nodeId}: ${Object.keys(nodeOutputs).join(', ')}`);
        
        // Look for Slack fields in this node's outputs
        if (!autoFilledChannel && (nodeOutputs.channel || nodeOutputs.slack_channel)) {
          autoFilledChannel = String(nodeOutputs.channel || nodeOutputs.slack_channel || '').trim();
          ctx.log(`✅ Found channel in ${nodeId}: "${autoFilledChannel}"`);
        }
        if (!autoFilledMessage && (nodeOutputs.message || nodeOutputs.slack_message || nodeOutputs.text || nodeOutputs.body || nodeOutputs.content || nodeOutputs.summary)) {
          let rawMessage = String(nodeOutputs.message || nodeOutputs.slack_message || nodeOutputs.text || nodeOutputs.body || nodeOutputs.content || nodeOutputs.summary || '').trim();
          
          // If the message looks like JSON, try to extract the summary field
          if (rawMessage.startsWith('{') && rawMessage.includes('"summary"')) {
            try {
              const parsed = JSON.parse(rawMessage);
              if (parsed.summary) {
                rawMessage = String(parsed.summary).trim();
                ctx.log(`🔧 Extracted summary from JSON: "${rawMessage.substring(0, 50)}..."`);
              }
            } catch (e) {
              ctx.log(`⚠️ Failed to parse JSON message, using raw: ${e}`);
            }
          }
          
          autoFilledMessage = rawMessage;
          ctx.log(`✅ Found message in ${nodeId}: "${autoFilledMessage.substring(0, 50)}..."`);
        }
      }
    }
  }
  
  // Single node execution auto-fill: If still missing required fields and this is individual node testing
  if ((!autoFilledChannel || (!autoFilledMessage && operation === 'send_message')) && ctx.isSingleNodeExecution) {
    ctx.log(`🔧 Single node testing mode detected!`);
    ctx.log(`💡 Auto-filling missing fields with test values:`);
    
    if (!autoFilledChannel) {
      autoFilledChannel = '#general';
      ctx.log(`   ✅ Channel: ${autoFilledChannel} (auto-filled for testing)`);
    }
    if (!autoFilledMessage && operation === 'send_message') {
      autoFilledMessage = 'Test message from AGEN8 workflow - Single Node Execution';
      ctx.log(`   ✅ Message: ${autoFilledMessage} (auto-filled for testing)`);
    }
    
    ctx.log(`🎯 Continuing with test values for individual node testing...`);
  }
  
  // Generate mock response based on operation
  const mockTimestamp = (Date.now() / 1000).toFixed(6);
  const mockChannelId = autoFilledChannel.startsWith('#') ? 
    `C${Math.random().toString(36).substring(2, 11).toUpperCase()}` : 
    autoFilledChannel;
  
  ctx.log(`📱 Mock Slack Operation Details:`);
  ctx.log(`   Operation: ${operation}`);
  ctx.log(`   Channel: ${autoFilledChannel} (${mockChannelId})`);
  
  switch (operation) {
    case 'send_message':
      ctx.log(`   Message: ${autoFilledMessage}`);
      ctx.log(`   Thread: ${inputs.thread_ts ? String(inputs.thread_ts) : 'None'}`);
      ctx.log(`   As User: ${Boolean(inputs.as_user)}`);
      
      ctx.log(`✅ Mock message sent successfully!`);
      ctx.log(`   Mock Message Timestamp: ${mockTimestamp}`);
      
      return {
        success: true,
        message_ts: mockTimestamp,
        channel_id: mockChannelId,
        data: {
          ok: true,
          channel: mockChannelId,
          ts: mockTimestamp,
          message: {
            text: autoFilledMessage,
            user: 'U1234567890',
            ts: mockTimestamp,
            type: 'message'
          }
        }
      };
      
    case 'list_channels':
      const mockChannels = [
        { id: 'C1234567890', name: 'general', is_channel: true, is_private: false, is_member: true },
        { id: 'C2345678901', name: 'random', is_channel: true, is_private: false, is_member: true },
        { id: 'C3456789012', name: 'development', is_channel: true, is_private: false, is_member: false },
        { id: 'G4567890123', name: 'private-team', is_channel: false, is_private: true, is_member: true }
      ];
      
      ctx.log(`   Types: ${inputs.types || 'public_channel'}`);
      ctx.log(`   Exclude Archived: ${Boolean(inputs.exclude_archived)}`);
      
      ctx.log(`✅ Mock channels retrieved successfully!`);
      ctx.log(`   Found ${mockChannels.length} channels`);
      
      return {
        success: true,
        channels: mockChannels,
        data: {
          ok: true,
          channels: mockChannels
        }
      };
      
    case 'read_messages':
      const mockMessages = [
        {
          type: 'message',
          user: 'U1234567890',
          text: 'Hello everyone! This is a mock message.',
          ts: (Date.now() / 1000 - 3600).toFixed(6),
          thread_ts: undefined
        },
        {
          type: 'message',
          user: 'U2345678901',
          text: 'Another mock message for testing purposes.',
          ts: (Date.now() / 1000 - 1800).toFixed(6),
          thread_ts: undefined
        },
        {
          type: 'message',
          user: 'U3456789012',
          text: 'This is a threaded reply!',
          ts: (Date.now() / 1000 - 900).toFixed(6),
          thread_ts: (Date.now() / 1000 - 3600).toFixed(6)
        }
      ];
      
      ctx.log(`   Limit: ${inputs.limit || 10}`);
      ctx.log(`   Oldest: ${inputs.oldest || 'None'}`);
      
      ctx.log(`✅ Mock messages retrieved successfully!`);
      ctx.log(`   Found ${mockMessages.length} messages`);
      
      return {
        success: true,
        messages: mockMessages,
        data: {
          ok: true,
          messages: mockMessages,
          has_more: false
        }
      };
      
    case 'get_channel_info':
      const mockChannelInfo = {
        id: mockChannelId,
        name: autoFilledChannel.replace('#', ''),
        is_channel: true,
        is_private: false,
        is_member: true,
        topic: { value: 'Mock channel for testing', creator: 'U1234567890' },
        purpose: { value: 'This is a mock channel', creator: 'U1234567890' },
        num_members: 42
      };
      
      ctx.log(`✅ Mock channel info retrieved successfully!`);
      ctx.log(`   Channel: ${mockChannelInfo.name} (${mockChannelInfo.num_members} members)`);
      
      return {
        success: true,
        channel_info: mockChannelInfo,
        data: {
          ok: true,
          channel: mockChannelInfo
        }
      };
      
    case 'join_channel':
    case 'leave_channel':
      ctx.log(`✅ Mock ${operation} completed successfully!`);
      ctx.log(`   Channel: ${autoFilledChannel}`);
      
      return {
        success: true,
        channel_id: mockChannelId,
        data: {
          ok: true,
          channel: {
            id: mockChannelId,
            name: autoFilledChannel.replace('#', '')
          }
        }
      };
      
    case 'fetch_channels_for_ui':
      const mockUIChannels = [
        { id: 'C1234567890', label: '📢 #general', name: 'general', is_member: true, is_private: false },
        { id: 'C2345678901', label: '📢 #random', name: 'random', is_member: true, is_private: false },
        { id: 'C3456789012', label: '📢 #development', name: 'development', is_member: false, is_private: false },
        { id: 'G4567890123', label: '🔒 private-team (Private)', name: 'private-team', is_member: true, is_private: true },
        { id: 'D5678901234', label: '💬 DM: John Doe', name: 'john.doe', is_member: true, is_private: true },
        { id: 'manual', label: '🔧 Enter channel manually', name: 'manual', is_member: false, is_private: false }
      ];
      
      ctx.log(`✅ Mock UI channels fetched successfully!`);
      ctx.log(`   Found ${mockUIChannels.length} channels for dropdown`);
      
      return {
        success: true,
        channels: mockUIChannels,
        total_count: mockUIChannels.length,
        member_count: mockUIChannels.filter(c => c.is_member).length,
        data: {
          ok: true,
          channels: mockUIChannels
        }
      };
      
    default:
      throw new Error(`Unknown Slack operation: ${operation}`);
  }
}

// Real Slack API operations
async function performSlackOperation(ctx: any, inputs: Record<string, unknown>, operation: string) {
  let token = String(inputs.token || '').trim();
  let channel = String(inputs.channel || '').trim();
  
  // Clean channel ID by removing timestamp suffix if present
  if (channel.includes('_') && channel.match(/_\d+$/)) {
    channel = channel.replace(/_\d+$/, '');
  }
  let message = String(inputs.message || '').trim();
  
  // Handle manual channel entry
  if (channel === 'manual' && inputs.manual_channel) {
    channel = String(inputs.manual_channel).trim();
    ctx.log(`🔧 Using manual channel entry: ${channel}`);
  }
  
  // Handle loading state - trigger channel refresh
  if (channel === 'loading' && token && token.startsWith('xoxb-')) {
    ctx.log(`🔄 Loading state detected - refreshing channels...`);
    try {
      await autoFetchSlackChannels(ctx, token);
      // Return a message to user about refreshing
      return {
        success: true,
        operation: 'channel_refresh',
        message: 'Channels refreshed! Please select a channel from the updated dropdown.',
        channels_cached: slackChannelCache.get(token)?.length || 0
      };
    } catch (error) {
      throw new Error(`Failed to refresh channels: ${error}`);
    }
  }
  
  // Debug: Log what we received
  ctx.log(`🔍 Debug - Real Slack ${operation}:`);
  ctx.log(`   Token: ${token ? token.substring(0, 10) + '...' : '(empty)'}`);
  ctx.log(`   Channel: "${channel}"`);
  if (operation === 'send_message') {
    ctx.log(`   Message: "${message ? message.substring(0, 50) + '...' : '(empty)'}"`);
  }
  
  // Auto-fix: If fields are empty but we have template variables, try to resolve from previous node
  if ((!token || !channel) && ctx.getNodeOutput) {
    ctx.log('🔧 Attempting auto-fix: Looking for Slack data in previous nodes...');
    
    // Try to get outputs from all previous nodes
    const allOutputs = ctx.getNodeOutput('*') || {};
    ctx.log(`🔍 Available node outputs: ${Object.keys(allOutputs).join(', ')}`);
    
    for (const [nodeId, outputs] of Object.entries(allOutputs)) {
      if (outputs && typeof outputs === 'object') {
        const nodeOutputs = outputs as Record<string, unknown>;
        ctx.log(`🔍 Checking node ${nodeId}: ${Object.keys(nodeOutputs).join(', ')}`);
        
        // Look for Slack fields in this node's outputs
        if (!token && (nodeOutputs.slack_token || nodeOutputs.token)) {
          token = String(nodeOutputs.slack_token || nodeOutputs.token || '').trim();
          ctx.log(`✅ Found token in ${nodeId}: ${token.substring(0, 10)}...`);
        }
        if (!channel && (nodeOutputs.channel || nodeOutputs.slack_channel)) {
          channel = String(nodeOutputs.channel || nodeOutputs.slack_channel || '').trim();
          ctx.log(`✅ Found channel in ${nodeId}: "${channel}"`);
        }
        if (!message && (nodeOutputs.message || nodeOutputs.slack_message || nodeOutputs.text || nodeOutputs.body || nodeOutputs.content || nodeOutputs.summary)) {
          let rawMessage = String(nodeOutputs.message || nodeOutputs.slack_message || nodeOutputs.text || nodeOutputs.body || nodeOutputs.content || nodeOutputs.summary || '').trim();
          
          // If the message looks like JSON, try to extract the summary field
          if (rawMessage.startsWith('{') && rawMessage.includes('"summary"')) {
            try {
              const parsed = JSON.parse(rawMessage);
              if (parsed.summary) {
                rawMessage = String(parsed.summary).trim();
                ctx.log(`🔧 Extracted summary from JSON: "${rawMessage.substring(0, 50)}..."`);
              }
            } catch (e) {
              ctx.log(`⚠️ Failed to parse JSON message, using raw: ${e}`);
            }
          }
          
          message = rawMessage;
          ctx.log(`✅ Found message in ${nodeId}: "${message.substring(0, 50)}..."`);
        }
      }
    }
  }
  
  // Single node execution auto-fill: If still missing required fields and this is individual node testing
  if ((!token || !channel) && ctx.isSingleNodeExecution) {
    ctx.log(`🔧 Single node testing mode detected!`);
    ctx.log(`💡 Auto-filling missing fields with test values:`);
    
    if (!token) {
      throw new Error('Slack OAuth token is required for testing this node. Please provide your bot token (starts with xoxb-).');
    }
    if (!channel) {
      channel = '#general';
      ctx.log(`   ✅ Channel: ${channel} (auto-filled for testing)`);
    }
    
    ctx.log(`🎯 Continuing with test values for individual node testing...`);
    ctx.log(`📝 Note: Empty message will be handled with default value`);
  }
  
  if (!token) {
    throw new Error('Slack OAuth token is required. Please provide your bot token (xoxb-...)');
  }
  
  // Validate token format
  if (!token.startsWith('xoxb-') && !token.startsWith('xoxp-')) {
    throw new Error('Invalid Slack token format. Expected bot token (xoxb-...) or user token (xoxp-...)');
  }
  
  // Use proxy URL to avoid CORS issues
  const baseUrl = '/api/slack';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json; charset=utf-8',
    'User-Agent': 'AGEN8-Slack-Integration/1.0'
  };
  
  ctx.log(`🔗 Connecting to Slack API...`);
  
  // First, test the connection with a simple auth.test call
  try {
    ctx.log(`🔍 Testing Slack API connection...`);
    const testResponse = await ctx.fetch(`${baseUrl}/auth.test`, {
      method: 'POST',
      headers
    });
    
    ctx.log(`🔍 Auth test response status: ${testResponse.status}`);
    
    if (testResponse.ok) {
      const testResult = await testResponse.json();
      ctx.log(`✅ Slack API connection successful!`);
      ctx.log(`   Team: ${testResult.team || 'Unknown'}`);
      ctx.log(`   User: ${testResult.user || 'Unknown'}`);
      ctx.log(`   Bot ID: ${testResult.bot_id || 'Unknown'}`);
    } else {
      const errorText = await testResponse.text().catch(() => 'Unable to read error response');
      ctx.log(`⚠️ Auth test failed but continuing: ${testResponse.status} - ${errorText}`);
    }
  } catch (authError: any) {
    ctx.log(`⚠️ Auth test failed: ${authError.message}`);
    ctx.log(`🔄 Continuing anyway - this might be a temporary network issue`);
    // Don't throw - continue with the operation
  }
  
  try {
    switch (operation) {
      case 'send_message':
        if (!channel || !message) {
          throw new Error('Channel and message are required for send_message operation');
        }
        
        return await sendSlackMessage(ctx, { token, channel, message, ...inputs }, headers, baseUrl);
        
      case 'list_channels':
        return await listSlackChannels(ctx, inputs, headers, baseUrl);
        
      case 'read_messages':
        if (!channel) {
          throw new Error('Channel is required for read_messages operation');
        }
        
        return await readSlackMessages(ctx, { channel, ...inputs }, headers, baseUrl);
        
      case 'get_channel_info':
        if (!channel) {
          throw new Error('Channel is required for get_channel_info operation');
        }
        
        return await getSlackChannelInfo(ctx, channel, headers, baseUrl);
        

      case 'fetch_channels_for_ui':
        return await fetchChannelsForUI(ctx, headers, baseUrl);
        
      case '_load_channels':
        // Special operation to load channels and update cache
        ctx.log(`🔄 Loading channels for dropdown...`);
        await autoFetchSlackChannels(ctx, token);
        const cachedChannels = slackChannelCache.get(token) || [];
        
        // Set node outputs to trigger UI refresh
        if (ctx.setNodeOutput) {
          ctx.setNodeOutput('channels_loaded', true);
          ctx.setNodeOutput('channels_count', cachedChannels.length);
          ctx.setNodeOutput('channels_list', cachedChannels.map(c => c.label));
          ctx.setNodeOutput('refresh_ui', Date.now());
        }
        
        return {
          success: true,
          operation: '_load_channels',
          message: `✅ Loaded ${cachedChannels.length} channels!`,
          channels: cachedChannels.map(c => c.label),
          channels_cached: cachedChannels.length,
          channels_loaded: true,
          workaround: 'If dropdown not updated: 1) Switch operation to "Send Message" 2) Refresh browser page 3) Or manually enter channel name',
          available_channels: cachedChannels.reduce((acc, ch) => {
            acc[ch.id] = ch.label;
            return acc;
          }, {} as Record<string, string>)
        };

      default:
        throw new Error(`Unknown Slack operation: ${operation}`);
    }
  } catch (error: any) {
    ctx.log(`❌ Slack API error: ${error.message}`);
    throw error;
  }
}

// Helper function to send a message to Slack
async function sendSlackMessage(ctx: any, inputs: Record<string, unknown>, headers: any, baseUrl: string) {
  let channel = String(inputs.channel);
  
  // Clean channel ID by removing timestamp suffix if present
  if (channel.includes('_') && channel.match(/_\d+$/)) {
    channel = channel.replace(/_\d+$/, '');
  }
  let message = String(inputs.message || '').trim();
  const messageFormat = String(inputs.messageFormat || 'text').toLowerCase();
  const thread_ts = inputs.thread_ts ? String(inputs.thread_ts) : undefined;
  const as_user = Boolean(inputs.as_user);
  
  // Log template variable resolution
  if (inputs.message && String(inputs.message).includes('{{')) {
    ctx.log(`🔧 Template variables detected in message`);
    ctx.log(`   Original: ${String(inputs.message).substring(0, 100)}...`);
    ctx.log(`   Resolved: ${message.substring(0, 100)}...`);
  }
  
  // Handle empty message - provide default
  if (!message) {
    message = 'Hello from AGEN8! 👋';
    ctx.log(`⚠️ Empty message detected, using default: "${message}"`);
  }
  
  ctx.log(`📤 Sending ${messageFormat} message to ${channel}...`);
  
  const payload: any = {
    channel: channel
  };
  
  // Handle different message formats
  if (messageFormat === 'json' || messageFormat === 'blocks') {
    try {
      ctx.log(`🔧 Parsing ${messageFormat} format...`);
      const parsedMessage = JSON.parse(message);
      
      if (messageFormat === 'blocks') {
        // Blocks format
        if (Array.isArray(parsedMessage)) {
          payload.blocks = parsedMessage;
          ctx.log(`✅ Applied ${parsedMessage.length} blocks`);
        } else if (parsedMessage.blocks) {
          payload.blocks = parsedMessage.blocks;
          if (parsedMessage.text) payload.text = parsedMessage.text;
          ctx.log(`✅ Applied blocks with fallback text`);
        } else {
          throw new Error('Invalid blocks format. Expected array or object with blocks property.');
        }
      } else {
        // JSON format - merge all properties
        Object.assign(payload, parsedMessage);
        ctx.log(`✅ Merged JSON properties: ${Object.keys(parsedMessage).join(', ')}`);
        if (!payload.text && !payload.blocks && !payload.attachments) {
          payload.text = JSON.stringify(parsedMessage);
          ctx.log(`📝 No text/blocks/attachments found, using stringified JSON as text`);
        }
      }
    } catch (error) {
      ctx.log(`⚠️ Failed to parse ${messageFormat} message, sending as text: ${error}`);
      payload.text = message;
    }
  } else {
    // Text format (default)
    payload.text = message;
    ctx.log(`📝 Using text format`);
  }
  
  // Ensure we have some content
  if (!payload.text && !payload.blocks && !payload.attachments) {
    payload.text = 'Hello from AGEN8! 👋';
    ctx.log(`⚠️ No content found, using fallback text`);
  }
  
  if (thread_ts) {
    payload.thread_ts = thread_ts;
    ctx.log(`   📎 Replying to thread: ${thread_ts}`);
  }
  
  if (as_user) {
    payload.as_user = true;
    ctx.log(`   👤 Sending as authenticated user`);
  }
  
  ctx.log(`🌐 Making request to: ${baseUrl}/chat.postMessage`);
  ctx.log(`📦 Payload: ${JSON.stringify(payload, null, 2)}`);
  
  const response = await ctx.fetch(`${baseUrl}/chat.postMessage`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  
  ctx.log(`📡 Response status: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error response');
    ctx.log(`❌ HTTP Error Response: ${errorText}`);
    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
  }
  
  const result = await response.json();
  ctx.log(`📋 Slack API Response: ${JSON.stringify(result, null, 2)}`);
  
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error} - ${result.detail || result.response_metadata?.messages?.join(', ') || 'Unknown error'}`);
  }
  
  ctx.log(`✅ Message sent successfully!`);
  ctx.log(`   Channel: ${result.channel}`);
  ctx.log(`   Timestamp: ${result.ts}`);
  
  return {
    success: true,
    message_ts: result.ts,
    channel_id: result.channel,
    data: result
  };
}

// Helper function to list Slack channels
async function listSlackChannels(ctx: any, inputs: Record<string, unknown>, headers: any, baseUrl: string) {
  const exclude_archived = Boolean(inputs.exclude_archived);
  const types = String(inputs.types || 'public_channel');
  
  ctx.log(`📋 Listing Slack channels...`);
  ctx.log(`   Types: ${types}`);
  ctx.log(`   Exclude archived: ${exclude_archived}`);
  
  const params = new URLSearchParams({
    exclude_archived: exclude_archived.toString(),
    types: types
  });
  
  const response = await ctx.fetch(`${baseUrl}/conversations.list?${params}`, {
    method: 'GET',
    headers
  });
  
  const result = await response.json();
  
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error} - ${result.detail || 'Unknown error'}`);
  }
  
  ctx.log(`✅ Channels retrieved successfully!`);
  ctx.log(`   Found ${result.channels.length} channels`);
  
  // Log first few channels for debugging
  result.channels.slice(0, 3).forEach((channel: any) => {
    ctx.log(`   📁 ${channel.name} (${channel.id}) - ${channel.is_private ? 'Private' : 'Public'}`);
  });
  
  return {
    success: true,
    channels: result.channels,
    data: result
  };
}

// Helper function to read messages from a Slack channel
async function readSlackMessages(ctx: any, inputs: Record<string, unknown>, headers: any, baseUrl: string) {
  let channel = String(inputs.channel);
  
  // Clean channel ID by removing timestamp suffix if present
  if (channel.includes('_') && channel.match(/_\d+$/)) {
    channel = channel.replace(/_\d+$/, '');
  }
  const limit = Number(inputs.limit) || 10;
  const oldest = inputs.oldest ? String(inputs.oldest) : undefined;
  const include_all_metadata = Boolean(inputs.include_all_metadata);
  
  ctx.log(`📖 Reading messages from ${channel}...`);
  ctx.log(`   Limit: ${limit}`);
  if (oldest) ctx.log(`   Oldest: ${oldest}`);
  
  const params = new URLSearchParams({
    channel: channel,
    limit: limit.toString()
  });
  
  if (oldest) {
    params.append('oldest', oldest);
  }
  
  if (include_all_metadata) {
    params.append('include_all_metadata', 'true');
  }
  
  const response = await ctx.fetch(`${baseUrl}/conversations.history?${params}`, {
    method: 'GET',
    headers
  });
  
  const result = await response.json();
  
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error} - ${result.detail || 'Unknown error'}`);
  }
  
  ctx.log(`✅ Messages retrieved successfully!`);
  ctx.log(`   Found ${result.messages.length} messages`);
  
  // Log first few messages for debugging
  result.messages.slice(0, 2).forEach((msg: any, index: number) => {
    const preview = msg.text ? msg.text.substring(0, 50) + '...' : '[No text]';
    ctx.log(`   💬 Message ${index + 1}: ${preview}`);
  });
  
  return {
    success: true,
    messages: result.messages,
    data: result
  };
}

// Helper function to get channel information
async function getSlackChannelInfo(ctx: any, channel: string, headers: any, baseUrl: string) {
  ctx.log(`ℹ️ Getting info for channel ${channel}...`);
  
  const params = new URLSearchParams({
    channel: channel
  });
  
  const response = await ctx.fetch(`${baseUrl}/conversations.info?${params}`, {
    method: 'GET',
    headers
  });
  
  const result = await response.json();
  
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error} - ${result.detail || 'Unknown error'}`);
  }
  
  ctx.log(`✅ Channel info retrieved successfully!`);
  ctx.log(`   Name: ${result.channel.name}`);
  ctx.log(`   Members: ${result.channel.num_members || 'Unknown'}`);
  ctx.log(`   Private: ${result.channel.is_private ? 'Yes' : 'No'}`);
  
  return {
    success: true,
    channel_info: result.channel,
    data: result
  };
}



// Helper function to fetch channels for UI dropdown
async function fetchChannelsForUI(ctx: any, headers: any, baseUrl: string) {
  ctx.log(`🔄 Fetching channels for UI dropdown...`);
  
  try {
    // Fetch all conversation types for comprehensive list
    const params = new URLSearchParams({
      exclude_archived: 'true',
      types: 'public_channel,private_channel,mpim,im',
      limit: '200' // Get more channels for better selection
    });
    
    const response = await ctx.fetch(`${baseUrl}/conversations.list?${params}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      ctx.log(`❌ HTTP Error Response: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }
    
    // Format channels for UI dropdown
    const formattedChannels = result.channels.map((channel: any) => {
      let label = '';
      let icon = '';
      
      if (channel.is_channel && !channel.is_private) {
        icon = '📢'; // Public channel
        label = `${icon} #${channel.name}`;
      } else if (channel.is_private) {
        icon = '🔒'; // Private channel/group
        label = `${icon} ${channel.name} (Private)`;
      } else if (channel.is_im) {
        icon = '💬'; // Direct message
        label = `${icon} DM: ${channel.user || 'User'}`;
      } else if (channel.is_mpim) {
        icon = '👥'; // Multi-party DM
        label = `${icon} Group DM: ${channel.name || 'Group'}`;
      } else {
        icon = '📁';
        label = `${icon} ${channel.name}`;
      }
      
      return {
        id: channel.id,
        label: label,
        name: channel.name,
        is_member: channel.is_member,
        is_private: channel.is_private
      };
    });
    
    // Sort channels: member channels first, then by type, then alphabetically
    formattedChannels.sort((a: any, b: any) => {
      // Members first
      if (a.is_member && !b.is_member) return -1;
      if (!a.is_member && b.is_member) return 1;
      
      // Then by name alphabetically
      return a.label.localeCompare(b.label);
    });
    
    ctx.log(`✅ Fetched ${formattedChannels.length} channels for UI`);
    ctx.log(`   Member channels: ${formattedChannels.filter((c: any) => c.is_member).length}`);
    ctx.log(`   Non-member channels: ${formattedChannels.filter((c: any) => !c.is_member).length}`);
    
    return {
      success: true,
      channels: formattedChannels,
      total_count: formattedChannels.length,
      member_count: formattedChannels.filter((c: any) => c.is_member).length,
      data: result
    };
    
  } catch (error: any) {
    ctx.log(`❌ Failed to fetch channels for UI: ${error.message}`);
    
    // Return default channels if API fails
    const defaultChannels = [
      { id: '#general', label: '📢 #general (Default)', name: 'general', is_member: true, is_private: false },
      { id: '#random', label: '📢 #random (Default)', name: 'random', is_member: true, is_private: false },
      { id: 'manual', label: '🔧 Enter channel manually', name: 'manual', is_member: false, is_private: false }
    ];
    
    return {
      success: false,
      channels: defaultChannels,
      error: error.message,
      fallback: true
    };
  }
}

// Export all integration blocks
export const integrationBlocks = {
  airtable: airtableBlock,
  arxiv: arxivBlock,
  browseruse: browserUseBlock,
  clay: clayBlock,
  confluence: confluenceBlock,
  discord: discordBlock,
  elevenlabs: elevenLabsBlock,
  exa: exaBlock,
  file: fileBlock,
  firecrawl: firecrawlBlock,
  github: githubBlock,
  gmail: gmailBlock,
  google: googleBlock,
  googlecalendar: googleCalendarBlock,
  googledocs: googleDocsBlock,
  googledrive: googleDriveBlock,
  googlesheets: googleSheetsBlock,
  huggingface: huggingFaceBlock,
  hunter: hunterBlock,
  imagegenerator: imageGeneratorBlock,
  jina: jinaBlock,
  jira: jiraBlock,
  linear: linearBlock,
  linkedin: linkedInBlock,
  mem0: mem0Block,
  microsoftexcel: microsoftExcelBlock,
  microsoftplanner: microsoftPlannerBlock,
  microsoftteams: microsoftTeamsBlock,
  mistralparse: mistralParseBlock,
  notion: notionBlock,
  onedrive: oneDriveBlock,
  openai: openAIBlock,
  outlook: outlookBlock,
  perplexity: perplexityBlock,
  pinecone: pineconeBlock,
  qdrant: qdrantBlock,
  reddit: redditBlock,
  s3: s3Block,
  serper: serperBlock,
  sharepoint: sharePointBlock,
  slack: slackBlock,
  stagehand: stagehandBlock,
  stagehandagent: stagehandAgentBlock,
  supabase: supabaseBlock,
  tavily: tavilyBlock,
  telegram: telegramBlock,
  thinking: thinkingBlock,
  translate: translateBlock,
  twilio: twilioBlock,
  typeform: typeformBlock,
  vision: visionBlock,
  wealthbox: wealthboxBlock,
  webhook: webhookBlock,
  whatsapp: whatsappBlock,
  wikipedia: wikipediaBlock,
  workflow: workflowBlock,
  x: xBlock,
  youtube: youTubeBlock,
};