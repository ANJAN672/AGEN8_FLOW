import { Workflow, RunContext, ExecutionLog, NodeExecution, WorkflowExecution } from '../types';
import { getBlockConfig } from '../blocks/registry';

export class ExecutionEngine {
  private abortController: AbortController | null = null;
  private onLog?: (log: ExecutionLog) => void;
  private onNodeUpdate?: (nodeId: string, execution: NodeExecution) => void;

  constructor(
    onLog?: (log: ExecutionLog) => void,
    onNodeUpdate?: (nodeId: string, execution: NodeExecution) => void
  ) {
    this.onLog = onLog;
    this.onNodeUpdate = onNodeUpdate;
  }

  async executeWorkflow(workflow: Workflow, env: Record<string, string> = {}, options?: { onlyNodeId?: string; existingExecution?: WorkflowExecution }): Promise<WorkflowExecution> {
    this.abortController = new AbortController();
    
    const execution: WorkflowExecution = options?.existingExecution ? {
      ...options.existingExecution,
      status: 'running'
    } : {
      id: `exec-${Date.now()}`,
      workflowId: workflow.id,
      status: 'running',
      startTime: new Date().toISOString(),
      logs: [],
      nodeExecutions: {}
    };

    this.log(execution, 'info', `🚀 Starting workflow: ${workflow.name}`);

    try {
      // Validate workflow
      this.validateWorkflow(workflow);

      // Build alias map: alias or type -> nodeId (null if ambiguous)
      const aliasMap: Record<string, string | null> = {};
      const seen: Record<string, number> = {};
      for (const n of workflow.nodes) {
        const alias = String((n.data as Record<string, unknown>)?.alias ?? (n.data as Record<string, unknown>)?.refName ?? n.type).trim();
        if (!alias) continue;
        if (aliasMap[alias] === undefined) {
          aliasMap[alias] = n.id;
          seen[alias] = 1;
        } else {
          aliasMap[alias] = null; // ambiguous
          seen[alias]! += 1;
        }
      }

      // Create execution context
      const nodeOutputs: Record<string, Record<string, unknown>> = {};
      
      // For single node execution, populate existing node outputs from previous executions
      const singleNodeId = options?.onlyNodeId?.trim();
      if (singleNodeId && execution.nodeExecutions) {
        // Populate nodeOutputs with existing execution results
        for (const [nodeId, nodeExecution] of Object.entries(execution.nodeExecutions)) {
          if (nodeExecution.outputs) {
            nodeOutputs[nodeId] = nodeExecution.outputs;
            this.log(execution, 'info', `📋 Restored outputs from previous execution: ${nodeId}`);
          }
        }
      }
      
      // Execute nodes in topological order (simplified for MVP)
      const startNode = singleNodeId ? workflow.nodes.find(n => n.id === singleNodeId) : workflow.nodes.find(node => node.id === workflow.starterId);
      if (!startNode) {
        throw new Error(singleNodeId ? 'Selected node not found' : 'Start node not found');
      }

      // Execute reachable graph in BFS order from the starter, or single node only
      const visited = new Set<string>();
      const queue: string[] = [startNode.id];

      while (queue.length > 0) {
        if (this.abortController?.signal.aborted) {
          execution.status = 'cancelled';
          break;
        }

        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        try {
          await this.executeNode(workflow, node, execution, env, nodeOutputs, aliasMap, singleNodeId);
        } catch (error) {
          // If a node fails, stop the entire workflow execution
          execution.status = 'error';
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.log(execution, 'error', `❌ Node "${node.id}" failed: ${errorMessage}`);
          throw error; // Re-throw to be caught by outer try-catch
        }

        // If running single node, do not traverse further
        if (!singleNodeId) {
          const nextNodes = this.getConnectedNodes(workflow, nodeId);
          for (const n of nextNodes) {
            if (!visited.has(n.id)) queue.push(n.id);
          }
        }
      }

      if (execution.status !== 'cancelled') {
        execution.status = 'success';
        this.log(execution, 'info', '✅ Workflow completed');
      }

    } catch (error) {
      execution.status = 'error';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(execution, 'error', `💥 Workflow failed: ${errorMessage}`);
    }

    execution.endTime = new Date().toISOString();
    execution.duration = new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime();

    return execution;
  }

