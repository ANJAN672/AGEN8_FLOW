import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Trash2, Copy, Download } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useRef } from 'react';

export function ExecutionLog() {
  const { currentExecution, clearExecution } = useAppStore();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to newest log entry
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [currentExecution?.logs.length]);

  const handleClear = () => {
    clearExecution();
  };

  const handleCopy = () => {
    if (currentExecution) {
      const logText = currentExecution.logs
        .map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
        .join('\n');
      navigator.clipboard.writeText(logText);
    }
  };

  const handleDownload = () => {
    if (currentExecution) {
      const logText = currentExecution.logs
        .map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
        .join('\n');
      
      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `execution-log-${currentExecution.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-destructive';
      case 'warn':
        return 'text-warning';
      case 'info':
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'running':
        return 'default';
      case 'success':
        return 'secondary';
      case 'error':
        return 'destructive';
      case 'cancelled':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium">Execution Log</h3>
            {currentExecution && (
              <Badge variant={getStatusBadgeVariant(currentExecution.status)}>
                {currentExecution.status}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
            </Button>
            
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4" />
            </Button>
            
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Execution Summary */}
        {currentExecution && (
          <div className="mt-2 grid grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Started:</span>
              <div className="font-mono">
                {formatDistanceToNow(new Date(currentExecution.startTime), { addSuffix: true })}
              </div>
            </div>
            
            {currentExecution.endTime && (
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <div className="font-mono">{currentExecution.duration || 0}ms</div>
              </div>
            )}
            
            <div>
              <span className="text-muted-foreground">Status:</span>
              <div className="font-mono">{currentExecution.status}</div>
            </div>
            
            <div>
              <span className="text-muted-foreground">Nodes:</span>
              <div className="font-mono">{Object.keys(currentExecution.nodeExecutions).length}</div>
            </div>
          </div>
        )}

        {/* Response Output */}
        {currentExecution && currentExecution.status === 'success' && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
            <div className="text-xs font-medium text-muted-foreground mb-2">📋 Workflow Response</div>
            <div className="max-h-40 overflow-y-auto scrollbar-none">
              {(() => {
                // Find response node output - look for any node that starts with 'response'
                const responseNode = Object.entries(currentExecution.nodeExecutions).find(([nodeId, execution]) => 
                  nodeId.startsWith('response') && execution.outputs?.response
                );
                
                if (responseNode) {
                  const [nodeId, execution] = responseNode;
                  const response = execution.outputs?.response as { message?: string };
                  return (
                    <div className="text-sm">
                      <div className="font-mono text-xs text-muted-foreground mb-1">From: {nodeId}</div>
                      <div className="whitespace-pre-wrap">{response?.message || 'No message'}</div>
                    </div>
                  );
                }
                
                // Fallback: look for any node with response output
                const anyResponseNode = Object.entries(currentExecution.nodeExecutions).find(([nodeId, execution]) => 
                  execution.outputs?.response
                );
                
                if (anyResponseNode) {
                  const [nodeId, execution] = anyResponseNode;
                  const response = execution.outputs?.response as { message?: string };
                  return (
                    <div className="text-sm">
                      <div className="font-mono text-xs text-muted-foreground mb-1">From: {nodeId}</div>
                      <div className="whitespace-pre-wrap">{response?.message || 'No message'}</div>
                    </div>
                  );
                }
                
                return <div className="text-xs text-muted-foreground">No response found</div>;
              })()}
            </div>
          </div>
        )}

        {/* Error Output */}
        {currentExecution && currentExecution.status === 'error' && (
          <div className="mt-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="text-xs font-medium text-destructive mb-2">❌ Workflow Failed</div>
            {(() => {
              // Find the failed node
              const failedNode = Object.entries(currentExecution.nodeExecutions).find(([nodeId, execution]) => 
                execution.status === 'error'
              );
              
              if (failedNode) {
                const [nodeId, execution] = failedNode;
                return (
                  <div className="text-sm">
                    <div className="font-mono text-xs text-muted-foreground mb-1">Failed node: {nodeId}</div>
                    <div className="text-destructive">{execution.error || 'Unknown error'}</div>
                  </div>
                );
              }
              
              return <div className="text-xs text-destructive">Workflow execution failed</div>;
            })()}
          </div>
        )}
      </div>

      {/* Logs */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {currentExecution && currentExecution.logs.length > 0 ? (
            <div className="space-y-2">
              {currentExecution.logs.map((log) => (
                <Card key={log.id} className="p-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          {log.level.toUpperCase()}
                        </Badge>
                        {log.nodeId && (
                          <Badge variant="secondary" className="text-[10px]">
                            {log.nodeId}
                          </Badge>
                        )}
                      </div>
                      <p className={`text-xs ${getLogLevelColor(log.level)}`}>
                        {log.message}
                      </p>
                    </div>
                    
                    <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </Card>
              ))}
              <div ref={bottomRef} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <p className="text-muted-foreground">
                  {currentExecution ? 'No logs yet' : 'Run a workflow to see execution logs'}
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}