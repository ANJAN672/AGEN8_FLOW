import { Suspense, lazy, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Wand2 } from 'lucide-react';
import { BlockField } from '@/lib/types';
import { CodeEditor } from './CodeEditor';
import { OptimizedInput } from './OptimizedInput';

const ExpressionEditorLazy = lazy(async () => {
  const mod = await import('@/components/ExpressionEditor');
  return { default: mod.ExpressionEditor };
});

interface DynamicFormProps {
  fields: BlockField[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function DynamicForm({ fields, values, onChange }: DynamicFormProps) {
  const [localValues, setLocalValues] = useState(values);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitialMount = useRef(true);

  // Update local values when external values change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setLocalValues(values);
  }, [values]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Debounced onChange to prevent excessive re-renders
  const debouncedOnChange = useCallback((newValues: Record<string, unknown>) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      onChange(newValues);
    }, 150); // 150ms debounce
  }, [onChange]);

  const updateValue = useCallback((fieldId: string, value: unknown) => {
    const newValues = { ...localValues, [fieldId]: value };
    setLocalValues(newValues);
    debouncedOnChange(newValues);
  }, [localValues, debouncedOnChange]);

  const evaluateCondition = (condition: unknown): boolean => {
    if (typeof condition === 'function') {
      try {
        return (condition as () => boolean)();
      } catch {
        return true;
      }
    }

    if (typeof condition === 'object' && condition && 'field' in (condition as Record<string, unknown>)) {
      const c = condition as { field: string; value: unknown; not?: boolean };
      const fieldValue = (localValues as Record<string, unknown>)[c.field];
      const matches = c.value === fieldValue;
      return c.not ? !matches : matches;
    }

    return true;
  };

  const renderField = useCallback((field: BlockField) => {
    // Check field condition
    if (field.condition && !evaluateCondition(field.condition)) {
      return null;
    }

    const value = localValues[field.id] || '';
    const isFullWidth = field.layout === 'full';

    const fieldContent = (
      <div className={`space-y-2 ${isFullWidth ? 'col-span-2' : ''}`}>
        <div className="flex items-center justify-between">
          <Label htmlFor={field.id} className="text-sm font-medium">
            {field.title}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>

          {field.wandConfig?.enabled && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Wand2 className="w-3 h-3" />
            </Button>
          )}
        </div>

        {renderFieldInput(field, value)}
      </div>
    );

    return (
      <div key={field.id} className={isFullWidth ? 'col-span-2' : ''}>
        {fieldContent}
      </div>
    );
  }, [localValues]);

  const renderFieldInput = useCallback((field: BlockField, value: unknown) => {
    switch (field.type) {
      case 'short-input':
        return (
          <OptimizedInput
            id={field.id}
            value={String(value ?? '')}
            onChange={(newValue) => updateValue(field.id, newValue)}
            placeholder={field.placeholder}
            type={field.password ? 'password' : 'text'}
          />
        );

      case 'long-input':
        return (
          <OptimizedInput
            id={field.id}
            value={String(value ?? '')}
            onChange={(newValue) => updateValue(field.id, newValue)}
            placeholder={field.placeholder}
            multiline={true}
            rows={field.rows || 3}
          />
        );

      case 'expression':
        return (
          <div>
            <OptimizedInput
              id={field.id}
              value={String(value ?? '')}
              onChange={(newValue) => updateValue(field.id, newValue)}
              placeholder={field.placeholder}
              multiline={true}
              rows={field.rows || 3}
            />
            <Suspense fallback={null}>
              <ExpressionEditorLazy
                value={String(value ?? '')}
                onChange={(v: string) => updateValue(field.id, v)}
                contextBuilder={undefined}
              />
            </Suspense>
          </div>
        );

      case 'code':
        return (
          <CodeEditor
            value={String(value ?? '')}
            onChange={(newValue) => updateValue(field.id, newValue)}
            language={field.language || 'javascript'}
            placeholder={field.placeholder}
          />
        );

      case 'slider':
        return (
          <div className="space-y-2">
            <Slider
              value={[Number(value ?? field.min ?? 0)]}
              onValueChange={([newValue]) => updateValue(field.id, newValue)}
              min={field.min || 0}
              max={field.max || 100}
              step={field.step || 1}
            />
            <div className="text-xs text-muted-foreground text-right">
              {String(value ?? field.min ?? 0)}
            </div>
          </div>
        );

      case 'toggle':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={field.id}
              checked={Boolean(value)}
              onCheckedChange={(checked) => updateValue(field.id, checked)}
            />
            <Label htmlFor={field.id} className="text-sm">
              {field.placeholder || 'Enable'}
            </Label>
          </div>
        );

      case 'combobox': {
        const options = field.options ? field.options() : [];
        return (
          <OptimizedInput
            id={field.id}
            value={String(value ?? '')}
            onChange={(newValue) => updateValue(field.id, newValue)}
            placeholder={field.placeholder}
            isSelect={true}
            options={options}
          />
        );
      }

      case 'number':
        return (
          <OptimizedInput
            id={field.id}
            type="number"
            value={String(value ?? 0)}
            onChange={(newValue) => updateValue(field.id, Number.parseFloat(newValue) || 0)}
            placeholder={field.placeholder}
          />
        );

      case 'datetime':
        return (
          <OptimizedInput
            id={field.id}
            type="datetime-local"
            value={String(value ?? '')}
            onChange={(newValue) => updateValue(field.id, newValue)}
            placeholder={field.placeholder}
          />
        );

      default:
        return (
          <OptimizedInput
            id={field.id}
            value={String(value ?? '')}
            onChange={(newValue) => updateValue(field.id, newValue)}
            placeholder={field.placeholder}
          />
        );
    }
  }, [updateValue]);

  // Memoize the rendered fields to prevent unnecessary re-renders
  const renderedFields = useMemo(() => {
    return fields.map(renderField);
  }, [fields, renderField]);

  return (
    <Card className="p-4">
      <div className="grid grid-cols-2 gap-4">
        {renderedFields}
      </div>
    </Card>
  );
}