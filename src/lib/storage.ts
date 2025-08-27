const STORAGE_KEY = 'AGEN8-storage';

export interface StoredData {
  workspaces: Array<{
    id: string;
    name: string;
    workflows: Array<{
      id: string;
      name: string;
      nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>;
      edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string }>;
      createdAt: string;
      updatedAt: string;
      starterId: string;
      variables?: Record<string, string>;
    }>;
    createdAt: string;
    updatedAt: string;
  }>;
  currentWorkspaceId: string | null;
  currentWorkflowId: string | null;
  isDarkMode: boolean;
  apiKeys: Record<string, string>;
}

export function saveToStorage(data: StoredData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

export function loadFromStorage(): Partial<StoredData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
  }
  return {};
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}