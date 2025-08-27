import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { PerformanceMonitor } from '@/components/debug/PerformanceMonitor';
import { useStableArray } from '@/hooks/useStableValue';
import { useReactiveSlackChannels } from '@/hooks/useReactiveSlackChannels';

interface UltraOptimizedInputProps {
  id: string;
  type: 'short-input' | 'long-input' | 'combobox' | 'toggle' | 'number' | 'datetime' | 'code' | 'slider';
  title: string;
  initialValue: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  password?: boolean;
  rows?: number;
  options?: Array<{ id: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}

// Ultra-optimized input component with zero performance issues
const UltraOptimizedInputComponent: React.FC<UltraOptimizedInputProps> = ({
  id,
  type,
  title,
  initialValue,
  onChange,
  placeholder,
  password = false,
  rows = 3,
  options = [],
  min,
  max,
  step,
  onPointerDown,
  onMouseDown,
  onClick
}) => {
  // Use a single state for the local value
  const [localValue, setLocalValue] = useState(() => initialValue);
  
  // Reactive Slack channels for channel selectors
  const { channels: reactiveChannels, hasChannels } = useReactiveSlackChannels();
  
  // Use reactive channels if this is a Slack channel selector, otherwise use provided options
  const isSlackChannelSelector = id === 'channel' && title === 'Channel';
  const finalOptions = isSlackChannelSelector && hasChannels ? reactiveChannels : (options || []);
  
  // Stable options to prevent unnecessary re-renders
  const stableOptions = useStableArray(finalOptions);
  
  // Refs for performance optimization
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const lastInitialValueRef = useRef(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const lastChangeTimeRef = useRef(0);

  // Only update local value if initialValue actually changed (prevents cursor jumping)
  useEffect(() => {
    if (initialValue !== lastInitialValueRef.current) {
      // Only update if we're not currently typing or composing (prevents cursor issues)
      const now = Date.now();
      const isRecentChange = now - lastChangeTimeRef.current < 1000;
      const isComposing = isComposingRef.current;
      const isFocused = inputRef.current === document.activeElement;
      
      if (!isRecentChange && !isComposing && !isFocused) {
        setLocalValue(initialValue);
      }
      lastInitialValueRef.current = initialValue;
    }
  }, [initialValue]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Ultra-optimized change handler
  const handleChange = useCallback((newValue: unknown) => {
    lastChangeTimeRef.current = Date.now();
    setLocalValue(newValue);
    
    // For non-text inputs, update immediately
    if (type === 'toggle' || type === 'combobox' || type === 'slider') {
      onChange(newValue);
      return;
    }
    
    // For text inputs, use smart debouncing
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Shorter debounce for better responsiveness
    debounceTimeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 100);
  }, [onChange, type]);

  // Optimized event handlers that prevent all propagation issues
  const stopPropagation = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    
    if (onPointerDown && 'pointerId' in e) onPointerDown(e as React.PointerEvent);
    if (onMouseDown && 'button' in e) onMouseDown(e as React.MouseEvent);
    if (onClick) onClick(e as React.MouseEvent);
  }, [onPointerDown, onMouseDown, onClick]);

