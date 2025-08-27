import { Play } from 'lucide-react';
import { createElement } from 'react';
import type { FC } from 'react';
import { BlockConfig } from '../types';

const PlayIcon: FC<{ size?: number }> = ({ size }) => createElement(Play, { size });

export const starterBlock: BlockConfig = {
  type: 'starter',
  name: 'Start',
  description: 'Entry point for the workflow',
  category: 'blocks',
  bgColor: '#06b6d4',
  icon: PlayIcon,
  inputs: {},
  outputs: {
    trigger: { type: 'any', description: 'Workflow started' },
    payload: { type: 'json', description: 'Initial payload' }
  },
  async run(ctx) {
    const result = {
      startedAt: new Date().toISOString(),
      workflowId: ctx.workflowId
    };
    ctx.setNodeOutput('trigger', true);
    ctx.setNodeOutput('payload', result);
    return result;
  }
};