import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/lib/store';
import { OptimizedInput } from '@/components/forms/OptimizedInput';

export function VariablesPanel() {
  const { workspaces, currentWorkspaceId, currentWorkflowId, setWorkflowVariable, removeWorkflowVariable, clearWorkflowVariables } = useAppStore();

  const currentWorkspace = workspaces.find(ws => ws.id === currentWorkspaceId);
  const currentWorkflow = currentWorkspace?.workflows.find(wf => wf.id === currentWorkflowId);
  const variables = useMemo(() => currentWorkflow?.variables ?? {}, [currentWorkflow?.variables]);

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const entries = useMemo(() => Object.entries(variables), [variables]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="text-sm font-medium">Workflow Variables</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => clearWorkflowVariables()}>Clear All</Button>
        </div>
      </div>

      <div className="p-3 flex items-center gap-2 border-b">
        <OptimizedInput id="new-key" placeholder="Key" value={newKey} onChange={setNewKey} />
        <OptimizedInput id="new-value" placeholder="Value" value={newValue} onChange={setNewValue} />
        <Button size="sm" onClick={() => {
          if (!newKey) return;
          setWorkflowVariable(newKey, newValue);
          setNewKey('');
          setNewValue('');
        }}>Add</Button>
      </div>

      <div className="flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            No variables yet. Add a key and value.
          </div>
        ) : (
          <div className="divide-y">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 p-3">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input value={key} readOnly className="h-8" />
                  <OptimizedInput 
                    id={`var-${key}`} 
                    value={String(value)} 
                    onChange={(newValue) => setWorkflowVariable(key, newValue)} 
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeWorkflowVariable(key)}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}