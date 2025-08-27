import { Code } from 'lucide-react';
import { createElement } from 'react';
import type { FC } from 'react';
import { BlockConfig } from '../types';

const CodeIcon: FC<{ size?: number }> = ({ size }) => createElement(Code, { size });

export const functionBlock: BlockConfig = {
  type: 'function',
  name: 'Custom Function',
  description: 'Execute custom JavaScript code',
  category: 'blocks',
  bgColor: '#8b5cf6',
  icon: CodeIcon,
  subBlocks: [
    {
      id: 'code',
      title: 'Function Code',
      type: 'code',
      layout: 'full',
      language: 'javascript',
      placeholder: `// Return an object with your outputs
return {
  result: "Hello, " + inputs.name,
  timestamp: new Date().toISOString()
};`,
      rows: 10,
      required: true,
      wandConfig: {
        enabled: true,
        generationType: 'code',
        prompt: 'Generate JavaScript code for this function',
        placeholder: 'Describe what the function should do...'
      }
    }
  ],
  inputs: {
    code: { type: 'string', description: 'JavaScript code to execute' }
  },
  outputs: {
    result: { type: 'any', description: 'Function execution result' },
    error: { type: 'string', description: 'Error message if execution failed' }
  },
  async run(ctx) {
  const { code } = ctx.inputs as { code?: unknown };
    
    ctx.log('⚙️ Executing custom function');
    
    try {
      // In a real implementation, use vm2 or a proper sandbox
      // For MVP, we'll do a simple evaluation with basic safety
  const result = executeFunction(String(code ?? ''), ctx.inputs, ctx);
      
      if (typeof result === 'object' && result !== null) {
        // Set all properties of the result as outputs
        Object.entries(result).forEach(([key, value]) => {
          ctx.setNodeOutput(key, value);
        });
      } else {
        ctx.setNodeOutput('result', result);
      }
      
      ctx.log('✅ Function executed successfully');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ctx.log(`❌ Function execution failed: ${errorMessage}`);
      ctx.setNodeOutput('error', errorMessage);
      throw error;
    }
  }
};

// Simple function executor for MVP (not secure - use vm2 in production)
function executeFunction(code: string, inputs: Record<string, unknown>, ctx: { log: (msg: unknown) => void }): unknown {
  try {
    // Create a function wrapper
    const functionWrapper = new Function('inputs', 'ctx', 'log', code);
    return functionWrapper(inputs, ctx, ctx.log);
  } catch (error) {
    throw new Error(`Function execution error: ${error}`);
  }
}