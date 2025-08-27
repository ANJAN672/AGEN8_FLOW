import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface IsolatedInputProps {
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

// This component is completely isolated and manages its own state
// It only communicates with parent through debounced onChange calls
export const IsolatedInput: React.FC<IsolatedInputProps> = React.memo(({
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
  const [localValue, setLocalValue] = useState(initialValue);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const lastInitialValueRef = useRef(initialValue);

  // Only update local value if initialValue actually changed (not just a re-render)
  useEffect(() => {
    if (initialValue !== lastInitialValueRef.current) {
      setLocalValue(initialValue);
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

  const handleChange = useCallback((newValue: unknown) => {
    setLocalValue(newValue);
    
    // For non-text inputs, don't debounce
    if (type === 'toggle' || type === 'combobox' || type === 'slider') {
      onChange(newValue);
      return;
    }
    
    // Debounce text inputs
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300); // Longer debounce for better performance
  }, [onChange, type]);

  const stopPropagation = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    if (onPointerDown && 'pointerId' in e) onPointerDown(e as React.PointerEvent);
    if (onMouseDown && 'button' in e) onMouseDown(e as React.MouseEvent);
    if (onClick) onClick(e as React.MouseEvent);
  }, [onPointerDown, onMouseDown, onClick]);

  const renderInput = () => {
    switch (type) {
      case 'short-input':
        return (
          <Input
            type={password ? 'password' : 'text'}
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={(e) => handleChange(e.target.value)}
            className="h-7 text-xs bg-[#333333] border-[#555555] text-white placeholder:text-[#888888] nodrag"
            onPointerDown={stopPropagation}
            onMouseDown={stopPropagation}
            onClick={stopPropagation}
          />
        );

      case 'long-input':
        return (
          <Textarea
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={(e) => {
              handleChange(e.target.value);
              // Auto-resize textarea
              requestAnimationFrame(() => {
                const el = e.currentTarget as HTMLTextAreaElement;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 400) + 'px';
              });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const el = e.currentTarget as HTMLTextAreaElement;
                const start = el.selectionStart ?? 0;
                const end = el.selectionEnd ?? 0;
                const newVal = String(localValue || '').slice(0, start) + '  ' + String(localValue || '').slice(end);
                handleChange(newVal);
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = start + 2;
                });
              }
            }}
            className="min-h-[50px] text-xs resize-none bg-[#333333] border-[#555555] text-white placeholder:text-[#888888] font-mono/relaxed nodrag"
            rows={rows}
            onPointerDown={stopPropagation}
            onMouseDown={stopPropagation}
            onClick={stopPropagation}
          />
        );

      case 'code':
        return (
          <Textarea
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={(e) => {
              handleChange(e.target.value);
              // Auto-resize textarea
              requestAnimationFrame(() => {
                const el = e.currentTarget as HTMLTextAreaElement;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 500) + 'px';
              });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const el = e.currentTarget as HTMLTextAreaElement;
                const start = el.selectionStart ?? 0;
                const end = el.selectionEnd ?? 0;
                const v = String(localValue || '');
                const newVal = v.slice(0, start) + '  ' + v.slice(end);
                handleChange(newVal);
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = start + 2;
                });
              }
            }}
            className="min-h-[100px] text-xs resize-none bg-[#1f1f1f] border-[#444444] text-white placeholder:text-[#888888] font-mono nodrag"
            rows={rows || 8}
            onPointerDown={stopPropagation}
            onMouseDown={stopPropagation}
            onClick={stopPropagation}
          />
        );

      case 'combobox':
        return (
          <Select value={String(localValue || '')} onValueChange={handleChange}>
            <SelectTrigger className="h-7 text-xs bg-[#333333] border-[#555555] text-white" onClick={stopPropagation}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
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
            onClick={stopPropagation}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={(e) => handleChange(e.target.value)}
            className="h-7 text-xs bg-background border-border"
            onClick={stopPropagation}
          />
        );

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={(e) => handleChange(e.target.value)}
            className="h-7 text-xs bg-background border-border"
            onClick={stopPropagation}
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
              onPointerDown={stopPropagation}
              onMouseDown={stopPropagation}
              onClick={stopPropagation}
              className="nodrag"
            />
          </div>
        );
      }

      default:
        return (
          <Input
            placeholder={placeholder}
            value={String(localValue || '')}
            onChange={(e) => handleChange(e.target.value)}
            className="h-7 text-xs bg-background border-border"
            onClick={stopPropagation}
          />
        );
    }
  };

  if (type === 'toggle') {
    return (
      <div className="flex items-center justify-between py-1">
        <Label className="text-xs font-medium text-[#cccccc]">{title}</Label>
        {renderInput()}
      </div>
    );
  }

  if (type === 'slider') {
    const sliderValue = Number(localValue ?? min ?? 0);
    return (
      <div className="space-y-1">
        <Label className="text-xs font-medium text-[#cccccc] flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[10px] text-[#aaaaaa] font-mono">{sliderValue}</span>
        </Label>
        {renderInput()}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-[#cccccc]">{title}</Label>
      {renderInput()}
    </div>
  );
});

IsolatedInput.displayName = 'IsolatedInput';