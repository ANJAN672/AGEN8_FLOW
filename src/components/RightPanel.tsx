import { Button } from '@/components/ui/button';
import { MessageSquare, Terminal, Bot, Settings, X } from 'lucide-react';
import { ExecutionLog } from './ExecutionLog';
import { Copilot } from './Copilot';
import { VariablesPanel } from './VariablesPanel';
import { useAppStore } from '@/lib/store';

export function RightPanel() {
  const { rightPanelOpen, rightPanelTab, closeRightPanel } = useAppStore();

  if (!rightPanelOpen || !rightPanelTab) return null;

  const header = (
    <div className="border-b border-border bg-card p-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        {rightPanelTab === 'chat' && (<><MessageSquare size={16} /><span>Chat</span></>)}
        {rightPanelTab === 'console' && (<><Terminal size={16} /><span>Console</span></>)}
        {rightPanelTab === 'copilot' && (<><Bot size={16} /><span>Copilot</span></>)}
        {rightPanelTab === 'variables' && (<><Settings size={16} /><span>Variables</span></>)}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close panel" onClick={closeRightPanel}>
        <X size={14} />
      </Button>
    </div>
  );

  return (
    <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
      {header}
      <div className="flex-1 min-h-0">
        {rightPanelTab === 'chat' && (
          <div className="h-full p-4 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
              <p>Chat with AI</p>
              <p className="text-xs mt-1">Coming soon...</p>
            </div>
          </div>
        )}
        {rightPanelTab === 'console' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <ExecutionLog />
            </div>
          </div>
        )}
        {rightPanelTab === 'copilot' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <Copilot />
            </div>
          </div>
        )}
        {rightPanelTab === 'variables' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <VariablesPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}