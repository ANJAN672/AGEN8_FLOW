import { BlockConfig } from '../types';
import { starterBlock } from './starter';
import { agentBlock } from './agent';
import { apiBlock } from './api';
import { conditionBlock } from './condition';
import { responseBlock } from './response';
import { functionBlock } from './function';
import { integrationBlocks } from './integrations';

export const blockRegistry: Record<string, BlockConfig> = {
  starter: starterBlock,
  agent: agentBlock,
  api: apiBlock,
  condition: conditionBlock,
  response: responseBlock,
  function: functionBlock,
  ...integrationBlocks,
};

export function getBlockConfig(type: string): BlockConfig | undefined {
  return blockRegistry[type];
}

export function getAllBlocks(): BlockConfig[] {
  return Object.values(blockRegistry);
}

export function getBlocksByCategory(category: string): BlockConfig[] {
  return getAllBlocks().filter(block => block.category === category);
}