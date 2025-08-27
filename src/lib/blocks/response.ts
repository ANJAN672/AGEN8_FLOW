import { CheckCircle } from 'lucide-react';
import { createElement } from 'react';
import type { FC } from 'react';
import { BlockConfig } from '../types';
// import { apiClient } from '@/lib/api';

const CheckIcon: FC<{ size?: number }> = ({ size }) => createElement(CheckCircle, { size });

export const responseBlock: BlockConfig = {
  type: 'response',
  name: 'Response',
  description: 'Final output of the workflow',
  category: 'io',
  bgColor: '#22c55e',
  icon: CheckIcon,
  subBlocks: [
    {
      id: 'message',
      title: 'Response Message',
      type: 'expression',
      layout: 'full',
      placeholder: 'Hello {{ $json.user.firstName }}\nStatus: {{ $prev.status ?? "ok" }}\nID: {{ $node("airtable").records.at(-1).id }}\n{{{ $util.pretty($node("http")) }}}\n{{ $env("BASE_URL") }}/u/{{ $params.userId }}',
      rows: 3
    },
    {
      id: 'showPrevJson',
      title: 'Show previous output (pretty JSON)',
      type: 'toggle',
      layout: 'half'
    },
    {
      id: 'previewNode',
      title: 'Preview node alias or ID (optional)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'e.g., airtable, notion, prev'
    }
  ],
  inputs: {
    message: { type: 'string', description: 'Response message' },
    showPrevJson: { type: 'any', description: 'Pretty-print previous node output' },
    previewNode: { type: 'string', description: 'Alias or node ID to preview' },
    data: { type: 'any', description: 'Response data' }
  },
  outputs: {
    response: { type: 'json', description: 'Final workflow response' }
  },
  async run(ctx) {
    const { message, showPrevJson, previewNode, data } = ctx.inputs as {
      message?: unknown;
      showPrevJson?: unknown;
      previewNode?: unknown;
      data?: unknown;
    };

    const allNodeOutputs = (ctx.getNodeOutput('*') || {}) as Record<string, { output?: unknown; meta?: unknown } | Record<string, unknown>>;

    // Normalize to expected shape: { aliasOrId: { output, meta } }
    const normalizedNodes: Record<string, { output: unknown; meta: unknown }> = Object.fromEntries(
      Object.entries(allNodeOutputs).map(([k, v]) => {
        if (v && typeof v === 'object' && 'output' in (v as Record<string, unknown>)) {
          const known = v as { output: unknown; meta?: unknown };
          return [k, { output: known.output, meta: known.meta }];
        }
        return [k, { output: v, meta: {} }];
      })
    );

    const ids = Object.keys(normalizedNodes);
    const lastId = ids[ids.length - 1];
    const prevOutput = lastId ? normalizedNodes[lastId].output : undefined;

    const current = {
      alias: ctx.nodeId,
      params: ctx.inputs ?? {},
      item: { json: ctx.inputs ?? {}, binary: null },
    };

    const context = {
      nodes: normalizedNodes,
      current,
      items: [current.item],
      env: ctx.env ?? {},
      secrets: {},
      workflow: { id: ctx.workflowId, name: 'workflow', run: { id: 'run', startedAt: new Date().toISOString(), now: new Date().toISOString() } },
      options: { strict: false, prettyIndent: 2 },
    };

    // Resolve message locally using client-side renderer stub
    const { simpleRender } = await import('@/lib/expression');

    // Auto-fallback: when no message provided or resolves to empty, build a dynamic summary
    const hasUserTpl = typeof message === 'string' ? message.trim().length > 0 : !!message;
    const baseTpl: unknown = hasUserTpl ? message : 'Workflow completed';
    const { rendered, errors } = simpleRender(baseTpl, context);

    if (errors?.length) {
      ctx.log(`Expression warnings: ${errors.map((e) => `${e.expr}: ${e.message}`).join(' | ')}`);
    }

    let finalMessage = typeof rendered === 'string' ? rendered.trim() : JSON.stringify(rendered);

    // If still empty, produce a readable summary using all node outputs
    if (!finalMessage) {
      try {
        const summaryLines: string[] = [];
        const keys = Object.keys(normalizedNodes);
        for (const k of keys) {
          const out = normalizedNodes[k].output;
          const pretty = typeof out === 'string' ? out : JSON.stringify(out, null, 2);
          summaryLines.push(`- ${k}:\n${pretty}`);
        }
        finalMessage = summaryLines.length ? `Workflow completed. Outputs:\n${summaryLines.join('\n\n')}` : 'Workflow completed.';
      } catch {
        finalMessage = 'Workflow completed.';
      }
    }

    const response: Record<string, unknown> = {
      message: finalMessage,
      timestamp: new Date().toISOString(),
      workflowId: ctx.workflowId,
    };
    if (typeof data !== 'undefined') response.data = data;

    if (showPrevJson) {
      let source: unknown = null;
      if (typeof previewNode === 'string' && previewNode.trim()) {
        const hit = normalizedNodes[previewNode.trim()];
        source = hit?.output ?? null;
      } else {
        source = prevOutput ?? null;
      }
      response.preview = source;
    }

    ctx.setNodeOutput('response', response);
    ctx.log(`📋 Final response: ${finalMessage}`);
    return response;
  },
};