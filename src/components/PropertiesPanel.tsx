import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Play } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getBlockConfig } from '@/lib/blocks/registry';
import { DynamicForm } from './forms/DynamicForm';

export function PropertiesPanel() {
  const { selectedNodeId, workspaces, currentWorkspaceId, currentWorkflowId } = useAppStore();

  const currentWorkspace = workspaces.find(ws => ws.id === currentWorkspaceId);
  const currentWorkflow = currentWorkspace?.workflows.find(wf => wf.id === currentWorkflowId);
  const selectedNode = currentWorkflow?.nodes.find(node => node.id === selectedNodeId);

  if (!selectedNodeId || !selectedNode) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Properties</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-muted-foreground">Select a node to view properties</p>
          </div>
        </div>
      </div>
    );
  }

  const blockConfig = getBlockConfig(selectedNode.type);

  if (!blockConfig) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Properties</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-muted-foreground">Unknown block type</p>
          </div>
        </div>
      </div>
    );
  }

  const IconComponent = blockConfig.icon;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="w-8 h-8 rounded flex items-center justify-center text-white"
            style={{ backgroundColor: blockConfig.bgColor || '#6b7280' }}
          >
            <IconComponent size={16} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{blockConfig.name}</h2>
            <Badge variant="secondary" className="text-xs">
              {blockConfig.category}
            </Badge>
          </div>
        </div>

        {blockConfig.description && (
          <p className="text-sm text-muted-foreground mb-3">
            {blockConfig.description}
          </p>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1">
            <Play className="w-4 h-4 mr-2" />
            Test Step
          </Button>
          
          {blockConfig.docsLink && (
            <Button size="sm" variant="outline">
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Form */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {blockConfig.subBlocks && blockConfig.subBlocks.length > 0 ? (
            <DynamicForm
              fields={blockConfig.subBlocks}
              values={selectedNode.data}
              onChange={(values) => {
                // TODO: Update node data in store
                console.log('Form values changed:', values);
              }}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No configuration options</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Inputs/Outputs Info */}
      <div className="border-t border-border p-4">
        <div className="space-y-4">
          {/* Inputs */}
          {Object.keys(blockConfig.inputs).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Inputs</h4>
              <div className="space-y-1">
                {Object.entries(blockConfig.inputs).map(([key, input]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{key}</span>
                    <Badge variant="outline" className="text-xs">
                      {input.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outputs */}
          {Object.keys(blockConfig.outputs).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Outputs</h4>
              <div className="space-y-1">
                {Object.entries(blockConfig.outputs).map(([key, output]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{key}</span>
                    <Badge variant="outline" className="text-xs">
                      {output.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}