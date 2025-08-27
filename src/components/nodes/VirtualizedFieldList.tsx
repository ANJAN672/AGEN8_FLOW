import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { UltraOptimizedInput } from './UltraOptimizedInput';
import type { BlockField } from '@/lib/types';

interface VirtualizedFieldListProps {
  fields: BlockField[];
  nodeData: Record<string, unknown>;
  updateFieldValue: (fieldId: string, value: unknown) => void;
  updateFieldValueImmediate: (fieldId: string, value: unknown) => void;
  stopPropagation: (e: React.MouseEvent | React.PointerEvent) => void;
  height?: number;
  itemHeight?: number;
}

interface FieldItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    fields: BlockField[];
    nodeData: Record<string, unknown>;
    updateFieldValue: (fieldId: string, value: unknown) => void;
    updateFieldValueImmediate: (fieldId: string, value: unknown) => void;
    stopPropagation: (e: React.MouseEvent | React.PointerEvent) => void;
  };
}

const FieldItem: React.FC<FieldItemProps> = React.memo(({ index, style, data }) => {
  const { fields, nodeData, updateFieldValue, updateFieldValueImmediate, stopPropagation } = data;
  const field = fields[index];
  const value = nodeData?.[field.id] || '';

  // Special handling for Gmail credentials
  const isGmailCredential = field.id === 'clientId' || field.id === 'clientSecret';
  const updateFn = isGmailCredential ? updateFieldValueImmediate : updateFieldValue;

  const handleChange = useCallback((newValue: unknown) => {
    if (isGmailCredential) {
      const v = String(newValue || '');
      updateFn(field.id, v);
      // Mirror to sessionStorage for GmailAuthButton to react instantly
      if (field.id === 'clientId') sessionStorage.setItem('gmail_temp_client_id', v);
      if (field.id === 'clientSecret') sessionStorage.setItem('gmail_temp_client_secret', v);
      // Signal listeners to re-evaluate credentials
      window.dispatchEvent(new CustomEvent('AGEN8_GMAIL_CREDENTIALS_CHANGED'));
    } else {
      updateFn(field.id, newValue);
    }
  }, [field.id, updateFn, isGmailCredential]);

  return (
    <div style={style} className="px-1">
      <UltraOptimizedInput
        key={field.id}
        id={field.id}
        type={field.type as any}
        title={field.title}
        initialValue={value}
        onChange={handleChange}
        placeholder={field.placeholder}
        password={field.password || (field.id === 'clientSecret')}
        rows={field.rows}
        options={field.options?.()}
        min={field.min}
        max={field.max}
        step={field.step}
        onPointerDown={stopPropagation}
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
      />
    </div>
  );
});

FieldItem.displayName = 'FieldItem';

export const VirtualizedFieldList: React.FC<VirtualizedFieldListProps> = ({
  fields,
  nodeData,
  updateFieldValue,
  updateFieldValueImmediate,
  stopPropagation,
  height = 400,
  itemHeight = 60
}) => {
  const itemData = useMemo(() => ({
    fields,
    nodeData,
    updateFieldValue,
    updateFieldValueImmediate,
    stopPropagation
  }), [fields, nodeData, updateFieldValue, updateFieldValueImmediate, stopPropagation]);

  // Only use virtualization for large field lists
  if (fields.length <= 10) {
    return (
      <div className="space-y-2">
        {fields.map((field, index) => (
          <FieldItem
            key={field.id}
            index={index}
            style={{}}
            data={itemData}
          />
        ))}
      </div>
    );
  }

  return (
    <List
      height={height}
      itemCount={fields.length}
      itemSize={itemHeight}
      itemData={itemData}
      className="scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
    >
      {FieldItem}
    </List>
  );
};