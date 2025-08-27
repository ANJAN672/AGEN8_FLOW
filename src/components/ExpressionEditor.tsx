import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useNodes } from '@/state/nodes';
// import { apiClient } from '@/lib/api';
import type { ExpressionContext } from '@/lib/expression';

type Props = {
  value: string;
  onChange: (v: string) => void;
  // Builds /api/resolve context for preview
  contextBuilder?: () => Promise<ExpressionContext> | ExpressionContext;
};

export function ExpressionEditor({ value, onChange, contextBuilder }: Props) {
  const { registry, fetchRegistry } = useNodes();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!registry) fetchRegistry();
  }, [registry, fetchRegistry]);

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) return onChange((value || '') + snippet);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    // reset caret
    setTimeout(() => {
      el.focus();
      const caret = start + snippet.length;
      el.setSelectionRange(caret, caret);
    }, 0);
  };

  const handlePreview = async () => {
    try {
      const defaultCtx: ExpressionContext = {
        nodes: {},
        current: { alias: 'current', params: {}, item: { json: {}, binary: null } },
        items: [],
        env: {},
        secrets: {},
        workflow: { id: 'wf', name: 'workflow', run: { id: 'run', startedAt: new Date().toISOString(), now: new Date().toISOString() } },
        options: { strict: false, prettyIndent: 2 }
      };
      const ctx = contextBuilder ? await contextBuilder() : defaultCtx;
      // Local preview using client-side stub renderer to avoid backend
      const { simpleRender } = await import('@/lib/expression');
      const { rendered, errors } = simpleRender(value, ctx);
      const out = typeof rendered === 'string' ? rendered : JSON.stringify(rendered, null, 2);
      const diagnostics = errors.map(e => `${e.expr}: ${e.message}`).join(' | ') || 'none';
      alert(`Preview:\n${out}\n\nDiagnostics: ${diagnostics}`);
    } catch (e) {
      alert('Preview error: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">Data Picker</Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0">
            <Command>
              <CommandInput placeholder="Search..." />
              <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Workflow">
                  <CommandItem onSelect={() => insertAtCursor('{{ $now() }}')}>$now()</CommandItem>
                  <CommandItem onSelect={() => insertAtCursor('{{ $today() }}')}>$today()</CommandItem>
                  <CommandItem onSelect={() => insertAtCursor('{{ $workflow }}')}>$workflow</CommandItem>
                </CommandGroup>
                <CommandGroup heading="Current Item">
                  <CommandItem onSelect={() => insertAtCursor('{{ $json }}')}>$json</CommandItem>
                  <CommandItem onSelect={() => insertAtCursor('{{ $params }}')}>$params</CommandItem>
                </CommandGroup>
                {registry && (
                  <CommandGroup heading="Nodes">
                    {registry.nodes.map((n) => (
                      <CommandItem key={n.alias} onSelect={() => insertAtCursor(`{{ $node("${n.alias}") }}`)}>
                        $node("{n.alias}") — {n.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandGroup heading="Environment">
                  <CommandItem onSelect={() => insertAtCursor('{{ $env("VAR") }}')}>$env("VAR")</CommandItem>
                </CommandGroup>
                <CommandGroup heading="Secrets">
                  <CommandItem onSelect={() => insertAtCursor('{{ $secret("KEY") }}')}>$secret("KEY")</CommandItem>
                </CommandGroup>
                <CommandGroup heading="Helpers">
                  <CommandItem onSelect={() => insertAtCursor('{{{ $util.pretty($node("alias")) }}}')}>$util.pretty</CommandItem>
                  <CommandItem onSelect={() => insertAtCursor('{{ $date.format($now(), "yyyy-MM-dd") }}')}>$date.format</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button variant="secondary" size="sm" onClick={handlePreview}>Preview</Button>
      </div>
      <textarea
        ref={textareaRef}
        className="w-full min-h-24 text-sm rounded-md border p-2 bg-background"
        placeholder="/api or https://your-backend.com/api"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        rows={6}
      />
    </div>
  );
}