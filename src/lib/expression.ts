// Frontend mirror types for expression context and helpers (pure, no network)
export type ExpressionContext = {
  nodes: Record<string, { output: unknown; meta?: unknown }>;
  current: { alias: string; params: Record<string, unknown>; item: { json: Record<string, unknown>; binary: unknown } };
  items: Array<{ json: Record<string, unknown>; binary: unknown }>;
  env: Record<string, string>;
  secrets: Record<string, string>;
  workflow: { id: string; name: string; run: { id: string; startedAt: string; now: string } };
  options?: { strict?: boolean; prettyIndent?: number };
};

// Simple client-side renderer used only for local previews if needed
export function simpleRender(template: unknown, context: ExpressionContext): { rendered: unknown; errors: Array<{ expr: string; message: string }> } {
  const errors: Array<{ expr: string; message: string }> = [];
  const prettyIndent = context.options?.prettyIndent ?? 2;

  const renderString = (tpl: string): string => {
    const triple = /\{\{\{\s*([^}]+)\s*\}\}\}/g;
    const single = /\{\{\s*([^}]+)\s*\}\}/g;

    const evalSafe = (expr: string): unknown => {
      try {
        // Not executing code on client intentionally; this is only a stub used rarely.
        // Always return empty for safety; backend is the source of truth.
        return '';
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ expr, message: msg });
        return '';
      }
    };

    let out = tpl.replace(triple, (_m, e) => {
      const v = evalSafe(String(e));
      if (v == null) return 'null';
      return typeof v === 'string' ? v : JSON.stringify(v, null, prettyIndent);
    });
    out = out.replace(single, (_m, e) => {
      const v = evalSafe(String(e));
      if (v == null) return '';
      return typeof v === 'string' ? v : JSON.stringify(v);
    });
    return out;
  };

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return renderString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) o[k] = walk(v);
      return o;
    }
    return node;
  };

  return { rendered: walk(template), errors };
}