import { GitBranch } from 'lucide-react';
import { BlockConfig } from '../types';

export const conditionBlock: BlockConfig = {
  type: 'condition',
  name: 'Condition',
  description: 'Branch workflow based on conditions',
  category: 'control',
  bgColor: '#a855f7',
  icon: GitBranch as unknown as React.FC<{ size?: number }>,
  subBlocks: [
    {
      id: 'expression',
      title: 'Condition Expression',
      type: 'code',
      layout: 'full',
      language: 'javascript',
      placeholder: 'status === 200 && data.success === true',
      required: true
    }
  ],
  inputs: {
    expression: { type: 'string', description: 'JavaScript expression to evaluate' }
  },
  outputs: {
    result: { type: 'any', description: 'Condition result (true/false)' }
  },
  async run(ctx) {
  const { expression } = ctx.inputs as { expression?: unknown };
    
  ctx.log(`🔀 Evaluating condition: ${String(expression)}`);
    
    try {
      // Get all previous node outputs for the evaluation context
  const context: Record<string, unknown> = {};
      
      // Simple expression evaluation (in a real implementation, use a safe sandbox)
      // For MVP, we'll do basic pattern matching
  const result = evaluateExpression(String(expression ?? ''), context);
      
      ctx.setNodeOutput('result', result);
      ctx.log(`✅ Condition result: ${result}`);
      
      return { result };
    } catch (error) {
      ctx.log(`❌ Condition evaluation failed: ${error}`);
      const result = false;
      ctx.setNodeOutput('result', result);
      return { result };
    }
  }
};

// Simple expression evaluator for MVP
function evaluateExpression(expression: string, _context: Record<string, unknown>): boolean {
  // For MVP, just return true for non-empty expressions
  // In a real implementation, use a safe JS sandbox
  return expression.trim().length > 0;
}