import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export function CodeEditor({ 
  value, 
  onChange, 
  language = 'javascript', 
  placeholder,
  readOnly = false 
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      // Auto-resize textarea
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // For MVP, use a simple textarea with basic syntax highlighting styles
  // In production, integrate Monaco editor properly
  return (
    <Card className="p-0 overflow-hidden">
      <div className="bg-muted/30 border-b border-border px-3 py-2">
        <span className="text-xs font-mono text-muted-foreground uppercase">
          {language}
        </span>
      </div>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className="w-full min-h-[100px] p-3 bg-transparent border-0 resize-none focus:outline-none focus:ring-0 font-mono text-sm"
          style={{
            lineHeight: '1.5',
            tabSize: 2
          }}
          onKeyDown={(e) => {
            // Handle tab indentation
            if (e.key === 'Tab') {
              e.preventDefault();
              const textarea = e.currentTarget;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const newValue = value.substring(0, start) + '  ' + value.substring(end);
              onChange(newValue);
              
              // Move cursor
              setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 2;
              }, 0);
            }
          }}
        />
      </div>
    </Card>
  );
}