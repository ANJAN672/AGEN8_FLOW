import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

import { 
  Play, 
  Square, 
  Trash2,
  Sparkles,
  Printer,
  Wand2,
  MessageSquare,
  Terminal,
  Bot,
  Settings,
  Save,
  Download,
  Upload,
  Zap,
  Sun,
  Moon,
  MoreHorizontal,
  ScanLine,
  PanelLeft
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { toast } from '@/components/ui/use-toast';
import { openaiService } from '@/lib/services/openai';
import type { Workflow, WorkflowNode, WorkflowEdge } from '@/lib/types';

interface TopbarProps {
  onExecute: () => void;
  isExecuting: boolean;
}

export function Topbar({ onExecute, isExecuting }: TopbarProps) {
  const {
    currentWorkflowId,
    openRightPanel,
    stopExecution,
    startExecution,
    setCopilotSeed,
    selectedNodeId,
    workspaces,
    currentWorkspaceId,
    isDarkMode,
    toggleDarkMode,
    saveToStorage,
    leftSidebarVisible,
    toggleLeftSidebar
  } = useAppStore();

  const currentWorkspace = workspaces.find(ws => ws.id === currentWorkspaceId);
  const currentWorkflow = currentWorkspace?.workflows.find(wf => wf.id === currentWorkflowId);

  const handleDelete = () => {
    const store = useAppStore.getState();
    if (store.selectedNodeId) {
      store.deleteSelectedNode();
      toast({ 
        title: 'Node deleted', 
        description: 'The selected node has been removed from the workflow.' 
      });
    } else {
      toast({ 
        title: 'No selection', 
        description: 'Please select a node to delete.' 
      });
    }
  };

  const handleSave = () => {
    saveToStorage();
    toast({ 
      title: 'Saved', 
      description: 'Your workflow has been saved successfully.' 
    });
  };

  const handleExport = () => {
    if (currentWorkflow) {
      const dataStr = JSON.stringify(currentWorkflow, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `${currentWorkflow.name || 'workflow'}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast({ 
        title: 'Exported', 
        description: 'Workflow exported successfully.' 
      });
    }
  };

  const handleImport = () => {
    if (!currentWorkspaceId) {
      toast({ title: 'No workspace', description: 'Please create or select a workspace first.' });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const importedList: any[] = Array.isArray(json?.workflows) ? json.workflows : Array.isArray(json) ? json : [json];

        if (!importedList.length) {
          toast({ title: 'Invalid file', description: 'No workflow data found in JSON.' });
          return;
        }

        const store = useAppStore.getState();

        let importedCount = 0;
        for (const wfRaw of importedList) {
          const name = String(wfRaw?.name || file.name.replace(/\.json$/i, '') || `Imported ${Date.now()}`);
          const nodes: WorkflowNode[] = Array.isArray(wfRaw?.nodes) ? wfRaw.nodes : [];
          const edges: WorkflowEdge[] = Array.isArray(wfRaw?.edges) ? wfRaw.edges : [];

          if (!nodes.length) {
            toast({ title: 'Skipped invalid workflow', description: `${name}: missing nodes.` });
            continue;
          }

          // Ensure starter
          let hasStarter = nodes.some(n => n.id === 'starter' || n.type === 'starter');
          if (!hasStarter) {
            nodes.unshift({ id: 'starter', type: 'starter', position: { x: 100, y: 100 }, data: {} });
          }

          // Create a new workflow first (this sets currentWorkflowId to the new one)
          store.createWorkflow(currentWorkspaceId, name);
          const newId = useAppStore.getState().currentWorkflowId!;

          const newWorkflow: Workflow = {
            id: newId,
            name,
            nodes,
            edges,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            starterId: 'starter',
            variables: wfRaw?.variables || {}
          };

          store.updateWorkflow(currentWorkspaceId, newWorkflow);
          importedCount++;
        }

        toast({ title: 'Imported', description: `Successfully imported ${importedCount} workflow(s).` });
      } catch (e: any) {
        toast({ title: 'Import failed', description: e?.message || 'Could not parse JSON file.' });
      }
    };
    input.click();
  };

  const handleAIAssist = () => {
    setCopilotSeed("Help me improve this workflow and suggest optimizations");
    openRightPanel('copilot');
  };

  return (
    <div className="h-14 border-b border-border bg-background flex items-center justify-between px-4">
      {/* Left: Sidebar toggle + AGEN8 brand + workflow info */}
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={toggleLeftSidebar}
            >
              <PanelLeft className={`w-4 h-4 ${leftSidebarVisible ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {leftSidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          </TooltipContent>
        </Tooltip>
        
        <div className="flex items-center gap-2 select-none">
          <img src="/favicon.ico" alt="AGEN8" className="w-5 h-5" />
          <span className="text-sm font-semibold">AGEN8</span>
        </div>
        
        {currentWorkflow && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>•</span>
            <span className="font-medium">{currentWorkflow.name}</span>
            <Badge variant="outline" className="text-xs">
              {currentWorkflow.nodes.length} blocks
            </Badge>
          </div>
        )}
      </div>

      {/* Right Side - Action Buttons */}
      <div className="flex items-center gap-1">
        {/* Quick Actions */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleSave}>
              <Save className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save workflow</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleExport}>
              <Download className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export workflow</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleImport}>
              <Upload className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import workflow</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete selected node</TooltipContent>
        </Tooltip>

        {/* Theme Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={toggleDarkMode}>
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>

        {/* Canvas Controls */}
        <div className="flex items-center gap-1 ml-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
                const ev = new CustomEvent('AGEN8_CANVAS_COMMAND', { detail: { cmd: 'autoArrange' } });
                window.dispatchEvent(ev);
              }}>
                <ScanLine className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Auto Arrange (Hold Space + Drag to Pan, Space + Scroll to Zoom)</TooltipContent>
          </Tooltip>
        </div>

        {/* Panel Buttons */}
        <div className="flex items-center gap-1 ml-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openRightPanel('console')}>
                <Terminal className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Console</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openRightPanel('variables')}>
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Variables</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={() => openRightPanel('copilot')}
              >
                <Bot className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI Copilot</TooltipContent>
          </Tooltip>
        </div>



        {/* More Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print workflow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openRightPanel('chat')}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Open chat
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toast({ title: 'Coming soon', description: 'This feature is in development' })}>
              <Sparkles className="w-4 h-4 mr-2" />
              Magic tools
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>



        {/* Run Button */}
        {isExecuting ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="destructive" size="sm" className="h-8 w-8 ml-2 p-0" onClick={stopExecution}>
                <Square className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                className="h-8 w-8 ml-2 p-0 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md"
                onClick={() => {
                  const store = useAppStore.getState();
                  const wfId = store.currentWorkflowId;
                  if (wfId) {
                    store.openRightPanel('console');
                    store.startExecution(wfId);
                  } else {
                    toast({ 
                      title: 'No workflow', 
                      description: 'Please create a workflow first.' 
                    });
                  }
                }}
                disabled={!currentWorkflow}
              >
                <Play className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Run Workflow</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}