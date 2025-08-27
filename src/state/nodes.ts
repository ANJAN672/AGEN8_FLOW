import { create } from 'zustand';
import { registry as localRegistry } from '@/lib/registry';

export type NodeEndpoint = { id: string; method: string; path: string; schema: unknown };
export type NodeDefinition = {
  type: string;
  alias: string;
  name: string;
  category: string;
  endpoints: NodeEndpoint[];
  inputs: Record<string, string>;
  outputs: Record<string, string>;
};

type NodesState = {
  registry: { nodes: NodeDefinition[] } | null;
  loading: boolean;
  error: string | null;
  fetchRegistry: () => Promise<void>;
};

export const useNodes = create<NodesState>((set) => ({
  registry: null,
  loading: false,
  error: null,
  fetchRegistry: async () => {
    set({ loading: true, error: null });
    try {
      // Use local in-memory registry instead of calling backend
      const data = { nodes: localRegistry.nodes as NodeDefinition[] };
      // Simulate tiny delay for UX consistency
      await new Promise((r) => setTimeout(r, 0));
      set({ registry: data, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
}));