  // Prevent drag events from interfering with text selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMouseDown) onMouseDown(e);
  }, [onMouseDown]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (onPointerDown) onPointerDown(e);
  }, [onPointerDown]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) onClick(e);
  }, [onClick]);

  // Prevent context menu from interfering
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Handle composition events (for IME support)
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    handleChange(e.currentTarget.value);
  }, [handleChange]);

  // Optimized input change handler
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    
    // Don't trigger onChange during composition
    if (isComposingRef.current) {
      setLocalValue(newValue);
      return;
    }
    
    handleChange(newValue);
  }, [handleChange]);

  // Auto-resize handler for textareas
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    
    // Auto-resize with performance optimization
    requestAnimationFrame(() => {
      const el = e.currentTarget;
      if (el) {
        el.style.height = 'auto';
        const maxHeight = type === 'code' ? 500 : 400;
        el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
      }
    });
  }, [handleInputChange, type]);

  // Optimized tab handling for code inputs
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && (type === 'code' || type === 'long-input')) {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const value = String(localValue || '');
      const newValue = value.slice(0, start) + '  ' + value.slice(end);
      
      handleChange(newValue);
      
      // Restore cursor position
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  }, [localValue, handleChange, type]);

  // Memoized input components for maximum performance
  const inputComponent = useMemo(() => {
    const commonProps = {
      ref: inputRef,
      onPointerDown: handlePointerDown,
      onMouseDown: handleMouseDown,
      onClick: handleClick,
      onContextMenu: handleContextMenu,
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
      className: "nodrag"
    };

    switch (type) {
      case 'short-input':
        return (
          <Input
            {...commonProps}
            type={password ? 'password' : 'text'}
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={handleInputChange}
            className="h-7 text-xs bg-[#333333] border-[#555555] text-white placeholder:text-[#888888] nodrag focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            autoComplete="off"
            spellCheck={false}
          />
        );

      case 'long-input':
        return (
          <Textarea
            {...commonProps}
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            className="min-h-[50px] text-xs resize-none bg-[#333333] border-[#555555] text-white placeholder:text-[#888888] font-mono/relaxed nodrag focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            rows={rows}
            autoComplete="off"
            spellCheck={false}
          />
        );

      case 'code':
        return (
          <Textarea
            {...commonProps}
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            className="min-h-[100px] text-xs resize-none bg-[#1f1f1f] border-[#444444] text-white placeholder:text-[#888888] font-mono nodrag focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            rows={rows || 8}
            autoComplete="off"
            spellCheck={false}
          />
        );

      case 'combobox':
        return (
          <Select value={String(localValue || '')} onValueChange={handleChange}>
            <SelectTrigger 
              className="h-7 text-xs bg-[#333333] border-[#555555] text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
              onClick={handleClick}
              onPointerDown={handlePointerDown}
              onMouseDown={handleMouseDown}
              onContextMenu={handleContextMenu}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] overflow-y-auto">
              {stableOptions.map((option) => (
                <SelectItem key={option.id} value={option.id} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'toggle':
        return (
          <Switch
            checked={Boolean(localValue)}
            onCheckedChange={handleChange}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
            className="focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        );

      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={handleInputChange}
            className="h-7 text-xs bg-[#333333] border-[#555555] text-white placeholder:text-[#888888] nodrag focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            min={min}
            max={max}
            step={step}
            autoComplete="off"
          />
        );

      case 'datetime':
        return (
          <Input
            {...commonProps}
            type="datetime-local"
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={handleInputChange}
            className="h-7 text-xs bg-[#333333] border-[#555555] text-white placeholder:text-[#888888] nodrag focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            autoComplete="off"
          />
        );

      case 'slider': {
        const sliderValue = Number(localValue ?? min ?? 0);
        return (
          <div className="px-1">
            <Slider
              value={[sliderValue]}
              min={min ?? 0}
              max={max ?? 100}
              step={step ?? 1}
              onValueChange={(vals: number[]) => handleChange(vals[0])}
              onPointerDown={handlePointerDown}
              onMouseDown={handleMouseDown}
              onClick={handleClick}
              onContextMenu={handleContextMenu}
              className="nodrag focus:outline-none"
            />
          </div>
        );
      }

      default:
        return (
          <Input
            {...commonProps}
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={handleInputChange}
            className="h-7 text-xs bg-[#333333] border-[#555555] text-white placeholder:text-[#888888] nodrag focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            autoComplete="off"
            spellCheck={false}
          />
        );
    }
  }, [
    type, localValue, placeholder, password, rows, stableOptions, min, max, step,
    handleInputChange, handleTextareaChange, handleKeyDown, handleChange,
    handlePointerDown, handleMouseDown, handleClick, handleContextMenu,
    handleCompositionStart, handleCompositionEnd
  ]);

  // Optimized layout rendering
  if (type === 'toggle') {
    return (
      <div className="flex items-center justify-between py-1">
        <Label className="text-xs font-medium text-[#cccccc] select-none">{title}</Label>
        {inputComponent}
      </div>
    );
  }

  if (type === 'slider') {
    const sliderValue = Number(localValue ?? min ?? 0);
    return (
      <div className="space-y-1">
        <Label className="text-xs font-medium text-[#cccccc] flex items-center justify-between select-none">
          <span>{title}</span>
          <span className="text-[10px] text-[#aaaaaa] font-mono">{sliderValue}</span>
        </Label>
        {inputComponent}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <PerformanceMonitor componentName={`UltraOptimizedInput-${type}-${id}`} />
      <Label className="text-xs font-medium text-[#cccccc] select-none">{title}</Label>
      {inputComponent}
    </div>
  );
};

// Custom comparison function for React.memo to prevent unnecessary re-renders
const arePropsEqual = (prevProps: UltraOptimizedInputProps, nextProps: UltraOptimizedInputProps) => {
  // Only re-render if essential props changed
  if (
    prevProps.id !== nextProps.id ||
    prevProps.type !== nextProps.type ||
    prevProps.title !== nextProps.title ||
    prevProps.initialValue !== nextProps.initialValue ||
    prevProps.placeholder !== nextProps.placeholder ||
    prevProps.password !== nextProps.password ||
    prevProps.rows !== nextProps.rows ||
    prevProps.min !== nextProps.min ||
    prevProps.max !== nextProps.max ||
    prevProps.step !== nextProps.step
  ) {
    return false;
  }

  // Deep compare options array
  const prevOptions = prevProps.options || [];
  const nextOptions = nextProps.options || [];
  
  if (prevOptions.length !== nextOptions.length) return false;
  
  return prevOptions.every((prevOption, index) => {
    const nextOption = nextOptions[index];
    return prevOption.id === nextOption.id && prevOption.label === nextOption.label;
  });
};

export const UltraOptimizedInput = React.memo(UltraOptimizedInputComponent, arePropsEqual);

UltraOptimizedInput.displayName = 'UltraOptimizedInput';