  private async executeNode(
    workflow: Workflow,
    node: { id: string; type: string; data: Record<string, unknown> },
    execution: WorkflowExecution,
    env: Record<string, string>,
    nodeOutputs: Record<string, Record<string, unknown>>,
    aliasMap: Record<string, string | null>,
    singleNodeId?: string
  ): Promise<void> {
    const nodeExecution: NodeExecution = {
      nodeId: node.id,
      status: 'running',
      startTime: new Date().toISOString()
    };

    execution.nodeExecutions[node.id] = nodeExecution;
    this.onNodeUpdate?.(node.id, nodeExecution);

    try {
      // Only log for non-starter nodes to reduce noise
      if (node.type !== 'starter') {
        this.log(execution, 'info', `⚡ ${node.type}: ${node.id}`, node.id);
      }

  const blockConfig = getBlockConfig(node.type);
      if (!blockConfig || !blockConfig.run) {
        throw new Error(`Block type ${node.type} not found or not executable`);
      }

      // Compute single previous source if exists (for {{prev.*}})
      const incoming = workflow.edges.filter(e => e.target === node.id).map(e => e.source);
      const prevId = incoming.length === 1 ? incoming[0] : undefined;

      // Resolve template strings in inputs using previous node outputs, aliases, and env
      const getByPath = (obj: unknown, path: string): unknown => {
        if (!obj || typeof obj !== 'object') return undefined;
        const parts = path.split('.');
        let cur: Record<string, unknown> | undefined = obj as Record<string, unknown>;
        for (const p of parts) {
          if (!cur) return undefined;
          const next = (cur as Record<string, unknown>)[p];
          if (next !== null && typeof next === 'object') {
            cur = next as Record<string, unknown>;
          } else {
            cur = next as unknown as Record<string, unknown>;
          }
        }
        return cur as unknown;
      };

      const resolveTemplatesDeep = (val: unknown): unknown => {
        if (typeof val === 'string') {
          return val.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, expr) => {
            const raw = String(expr).trim();
            const [root, ...rest] = raw.split('.');
            const path = rest.join('.');
            if (!root) return '';
            // {{env.API_KEY}}
            if (root === 'env') {
              return path ? (env[path] ?? '') : '';
            }
            // {{prev.key}} or {{prev.deep.path}}
            if (root === 'prev') {
              if (!prevId) return '';
              const v = path ? getByPath(nodeOutputs[prevId] ?? {}, path) : nodeOutputs[prevId];
              return v != null ? String(v) : '';
            }
            // Resolve aliases or types: {{airtable.status}}, {{notion.data.title}}
            let targetId: string | null | undefined = aliasMap[root];
            if (targetId === undefined) {
              // Not in alias map: maybe it's a concrete nodeId
              targetId = root;
            }
            if (targetId === null) {
              // Ambiguous alias; return empty for safety
              return '';
            }
            const outputs = nodeOutputs[targetId];
            if (!outputs) return '';
            const v = path ? getByPath(outputs, path) : outputs;
            return v != null ? String(v) : '';
          });
        }
        if (Array.isArray(val)) return val.map(v => resolveTemplatesDeep(v));
        if (val && typeof val === 'object') {
          const o: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            o[k] = resolveTemplatesDeep(v);
          }
          return o;
        }
        return val;
      };

      const resolvedInputs = resolveTemplatesDeep(node.data) as Record<string, unknown>;

      // Create run context
      const context: RunContext = {
        workflowId: workflow.id,
        nodeId: node.id,
        inputs: resolvedInputs,
        env,
        fetch: this.createFetchWithTimeout(this.abortController!.signal),
        log: (message: unknown) => this.log(execution, 'info', String(message), node.id),
        getNodeOutput: (nodeId: string, key?: string) => {
          // Special case: if nodeId is '*', return all node outputs for debugging
          if (nodeId === '*') {
            return nodeOutputs;
          }
          // Alias 'prev' to the single previous node when available
          const nid = nodeId === 'prev' && prevId ? prevId : nodeId;
          const outputs = nodeOutputs[nid];
          return key ? outputs?.[key] : outputs;
        },
        setNodeOutput: (key: string, value: unknown) => {
          if (!nodeOutputs[node.id]) {
            nodeOutputs[node.id] = {};
          }
          nodeOutputs[node.id][key] = value;
        },
        abortSignal: this.abortController!.signal,
        // Add flag to indicate single node execution for better testing experience
        isSingleNodeExecution: !!singleNodeId
      };

      // Execute the block
      const result = await blockConfig.run(context);

      nodeExecution.status = 'success';
      
      // Combine outputs set via setNodeOutput with the return value
      const returnOutputs = (result && typeof result === 'object' && !Array.isArray(result))
        ? (result as Record<string, unknown>)
        : { value: result };
      
      nodeExecution.outputs = {
        ...(nodeOutputs[node.id] || {}), // Outputs set via setNodeOutput
        ...returnOutputs // Return value from the block
      };
      
      nodeExecution.endTime = new Date().toISOString();
      nodeExecution.duration = new Date(nodeExecution.endTime).getTime() - new Date(nodeExecution.startTime).getTime();

      // Auto-propagate object-like results to nodeOutputs so downstream nodes can read them via getNodeOutput
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        nodeOutputs[node.id] = {
          ...(nodeOutputs[node.id] || {}),
          ...(result as Record<string, unknown>),
        };
      }

      // Only log completion for non-starter nodes
      if (node.type !== 'starter') {
        this.log(execution, 'info', `✅ ${node.type} completed`, node.id);
      }

    } catch (error) {
      nodeExecution.status = 'error';
      nodeExecution.error = error instanceof Error ? error.message : 'Unknown error';
      nodeExecution.endTime = new Date().toISOString();
      nodeExecution.duration = new Date(nodeExecution.endTime).getTime() - new Date(nodeExecution.startTime).getTime();

      this.log(execution, 'error', `🚨 Node failed: ${nodeExecution.error}`, node.id);
      throw error;
    }

    this.onNodeUpdate?.(node.id, nodeExecution);
  }

  private validateWorkflow(workflow: Workflow): void {
    if (!workflow.nodes || workflow.nodes.length === 0) {
      throw new Error('Workflow has no nodes');
    }

    const startNode = workflow.nodes.find(node => node.id === workflow.starterId);
    if (!startNode) {
      throw new Error('Start node not found');
    }

    // Additional validation could go here
  }

  private getConnectedNodes(workflow: Workflow, fromNodeId: string): Array<{ id: string; type: string; data: Record<string, unknown> }> {
    const connectedNodeIds = workflow.edges
      .filter(edge => edge.source === fromNodeId)
      .map(edge => edge.target);

    return workflow.nodes
      .filter(node => connectedNodeIds.includes(node.id))
      .map(n => ({ id: n.id, type: n.type, data: n.data as Record<string, unknown> }));
  }

  private createFetchWithTimeout(engineSignal?: AbortSignal): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      // Tie request to engine abort as well
      const onEngineAbort = () => controller.abort();
      try {
        if (engineSignal) {
          if (engineSignal.aborted) controller.abort();
          else engineSignal.addEventListener('abort', onEngineAbort);
        }

        const response = await fetch(input, {
          ...init,
          signal: init?.signal ?? controller.signal,
        });
        clearTimeout(timeout);
        return response;
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      } finally {
        if (engineSignal) engineSignal.removeEventListener('abort', onEngineAbort);
      }
    };
  }

  private log(execution: WorkflowExecution, level: 'info' | 'warn' | 'error', message: string, nodeId?: string): void {
    const log: ExecutionLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      nodeId,
      message,
      level,
      timestamp: new Date().toISOString()
    };

    execution.logs.push(log);
    this.onLog?.(log);
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

export async function executeWorkflow(
  workflow: Workflow,
  env: Record<string, string> = {},
  onLog?: (log: ExecutionLog) => void,
  onNodeUpdate?: (nodeId: string, execution: NodeExecution) => void,
  options?: { onlyNodeId?: string; existingExecution?: WorkflowExecution }
): Promise<WorkflowExecution> {
  const engine = new ExecutionEngine(onLog, onNodeUpdate);
  return engine.executeWorkflow(workflow, env, options);
}

// Starts a workflow and returns the engine instance and the running promise.
// Use engine.stop() to cancel.
export function startWorkflow(
  workflow: Workflow,
  env: Record<string, string> = {},
  onLog?: (log: ExecutionLog) => void,
  onNodeUpdate?: (nodeId: string, execution: NodeExecution) => void,
  options?: { onlyNodeId?: string; existingExecution?: WorkflowExecution }
): { engine: ExecutionEngine; promise: Promise<WorkflowExecution> } {
  const engine = new ExecutionEngine(onLog, onNodeUpdate);
  const promise = engine.executeWorkflow(workflow, env, options);
  return { engine, promise };
}