import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Settings, Play, Pause, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { getBlockConfig } from '@/lib/blocks/registry';
import { useUltraOptimizedFieldValue } from '@/hooks/useUltraOptimizedFieldValue';
import type { BlockField } from '@/lib/types';
import { GmailAuthButton } from '@/components/ui/GmailAuthButton';
import { UltraOptimizedInput } from './UltraOptimizedInput';

interface WorkflowNodeData {
  label: string;
  blockConfig?: { subBlocks?: BlockField[]; bgColor?: string; icon?: React.FC<Record<string, unknown>>; description?: string; type?: string };
  status?: 'idle' | 'running' | 'success' | 'error';
  duration?: number;
  [key: string]: unknown;
}

const WorkflowNodeComponent = ({ id, data, selected, type, dragging }: NodeProps) => {
  const { 
    setSelectedNode, 
    currentExecution,
    nodeExpansionStates,
    setNodeExpansionState,
    currentWorkflowId,
    startExecution,
    openRightPanel
  } = useAppStore();
  
  // Use global expansion state instead of local state to persist across re-renders
  const isExpanded = nodeExpansionStates[id as string] ?? true;
  const setIsExpanded = (expanded: boolean) => setNodeExpansionState(id as string, expanded);
  
  const { updateFieldValue, updateFieldValueImmediate } = useUltraOptimizedFieldValue(id as string);
  
  // Get block configuration from registry using the node type
  const blockConfig = getBlockConfig(type!);
  const nodeData = data as WorkflowNodeData;
  const { status = 'idle' } = nodeData || {};

  const nodeExecution = currentExecution?.nodeExecutions?.[id as string];
  const currentStatus = nodeExecution?.status || status;

  // Selection is now handled by ReactFlow's onNodeClick

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500 text-white';
      case 'success':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'pending':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="w-3 h-3 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-3 h-3" />;
      case 'error':
        return <AlertCircle className="w-3 h-3" />;
      case 'pending':
        return <Pause className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const IconComponent = blockConfig?.icon;
  const fields: BlockField[] = useMemo(() => {
    const aliasField: BlockField = {
      id: 'alias',
      title: 'Reference Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., airtable1, githubMain'
    };
    return [aliasField, ...(blockConfig?.subBlocks || [])];
  }, [blockConfig?.subBlocks]);

  // Memoized event handlers to prevent re-creation
  const stopPropagation = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const renderField = useCallback((field: BlockField) => {
    const value = nodeData?.[field.id] || '';
    
    // Handle special cases that don't use OptimizedNodeInput
    if (field.type === 'tool-input') {
      // Special case for Gmail authentication
      if (field.id === 'gmailAuth') {
        const clientId = nodeData?.clientId as string || '';
        const clientSecret = nodeData?.clientSecret as string || '';
        
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs font-medium text-[#cccccc]">{field.title}</Label>
            <div className="nodrag" onPointerDown={stopPropagation} onMouseDown={stopPropagation} onClick={stopPropagation}>
              <GmailAuthButton
                clientId={clientId}
                clientSecret={clientSecret}
                className="w-full"
                onAuthChange={(authenticated: boolean) => {
                  updateFieldValueImmediate('_gmailAuthenticated', authenticated);
                  // Ensure credentials are preserved in node data after auth
                  if (authenticated) {
                    const storedClientId = sessionStorage.getItem('gmail_temp_client_id');
                    const storedClientSecret = sessionStorage.getItem('gmail_temp_client_secret');
                    if (storedClientId && !clientId) {
                      updateFieldValueImmediate('clientId', storedClientId);
                    }
                    if (storedClientSecret && !clientSecret) {
                      updateFieldValueImmediate('clientSecret', storedClientSecret);
                    }
                  }
                }}
              />
            </div>
          </div>
        );
      }
      return null;
    }

    // Special-case Gmail OAuth credentials to update instantly (no debounce)
    if (field.id === 'clientId' || field.id === 'clientSecret') {
      const isSecret = field.id === 'clientSecret';
      return (
        <UltraOptimizedInput
          key={field.id}
          id={field.id}
          type="short-input"
          title={field.title}
          initialValue={value}
          onChange={(newValue) => {
            const v = String(newValue || '');
            // Update node data immediately (no batching for credentials)
            updateFieldValueImmediate(field.id, v);
            // Mirror to sessionStorage for GmailAuthButton to react instantly
            if (field.id === 'clientId') sessionStorage.setItem('gmail_temp_client_id', v);
            if (field.id === 'clientSecret') sessionStorage.setItem('gmail_temp_client_secret', v);
            // Signal listeners to re-evaluate credentials
            window.dispatchEvent(new CustomEvent('AGEN8_GMAIL_CREDENTIALS_CHANGED'));
          }}
          placeholder={field.placeholder}
          password={isSecret}
          onPointerDown={stopPropagation}
          onMouseDown={stopPropagation}
          onClick={stopPropagation}
        />
      );
    }

    // Use UltraOptimizedInput for all standard input types
    return (
      <UltraOptimizedInput
        key={field.id}
        id={field.id}
        type={field.type as any}
        title={field.title}
        initialValue={value}
        onChange={(newValue) => updateFieldValue(field.id, newValue)}
        placeholder={field.placeholder}
        password={field.password}
        rows={field.rows}
        options={field.options?.()}
        min={field.min}
        max={field.max}
        step={field.step}
        onPointerDown={stopPropagation}
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
      />
    );
  }, [nodeData, updateFieldValue, stopPropagation]);

  // Memoize rendered fields to prevent unnecessary re-renders
  const renderedFields = useMemo(() => fields.map(renderField), [fields, renderField]);

  return (
    <div className="relative group">
      {/* Enhanced Card with vibrant sim.ai-style colors */}
      <Card
        className={cn(
          'w-[300px] cursor-pointer transition-all duration-300 hover:shadow-xl',
          'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg text-gray-900 dark:text-white rounded-xl overflow-hidden',
          'hover:scale-[1.02] hover:shadow-2xl backdrop-blur-sm',
          selected && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background border-blue-500 shadow-blue-500/30',
          currentStatus === 'running' && 'ring-2 ring-blue-500 shadow-blue-500/30 bg-blue-50 dark:bg-blue-950/30',
          currentStatus === 'error' && 'ring-2 ring-red-500 shadow-red-500/30 bg-red-50 dark:bg-red-950/30',
          currentStatus === 'success' && 'ring-2 ring-green-500 shadow-green-500/30 bg-green-50 dark:bg-green-950/30'
        )}
        style={{
          background: selected 
            ? `linear-gradient(135deg, ${blockConfig?.bgColor || '#6b7280'}08, ${blockConfig?.bgColor || '#6b7280'}03)`
            : undefined
        }}
      >
        {/* Enhanced Header with vibrant colors */}
        <div 
          className="p-4 border-b border-gray-200 dark:border-gray-700 relative overflow-hidden"
          style={{ 
            background: `linear-gradient(135deg, ${blockConfig?.bgColor || '#6b7280'}20, ${blockConfig?.bgColor || '#6b7280'}10)`,
            borderBottom: `1px solid ${blockConfig?.bgColor || '#6b7280'}20`
          }}
        >
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              {IconComponent && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl"
                      style={{ 
                        backgroundColor: blockConfig?.bgColor || '#6b7280',
                        boxShadow: `0 4px 12px ${blockConfig?.bgColor || '#6b7280'}40`
                      }}
                    >
                      <IconComponent size={18} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{blockConfig?.description || 'No description available'}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {blockConfig?.name || 'Unknown Block'}
                </h3>
                {blockConfig?.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                    {blockConfig.description}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 relative z-10">
              {/* Status Badge with Icon */}
              {currentStatus !== 'idle' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={cn("text-xs px-2 py-1 flex items-center gap-1 relative z-10", getStatusColor(currentStatus as string))}>
                      {getStatusIcon(currentStatus as string)}
                      {currentStatus}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Node status: {currentStatus}</p>
                    {nodeExecution?.duration && <p>Duration: {nodeExecution.duration}ms</p>}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Run Node Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors opacity-0 group-hover:opacity-100 relative z-20 pointer-events-auto text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (currentWorkflowId && id) {
                        openRightPanel('console');
                        startExecution(currentWorkflowId, id as string);
                      }
                    }}
                    style={{ pointerEvents: 'auto' }}
                    disabled={currentStatus === 'running'}
                  >
                    <Zap size={12} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Run this node only</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          {/* Expand/Collapse Button - Better positioned */}
          {fields.length > 0 && (
            <div className="absolute top-2 right-2 z-50">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0 bg-white/90 dark:bg-gray-800/90 border border-gray-300 dark:border-gray-600 rounded-md shadow-md hover:shadow-lg transition-all duration-200 backdrop-blur-sm" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsExpanded(!isExpanded); 
                }}
                style={{ 
                  zIndex: 1000,
                  pointerEvents: 'auto'
                }}
              >
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </Button>
            </div>
          )}
          
          {/* Subtle background pattern */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, ${blockConfig?.bgColor || '#6b7280'} 0%, transparent 50%), radial-gradient(circle at 80% 50%, ${blockConfig?.bgColor || '#6b7280'} 0%, transparent 50%)`
            }}
          />
        </div>

        {/* Enhanced Properties Panel with better colors */}
        {isExpanded && fields.length > 0 && (
          <div 
            className="p-4 space-y-3"
            style={{
              background: `linear-gradient(180deg, ${blockConfig?.bgColor || '#6b7280'}05, ${blockConfig?.bgColor || '#6b7280'}02)`
            }}
          >
            <div className="space-y-3">
              {renderedFields}
            </div>
            
            {/* Configuration Summary */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>{fields.length} configuration{fields.length !== 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1">
                  <Settings size={10} />
                  <span className="text-green-600 dark:text-green-400 font-medium">Ready</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>
      
      {/* Enhanced Handles with vibrant colors */}
      {blockConfig?.type !== 'starter' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Handle
              type="target"
              position={Position.Left}
              className="w-4 h-4 border-2 border-white dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-blue-500 hover:bg-blue-500 transition-all duration-200 rounded-full shadow-lg"
              style={{ 
                left: -8, 
                top: '50%',
                transform: 'translateY(-50%)',
                boxShadow: `0 2px 8px ${blockConfig?.bgColor || '#6b7280'}30`
              }}
            />
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Input connection</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {blockConfig?.type !== 'response' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Handle
              type="source"
              position={Position.Right}
              className="w-4 h-4 border-2 border-white dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-blue-500 hover:bg-blue-500 transition-all duration-200 rounded-full shadow-lg"
              style={{ 
                right: -8, 
                top: '50%',
                transform: 'translateY(-50%)',
                boxShadow: `0 2px 8px ${blockConfig?.bgColor || '#6b7280'}30`
              }}
            />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Output connection</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

// Optimized memo with custom comparison
export const WorkflowNode = memo(WorkflowNodeComponent, (prevProps, nextProps) => {
  // Only re-render if essential props change
  if (prevProps.id !== nextProps.id) return false;
  if (prevProps.type !== nextProps.type) return false;
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.dragging !== nextProps.dragging) return false;
  
  // For data comparison, only check if the structure changed, not individual field values
  // This prevents re-renders during typing
  const prevData = prevProps.data as WorkflowNodeData;
  const nextData = nextProps.data as WorkflowNodeData;
  
  if (prevData?.status !== nextData?.status) return false;
  if (prevData?.duration !== nextData?.duration) return false;
  if (prevData?.label !== nextData?.label) return false;
  
  // Don't compare individual field values to prevent re-renders during typing
  return true;
});