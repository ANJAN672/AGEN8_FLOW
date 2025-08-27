import { useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAppStore } from '@/lib/store';
import { useDebounceCallback } from './useDebounceCallback';

export function useFieldValue(nodeId: string) {
  const rf = useReactFlow();
  const { 
    workspaces, 
    currentWorkspaceId, 
    currentWorkflowId, 
    updateWorkflow, 
    setIsNodeEditing 
  } = useAppStore();
  
  const isEditingRef = useRef(false);

  // Debounced function to persist changes to store
  const persistToStore = useDebounceCallback((fieldId: string, value: unknown) => {
    const ws = workspaces.find(w => w.id === currentWorkspaceId);
    const wf = ws?.workflows.find(w => w.id === currentWorkflowId);
    
    if (!ws || !wf) {
      if (isEditingRef.current) {
        isEditingRef.current = false;
        setIsNodeEditing(false);
      }
      return;
    }

    const updatedNodes = wf.nodes.map(n =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, [fieldId]: value } }
        : n
    );

    updateWorkflow(ws.id, { 
      ...wf, 
      nodes: updatedNodes, 
      updatedAt: new Date().toISOString() 
    });
    
    if (isEditingRef.current) {
      isEditingRef.current = false;
      setIsNodeEditing(false);
    }
  }, 300);

  // Immediate update function for responsive UI
  const updateFieldValue = useCallback((fieldId: string, value: unknown) => {
    // Set editing flag only once
    if (!isEditingRef.current) {
      isEditingRef.current = true;
      setIsNodeEditing(true);
    }
    
    // Update canvas node data immediately for responsive UI
    rf.setNodes((nds) => nds.map(n => 
      n.id === nodeId ? { ...n, data: { ...n.data, [fieldId]: value } } : n
    ));

    // Trigger debounced persist
    persistToStore(fieldId, value);
  }, [nodeId, rf, persistToStore, setIsNodeEditing]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (isEditingRef.current) {
        isEditingRef.current = false;
        setIsNodeEditing(false);
      }
    };
  }, [setIsNodeEditing]);

  return updateFieldValue;
}