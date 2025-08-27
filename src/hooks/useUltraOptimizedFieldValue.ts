import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';

/**
 * Ultra-optimized hook for updating field values with minimal re-renders
 * Uses batching and smart caching to prevent performance issues
 */
export const useUltraOptimizedFieldValue = (nodeId: string) => {
  const { setNodes } = useReactFlow();
  const batchTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingUpdatesRef = useRef<Record<string, unknown>>({});
  const lastUpdateTimeRef = useRef<Record<string, number>>({});

  const updateFieldValue = useCallback((fieldId: string, value: unknown) => {
    const now = Date.now();
    const lastUpdate = lastUpdateTimeRef.current[fieldId] || 0;
    
    // Store the pending update
    pendingUpdatesRef.current[fieldId] = value;
    lastUpdateTimeRef.current[fieldId] = now;

    // Clear existing timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    // For rapid typing, use shorter timeout
    const timeout = now - lastUpdate < 100 ? 50 : 100;

    // Batch updates for better performance
    batchTimeoutRef.current = setTimeout(() => {
      const updates = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {};

      // Apply all pending updates in a single setNodes call
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...updates
              }
            };
          }
          return node;
        })
      );
    }, timeout);
  }, [nodeId, setNodes]);

  // Immediate update for critical fields (no batching)
  const updateFieldValueImmediate = useCallback((fieldId: string, value: unknown) => {
    // Clear any pending batched updates for this field
    delete pendingUpdatesRef.current[fieldId];
    
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              [fieldId]: value
            }
          };
        }
        return node;
      })
    );
  }, [nodeId, setNodes]);

  return { updateFieldValue, updateFieldValueImmediate };
};