// Auto-generated example workflows covering non-Google blocks
// Import in a dev page or tool to run and validate blocks

import { getAllBlocks } from '@/lib/blocks/registry';
import type { Workflow, WorkflowNode, WorkflowEdge } from '@/lib/types';

// Helper to exclude Google-related blocks (including youtube)
const isGoogleRelated = (t: string) =>
  t.startsWith('google') || t === 'google' || t === 'youtube' || t === 'googledrive' || t === 'googledocs' || t === 'googlesheets' || t === 'googlecalendar';

// Defaults for blocks so examples run out-of-the-box
function defaultsFor(type: string): Record<string, unknown> {
  switch (type) {
    case 'function':
      return { code: `return { content: 'hello', value: 123, ts: new Date().toISOString() };` };
    case 'api':
      return { method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1', headers: '{}', timeout: 8000 };
    case 'agent':
      return { systemPrompt: 'Be brief', userPrompt: 'Say hello', model: 'ollama:llama3.2', endpoint: 'http://localhost:11434', temperature: 0.1 };
    case 'condition':
      return { expression: 'true' };
    case 'response':
      return { message: 'Done: {{prev.content}}' };
    default:
      // Integrations in this repo are mocked, only apiKey is required
      return { apiKey: 'test-key' };
  }
}

function wf(baseName: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): Workflow {
  return {
    id: `${baseName}-${Date.now()}`,
    name: baseName,
    nodes,
    edges,
    starterId: 'starter',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function starter(): WorkflowNode { return { id: 'starter', type: 'starter', position: { x: 0, y: 0 }, data: {} }; }

// 1) Basic Function -> Response
export function exampleFunctionToResponse(): Workflow {
  const n1 = starter();
  const n2: WorkflowNode = { id: 'fn1', type: 'function', position: { x: 300, y: 0 }, data: defaultsFor('function') };
  const n3: WorkflowNode = { id: 'res', type: 'response', position: { x: 600, y: 0 }, data: { message: 'Function said: {{prev.result}}' } };
  const e1: WorkflowEdge = { id: 'e1', source: n1.id, target: n2.id };
  const e2: WorkflowEdge = { id: 'e2', source: n2.id, target: n3.id };
  return wf('Function -> Response', [n1, n2, n3], [e1, e2]);
}

// 2) API GET -> Condition -> Response
export function exampleApiToCondition(): Workflow {
  const n1 = starter();
  const n2: WorkflowNode = { id: 'api1', type: 'api', position: { x: 300, y: 0 }, data: defaultsFor('api') };
  const n3: WorkflowNode = { id: 'cond', type: 'condition', position: { x: 600, y: 0 }, data: { expression: '{{prev.status}} == 200' } };
  const n4: WorkflowNode = { id: 'res', type: 'response', position: { x: 900, y: 0 }, data: { message: 'API status: {{api1.status}}' } };
  const e1: WorkflowEdge = { id: 'e1', source: n1.id, target: n2.id };
  const e2: WorkflowEdge = { id: 'e2', source: n2.id, target: n3.id };
  const e3: WorkflowEdge = { id: 'e3', source: n3.id, target: n4.id };
  return wf('API -> Condition -> Response', [n1, n2, n3, n4], [e1, e2, e3]);
}

// 3) Agent (Ollama) -> Response
export function exampleAgentToResponse(): Workflow {
  const n1 = starter();
  const n2: WorkflowNode = { id: 'agent', type: 'agent', position: { x: 300, y: 0 }, data: defaultsFor('agent') };
  const n3: WorkflowNode = { id: 'res', type: 'response', position: { x: 600, y: 0 }, data: { message: 'AI: {{agent.content}}' } };
  return wf('Agent -> Response', [n1, n2, n3], [
    { id: 'e1', source: n1.id, target: n2.id },
    { id: 'e2', source: n2.id, target: n3.id },
  ]);
}

// 4) Function -> API (uses prev output) -> Response
export function exampleFunctionToApi(): Workflow {
  const n1 = starter();
  const n2: WorkflowNode = { id: 'fn', type: 'function', position: { x: 300, y: 0 }, data: { code: `return { todoId: 1 };` } };
  const n3: WorkflowNode = { id: 'api', type: 'api', position: { x: 600, y: 0 }, data: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/{{fn.todoId}}' } };
  const n4: WorkflowNode = { id: 'res', type: 'response', position: { x: 900, y: 0 }, data: { message: 'Todo title: {{api.data.title}}' } };
  return wf('Function -> API -> Response', [n1, n2, n3, n4], [
    { id: 'e1', source: n1.id, target: n2.id },
    { id: 'e2', source: n2.id, target: n3.id },
    { id: 'e3', source: n3.id, target: n4.id },
  ]);
}

// 5) Chain many integrations (mocked) -> Response
export function exampleIntegrationsChain(): Workflow {
  // Pick a subset of non-Google integration blocks
  const all = getAllBlocks().filter(b => b.category === 'integrations' && !isGoogleRelated(b.type));
  const picked = all.slice(0, 6); // cap for readability
  const nodes: WorkflowNode[] = [starter()];
  const edges: WorkflowEdge[] = [];
  let prev = 'starter';
  let x = 300;
  picked.forEach((b, i) => {
    const id = `${b.type}-${i}`;
    nodes.push({ id, type: b.type, position: { x, y: 0 }, data: defaultsFor(b.type) });
    edges.push({ id: `e-${prev}-${id}`, source: prev, target: id });
    prev = id;
    x += 300;
  });
  nodes.push({ id: 'res', type: 'response', position: { x, y: 0 }, data: { message: 'Last status: {{prev.status}}' } });
  edges.push({ id: `e-${prev}-res`, source: prev, target: 'res' });
  return wf('Integrations Chain -> Response', nodes, edges);
}

// 6) Airtable mock -> Function -> Response
export function exampleAirtableToFunction(): Workflow {
  const n1 = starter();
  const n2: WorkflowNode = { id: 'airtable', type: 'airtable', position: { x: 300, y: 0 }, data: { apiKey: 'test-key', baseId: 'base', tableId: 'tbl' } };
  const n3: WorkflowNode = { id: 'fn', type: 'function', position: { x: 600, y: 0 }, data: { code: `return { table: '{{airtable.status}}' };` } };
  const n4: WorkflowNode = { id: 'res', type: 'response', position: { x: 900, y: 0 }, data: { message: 'Airtable says: {{fn.table}}' } };
  return wf('Airtable -> Function -> Response', [n1, n2, n3, n4], [
    { id: 'e1', source: n1.id, target: n2.id },
    { id: 'e2', source: n2.id, target: n3.id },
    { id: 'e3', source: n3.id, target: n4.id },
  ]);
}

// 7) GitHub mock -> Response
export function exampleGithubToResponse(): Workflow {
  const n1 = starter();
  const n2: WorkflowNode = { id: 'gh', type: 'github', position: { x: 300, y: 0 }, data: { apiKey: 'test-key', repository: 'owner/repo' } };
  const n3: WorkflowNode = { id: 'res', type: 'response', position: { x: 600, y: 0 }, data: { message: 'GitHub status: {{gh.status}}' } };
  return wf('GitHub -> Response', [n1, n2, n3], [
    { id: 'e1', source: n1.id, target: n2.id },
    { id: 'e2', source: n2.id, target: n3.id },
  ]);
}

// 8) Slack mock -> Function -> Response
export function exampleSlackToFunction(): Workflow {
  const n1 = starter();
  const n2: WorkflowNode = { id: 'sl', type: 'slack', position: { x: 300, y: 0 }, data: { apiKey: 'test-key' } };
  const n3: WorkflowNode = { id: 'fn', type: 'function', position: { x: 600, y: 0 }, data: { code: `return { content: 'Slack said: {{sl.status}}' };` } };
  const n4: WorkflowNode = { id: 'res', type: 'response', position: { x: 900, y: 0 }, data: { message: '{{fn.content}}' } };
  return wf('Slack -> Function -> Response', [n1, n2, n3, n4], [
    { id: 'e1', source: n1.id, target: n2.id },
    { id: 'e2', source: n2.id, target: n3.id },
    { id: 'e3', source: n3.id, target: n4.id },
  ]);
}

// 9) OpenAI integration (mocked) -> Response
export function exampleOpenAiIntegration(): Workflow {
  const n1 = starter();
  const n2: WorkflowNode = { id: 'oai', type: 'openai', position: { x: 300, y: 0 }, data: { apiKey: 'test-key' } };
  const n3: WorkflowNode = { id: 'res', type: 'response', position: { x: 600, y: 0 }, data: { message: 'OpenAI integration status: {{oai.status}}' } };
  return wf('OpenAI Integration -> Response', [n1, n2, n3], [
    { id: 'e1', source: n1.id, target: n2.id },
    { id: 'e2', source: n2.id, target: n3.id },
  ]);
}

// 10) File mock -> Response
export function exampleFileToResponse(): Workflow {
  const n1 = starter();
  const n2: WorkflowNode = { id: 'file', type: 'file', position: { x: 300, y: 0 }, data: { apiKey: 'test-key', operation: 'read', filePath: '/tmp/demo.txt' } };
  const n3: WorkflowNode = { id: 'res', type: 'response', position: { x: 600, y: 0 }, data: { message: 'File op: {{file.status}}' } };
  return wf('File -> Response', [n1, n2, n3], [
    { id: 'e1', source: n1.id, target: n2.id },
    { id: 'e2', source: n2.id, target: n3.id },
  ]);
}

// Utility: build a single workflow chaining ALL non-Google blocks (compact)
export function chainAllNonGoogleBlocks(): Workflow {
  const n0 = starter();
  const all = getAllBlocks().filter(b => !isGoogleRelated(b.type) && b.type !== 'starter');
  const nodes: WorkflowNode[] = [n0];
  const edges: WorkflowEdge[] = [];
  let prev = 'starter';
  let x = 300;
  all.forEach((b, i) => {
    const id = `${b.type}-${i}`;
    nodes.push({ id, type: b.type, position: { x, y: 0 }, data: defaultsFor(b.type) });
    edges.push({ id: `e-${prev}-${id}`, source: prev, target: id });
    prev = id;
    x += 300;
  });
  nodes.push({ id: 'res', type: 'response', position: { x, y: 0 }, data: { message: 'Last: {{prev.status}}' } });
  edges.push({ id: `e-${prev}-res`, source: prev, target: 'res' });
  return wf('Chain All Non-Google Blocks', nodes, edges);
}

export const allExamples: Array<{ name: string; build: () => Workflow }> = [
  { name: 'Function -> Response', build: exampleFunctionToResponse },
  { name: 'API -> Condition -> Response', build: exampleApiToCondition },
  { name: 'Agent -> Response', build: exampleAgentToResponse },
  { name: 'Function -> API -> Response', build: exampleFunctionToApi },
  { name: 'Integrations Chain -> Response', build: exampleIntegrationsChain },
  { name: 'Airtable -> Function -> Response', build: exampleAirtableToFunction },
  { name: 'GitHub -> Response', build: exampleGithubToResponse },
  { name: 'Slack -> Function -> Response', build: exampleSlackToFunction },
  { name: 'OpenAI Integration -> Response', build: exampleOpenAiIntegration },
  { name: 'File -> Response', build: exampleFileToResponse },
  { name: 'Chain All Non-Google Blocks', build: chainAllNonGoogleBlocks },
];