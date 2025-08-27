import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OptimizedInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  options?: Array<{ id: string; label: string }>;
  isSelect?: boolean;
}

export const OptimizedInput = memo<OptimizedInputProps>(({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  multiline = false,
  rows = 3,
  options,
  isSelect = false
}) => {
  const [localValue, setLocalValue] = useState(value);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitialMount = useRef(true);

  // Update local value when external value changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setLocalValue(value);
  }, [value]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    
    // For selects, don't debounce as they're single actions
    if (isSelect) {
      onChange(newValue);
      return;
    }
    
    // Debounce the onChange callback for text inputs
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 150);
  }, [onChange, isSelect]);

  if (isSelect && options) {
    return (
      <Select value={localValue} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder || 'Select...'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (multiline) {
    return (
      <Textarea
        id={id}
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    );
  }

  return (
    <Input
      id={id}
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      type={type}
    />
  );
});

OptimizedInput.displayName = 'OptimizedInput';