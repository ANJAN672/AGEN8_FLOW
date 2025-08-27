import { ReactNode } from 'react';
import { z } from 'zod';

// Field condition types
export type FieldCondition =
  | { field: string; value: unknown; not?: boolean; and?: FieldCondition }
  | (() => boolean);

// Block field types
export type BlockField = {
  id: string;
  title: string;
  type: 'short-input' | 'long-input' | 'code' | 'slider' | 'combobox' | 'tool-input' | 'toggle' | 'number' | 'datetime';
  layout: 'full' | 'half';
  placeholder?: string;
  rows?: number;
  required?: boolean;
  options?: (() => Array<{ id: string; label: string; icon?: ReactNode }>);
  language?: 'json' | 'typescript' | 'javascript' | 'text';
  password?: boolean;
  condition?: FieldCondition;
  wandConfig?: {
    enabled: boolean;
    maintainHistory?: boolean;
    prompt?: string;
    placeholder?: string;
    generationType?: 'system-prompt' | 'json-schema' | 'code';
  };
  min?: number;
  max?: number;
  step?: number;
};

// Block IO types
export type BlockIO = {
  inputs: Record<string, { type: 'string' | 'number' | 'json' | 'any'; description?: string; schema?: unknown }>;
  outputs: Record<string, { type: 'string' | 'number' | 'json' | 'any'; description?: string }>;
};

// Block configuration
export type BlockConfig<TResp = unknown> = {
  type: string;
  name: string;
  description?: string;
  longDescription?: string;
  docsLink?: string;
  category: 'blocks' | 'tools' | 'io' | 'control' | 'integrations';
  bgColor?: string;
  icon: React.FC<{ size?: number }>;
  subBlocks?: BlockField[];
  tools?: {
    access?: string[];
    config?: {
  tool?: (params: unknown) => unknown;
  params?: (params: unknown) => unknown;
    };
  };
  inputs: BlockIO['inputs'];
  outputs: BlockIO['outputs'];
  run?: (ctx: RunContext) => Promise<TResp>;
};

// Execution context
export type RunContext = {
  workflowId: string;
  nodeId: string;
  inputs: Record<string, unknown>;
  env: Record<string, string>;
  fetch: typeof fetch;
  log: (msg: unknown) => void;
  getNodeOutput: (nodeId: string, key?: string) => unknown;
  setNodeOutput: (key: string, val: unknown) => void;
  abortSignal: AbortSignal;
  isSingleNodeExecution?: boolean;
};

// Workflow types
export type WorkflowNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
};

export type Workflow = {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  starterId: string;
  variables?: Record<string, string>;
};

export type Workspace = {
  id: string;
  name: string;
  workflows: Workflow[];
  createdAt: string;
  updatedAt: string;
};

// Execution types
export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

export type ExecutionLog = {
  id: string;
  nodeId?: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  timestamp: string;
};

export type NodeExecution = {
  nodeId: string;
  status: ExecutionStatus;
  startTime?: string;
  endTime?: string;
  duration?: number;
  outputs?: Record<string, unknown>;
  error?: string;
};

export type WorkflowExecution = {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startTime: string;
  endTime?: string;
  duration?: number;
  logs: ExecutionLog[];
  nodeExecutions: Record<string, NodeExecution>;
  result?: unknown;
};

// Validation schemas
export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.string(), z.any())
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
    label: z.string().optional()
  })),
  createdAt: z.string(),
  updatedAt: z.string(),
  starterId: z.string()
});

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  workflows: z.array(WorkflowSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});