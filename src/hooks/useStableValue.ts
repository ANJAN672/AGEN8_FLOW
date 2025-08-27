import { useRef, useCallback } from 'react';

/**
 * Hook to create stable values that don't change on every render
 * Prevents unnecessary re-renders caused by object/array recreation
 */
export const useStableValue = <T>(value: T, compareFn?: (a: T, b: T) => boolean): T => {
  const stableValueRef = useRef<T>(value);
  const defaultCompare = useCallback((a: T, b: T) => a === b, []);
  const compare = compareFn || defaultCompare;

  if (!compare(stableValueRef.current, value)) {
    stableValueRef.current = value;
  }

  return stableValueRef.current;
};

/**
 * Hook for stable array values with deep comparison
 */
export const useStableArray = <T>(array: T[]): T[] => {
  return useStableValue(array, (a, b) => {
    if (a.length !== b.length) return false;
    return a.every((item, index) => item === b[index]);
  });
};

/**
 * Hook for stable object values with shallow comparison
 */
export const useStableObject = <T extends Record<string, any>>(obj: T): T => {
  return useStableValue(obj, (a, b) => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => a[key] === b[key]);
  });
};