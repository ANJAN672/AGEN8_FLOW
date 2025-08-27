import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAppStore } from '@/lib/store';
import { useDebounceCallback } from './useDebounceCallback';

export function useOptimizedFieldValue(nodeId: string) {
  const rf = useReactFlow();
  const { 
    workspaces, 
    currentWorkspaceId, 
    currentWorkflowId, 
    updateWorkflow, 
    setIsNodeEditing 
  } = useAppStore();
  
  const isEditingRef = useRef(false);
  const pendingUpdatesRef = useRef<Record<string, unknown>>({});

  // Debounced function to persist changes to store AND update ReactFlow
  const persistToStoreAndCanvas = useDebounceCallback((updates: Record<string, unknown>) => {
    const ws = workspaces.find(w => w.id === currentWorkspaceId);
    const wf = ws?.workflows.find(w => w.id === currentWorkflowId);
    
    if (!ws || !wf) {
      if (isEditingRef.current) {
        isEditingRef.current = false;
        setIsNodeEditing(false);
      }
      return;
    }

    // Update store
    const updatedNodes = wf.nodes.map(n =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, ...updates } }
        : n
    );

    updateWorkflow(ws.id, { 
      ...wf, 
      nodes: updatedNodes, 
      updatedAt: new Date().toISOString() 
    });

    // Update ReactFlow canvas
    rf.setNodes((nds) => nds.map(n => 
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ));
    
    if (isEditingRef.current) {
      isEditingRef.current = false;
      setIsNodeEditing(false);
    }

    // Clear pending updates
    pendingUpdatesRef.current = {};
  }, 300);

  // Immediate update function that doesn't trigger re-renders
  const updateFieldValue = useCallback((fieldId: string, value: unknown) => {
    // Set editing flag only once
    if (!isEditingRef.current) {
      isEditingRef.current = true;
      setIsNodeEditing(true);
    }
    
    // Store the update in pending updates
    pendingUpdatesRef.current[fieldId] = value;

    // Trigger debounced persist with all pending updates
    persistToStoreAndCanvas({ ...pendingUpdatesRef.current });
  }, [nodeId, persistToStoreAndCanvas, setIsNodeEditing]);

  return updateFieldValue;
}