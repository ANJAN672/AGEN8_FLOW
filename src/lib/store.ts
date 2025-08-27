import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { Workspace, Workflow, WorkflowExecution, ExecutionLog } from './types';
import { loadFromStorage, saveToStorage } from './storage';
import { startWorkflow } from './execution/engine';

interface AppState {
  // Workspaces
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  currentWorkflowId: string | null;
  
  // UI state
  selectedNodeId: string | null;
  showExecutionLog: boolean;
  showCopilot: boolean;
  isDarkMode: boolean;
  leftSidebarVisible: boolean;
  leftSidebarCollapsed: boolean;

  // Right panel
  rightPanelOpen: boolean;
  rightPanelTab: 'chat' | 'console' | 'copilot' | 'variables' | null;
  
  // Copilot seed prompt
  copilotSeed: string | null;
  
  // Execution
  currentExecution: WorkflowExecution | null;
  isExecuting: boolean;
  // internal engine ref
  _engine?: unknown;
  
  // History
  history: unknown[];
  historyIndex: number;
  
  // Settings
  apiKeys: Record<string, string>;

  // Editing guard
  isNodeEditing: boolean;
  
  // Node UI states
  nodeExpansionStates: Record<string, boolean>;
}

interface AppActions {
  // Workspace actions
  createWorkspace: (name: string) => void;
  deleteWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  setCurrentWorkspace: (id: string) => void;
  
  // Workflow actions
  createWorkflow: (workspaceId: string, name: string) => void;
  deleteWorkflow: (workspaceId: string, workflowId: string) => void;
  renameWorkflow: (workspaceId: string, workflowId: string, name: string) => void;
  setCurrentWorkflow: (id: string) => void;
  updateWorkflow: (workspaceId: string, workflow: Workflow) => void;

  // Workflow variables
  setWorkflowVariable: (key: string, value: string) => void;
  removeWorkflowVariable: (key: string) => void;
  clearWorkflowVariables: () => void;
  
  // UI actions
  setSelectedNode: (id: string | null) => void;
  deleteSelectedNode: () => void;
  toggleExecutionLog: () => void;
  toggleCopilot: () => void;
  toggleDarkMode: () => void;
  toggleLeftSidebar: () => void;
  toggleLeftSidebarCollapsed: () => void;
  toggleHandTool: () => void;

  // Right panel actions
  openRightPanel: (tab: 'chat' | 'console' | 'copilot' | 'variables') => void;
  closeRightPanel: () => void;
  setRightPanelTab: (tab: 'chat' | 'console' | 'copilot' | 'variables') => void;
  
  // Copilot actions
  setCopilotSeed: (seed: string | null) => void;
  
  // Node editing guard
  setIsNodeEditing: (v: boolean) => void;
  
  // Node UI actions
  setNodeExpansionState: (nodeId: string, expanded: boolean) => void;
  
  // Execution actions
  startExecution: (workflowId: string, nodeId?: string) => Promise<void>;
  stopExecution: () => void;
  addExecutionLog: (log: ExecutionLog) => void;
  clearExecution: () => void;
  
  // History actions
  undo: () => void;
  redo: () => void;
  pushHistory: (state: unknown) => void;
  
  // Settings actions
  setApiKey: (provider: string, key: string) => void;
  removeApiKey: (provider: string) => void;
  
  // Storage actions
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

export const useAppStore = create<AppState & AppActions>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      workspaces: [],
      currentWorkspaceId: null,
      currentWorkflowId: null,
      selectedNodeId: null,
      showExecutionLog: false,
      showCopilot: false,
      isDarkMode: false,
      leftSidebarVisible: true,
      leftSidebarCollapsed: false,
      rightPanelOpen: false,
      rightPanelTab: null,
      copilotSeed: null,
      currentExecution: null,
      isExecuting: false,
      history: [],
      historyIndex: -1,
      apiKeys: {},
      isNodeEditing: false,
      nodeExpansionStates: {},

      // Workspace actions
      createWorkspace: (name: string) => {
        set((state) => {
          const workspace: Workspace = {
            id: `ws-${Date.now()}`,
            name,
            workflows: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          return {
            ...state,
            workspaces: [...state.workspaces, workspace],
            currentWorkspaceId: workspace.id
          };
        });
      },

      deleteWorkspace: (id: string) => {
        set((state) => {
          const newWorkspaces = state.workspaces.filter(ws => ws.id !== id);
          return {
            ...state,
            workspaces: newWorkspaces,
            currentWorkspaceId: state.currentWorkspaceId === id ? newWorkspaces[0]?.id || null : state.currentWorkspaceId,
            currentWorkflowId: state.currentWorkspaceId === id ? null : state.currentWorkflowId
          };
        });
      },

      renameWorkspace: (id: string, name: string) => {
        set((state) => ({
          ...state,
          workspaces: state.workspaces.map(ws =>
            ws.id === id 
              ? { ...ws, name, updatedAt: new Date().toISOString() }
              : ws
          )
        }));
      },

      setCurrentWorkspace: (id: string) => {
        set((state) => ({
          ...state,
          currentWorkspaceId: id,
          currentWorkflowId: null
        }));
      },

      // Workflow actions
      createWorkflow: (workspaceId: string, name: string) => {
        set((state) => {
          const workflow: Workflow = {
            id: `wf-${Date.now()}`,
            name,
            nodes: [{
              id: 'starter',
              type: 'starter',
              position: { x: 100, y: 100 },
              data: {}
            }],
            edges: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            starterId: 'starter',
            variables: {}
          };

          return {
            ...state,
            workspaces: state.workspaces.map(ws =>
              ws.id === workspaceId
                ? {
                    ...ws,
                    workflows: [...ws.workflows, workflow],
                    updatedAt: new Date().toISOString()
                  }
                : ws
            ),
            currentWorkflowId: workflow.id
          };
        });
      },

      deleteWorkflow: (workspaceId: string, workflowId: string) => {
        set((state) => ({
          ...state,
          workspaces: state.workspaces.map(ws =>
            ws.id === workspaceId
              ? {
                  ...ws,
                  workflows: ws.workflows.filter(wf => wf.id !== workflowId),
                  updatedAt: new Date().toISOString()
                }
              : ws
          ),
          currentWorkflowId: state.currentWorkflowId === workflowId 
            ? state.workspaces.find(ws => ws.id === workspaceId)?.workflows.filter(wf => wf.id !== workflowId)[0]?.id || null
            : state.currentWorkflowId
        }));
      },

      renameWorkflow: (workspaceId: string, workflowId: string, name: string) => {
        set((state) => ({
          ...state,
          workspaces: state.workspaces.map(ws =>
            ws.id === workspaceId
              ? {
                  ...ws,
                  workflows: ws.workflows.map(wf =>
                    wf.id === workflowId
                      ? { ...wf, name, updatedAt: new Date().toISOString() }
                      : wf
                  ),
                  updatedAt: new Date().toISOString()
                }
              : ws
          )
        }));
      },

      setCurrentWorkflow: (id: string) => {
        set((state) => ({ ...state, currentWorkflowId: id }));
      },

      updateWorkflow: (workspaceId: string, workflow: Workflow) => {
        set((state) => ({
          ...state,
          workspaces: state.workspaces.map(ws =>
            ws.id === workspaceId
              ? {
                  ...ws,
                  workflows: ws.workflows.map(wf =>
                    wf.id === workflow.id
                      ? { ...workflow, updatedAt: new Date().toISOString() }
                      : wf
                  ),
                  updatedAt: new Date().toISOString()
                }
              : ws
          )
        }));
      },

      // UI actions
      setSelectedNode: (id: string | null) => {
        set((state) => ({ ...state, selectedNodeId: id }));
      },

      deleteSelectedNode: () => {
        set((state) => {
          const selectedId = state.selectedNodeId;
          if (!selectedId || !state.currentWorkspaceId || !state.currentWorkflowId) {
            return state;
          }

          const newWorkspaces = state.workspaces.map(ws => {
            if (ws.id !== state.currentWorkspaceId) return ws;
            return {
              ...ws,
              workflows: ws.workflows.map(wf => {
                if (wf.id !== state.currentWorkflowId) return wf;
                // Prevent deleting the starter node
                if (selectedId === wf.starterId) {
                  return { ...wf }; // no-op
                }
                // Filter out the selected node and related edges
                const filteredNodes = wf.nodes.filter(n => n.id !== selectedId);
                const filteredEdges = wf.edges.filter(e => e.source !== selectedId && e.target !== selectedId);
                return {
                  ...wf,
                  nodes: filteredNodes,
                  edges: filteredEdges,
                  updatedAt: new Date().toISOString(),
                };
              }),
              updatedAt: new Date().toISOString(),
            };
          });

          return {
            ...state,
            workspaces: newWorkspaces,
            selectedNodeId: null,
          };
        });
      },

      toggleExecutionLog: () => {
        set((state) => ({ ...state, showExecutionLog: !state.showExecutionLog }));
      },

      toggleCopilot: () => {
        set((state) => ({ ...state, showCopilot: !state.showCopilot }));
      },

      toggleDarkMode: () => {
        set((state) => {
          const newDarkMode = !state.isDarkMode;
          document.documentElement.classList.toggle('dark', newDarkMode);
          return { ...state, isDarkMode: newDarkMode };
        });
      },

      toggleLeftSidebar: () => {
        set((state) => ({ ...state, leftSidebarVisible: !state.leftSidebarVisible }));
      },
      toggleLeftSidebarCollapsed: () => {
        set((state) => ({ ...state, leftSidebarCollapsed: !state.leftSidebarCollapsed }));
      },

      toggleHandTool: () => {
        // Hand tool functionality - could be used for panning mode in the workflow canvas
        // For now, this is a placeholder
        console.log('Hand tool toggled');
      },

      // Right panel actions
      openRightPanel: (tab) => {
        set((state) => ({ ...state, rightPanelOpen: true, rightPanelTab: tab }));
      },
      closeRightPanel: () => {
        set((state) => ({ ...state, rightPanelOpen: false }));
      },
      setRightPanelTab: (tab) => {
        set((state) => ({ ...state, rightPanelTab: tab }));
      },

      // Copilot actions
      setCopilotSeed: (seed) => {
        set((state) => ({ ...state, copilotSeed: seed }));
      },

      // Node editing guard
      setIsNodeEditing: (v) => {
        set((state) => ({ ...state, isNodeEditing: v }));
      },
      
      // Node UI actions
      setNodeExpansionState: (nodeId, expanded) => {
        set((state) => ({ 
          ...state, 
          nodeExpansionStates: { 
            ...state.nodeExpansionStates, 
            [nodeId]: expanded 
          } 
        }));
      },

      // Workflow variables
      setWorkflowVariable: (key, value) => {
        set((state) => {
          if (!state.currentWorkspaceId || !state.currentWorkflowId) return state;
          return {
            ...state,
            workspaces: state.workspaces.map(ws => ws.id !== state.currentWorkspaceId ? ws : ({
              ...ws,
              workflows: ws.workflows.map(wf => wf.id !== state.currentWorkflowId ? wf : ({
                ...wf,
                variables: { ...(wf.variables || {}), [key]: value },
                updatedAt: new Date().toISOString()
              })),
              updatedAt: new Date().toISOString()
            }))
          };
        });
      },
      removeWorkflowVariable: (key) => {
        set((state) => {
          if (!state.currentWorkspaceId || !state.currentWorkflowId) return state;
          return {
            ...state,
            workspaces: state.workspaces.map(ws => ws.id !== state.currentWorkspaceId ? ws : ({
              ...ws,
              workflows: ws.workflows.map(wf => {
                if (wf.id !== state.currentWorkflowId) return wf;
                const vars = { ...(wf.variables || {}) };
                delete vars[key];
                return { ...wf, variables: vars, updatedAt: new Date().toISOString() };
              }),
              updatedAt: new Date().toISOString()
            }))
          };
        });
      },
      clearWorkflowVariables: () => {
        set((state) => {
          if (!state.currentWorkspaceId || !state.currentWorkflowId) return state;
          return {
            ...state,
            workspaces: state.workspaces.map(ws => ws.id !== state.currentWorkspaceId ? ws : ({
              ...ws,
              workflows: ws.workflows.map(wf => wf.id !== state.currentWorkflowId ? wf : ({
                ...wf,
                variables: {},
                updatedAt: new Date().toISOString()
              })),
              updatedAt: new Date().toISOString()
            }))
          };
        });
      },

      // Execution actions
  startExecution: async (workflowId: string, nodeId?: string) => {
        const state = get();
        const workspace = state.workspaces.find(ws => ws.id === state.currentWorkspaceId);
        const workflow = workspace?.workflows.find(wf => wf.id === workflowId);
        
        if (!workflow) return;

        // For individual node execution, preserve existing execution context
        const isIndividualNode = !!nodeId;
        const existingExecution = state.currentExecution;
        
        const execution: WorkflowExecution = isIndividualNode && existingExecution ? {
          ...existingExecution,
          status: 'running',
          logs: [...existingExecution.logs] // Preserve existing logs
        } : {
          id: `exec-${Date.now()}`,
          workflowId,
          status: 'running',
          startTime: new Date().toISOString(),
          logs: [],
          nodeExecutions: {}
        };

        set((state) => ({
          ...state,
          isExecuting: true,
          showExecutionLog: true,
          currentExecution: execution
        }));

        try {
          const { engine, promise } = startWorkflow(
            workflow,
            state.apiKeys,
            (log) => {
              set((currentState) => ({
                ...currentState,
                currentExecution: currentState.currentExecution
                  ? { ...currentState.currentExecution, logs: [...currentState.currentExecution.logs, log] }
                  : null
              }));
            },
            (nodeId, nodeExecution) => {
              set((currentState) => ({
                ...currentState,
                currentExecution: currentState.currentExecution
                  ? {
                      ...currentState.currentExecution,
                      nodeExecutions: { ...currentState.currentExecution.nodeExecutions, [nodeId]: nodeExecution }
                    }
                  : null
              }));
            },
            nodeId ? { 
              onlyNodeId: nodeId, 
              existingExecution: isIndividualNode ? existingExecution : undefined 
            } : undefined
          );
          // store engine for cancellation
          set((s) => ({ ...s, _engine: engine }));
          const result = await promise;
          set((state) => ({
            ...state,
            currentExecution: result,
            isExecuting: false,
            _engine: undefined
          }));
        } catch (error) {
          set((state) => ({
            ...state,
            currentExecution: state.currentExecution
              ? {
                  ...state.currentExecution,
                  status: 'error' as const,
                  endTime: new Date().toISOString()
                }
              : null,
            isExecuting: false,
            _engine: undefined
          }));
        }
      },

      stopExecution: () => {
        const engine = get()._engine as { stop?: () => void } | undefined;
        try {
          engine?.stop?.();
        } catch (e) {
          // ignore cancellation errors
          console.warn('Stop execution error:', e);
        }
        set((state) => ({
          ...state,
          isExecuting: false,
          currentExecution: state.currentExecution
            ? {
                ...state.currentExecution,
                status: 'cancelled' as const,
                endTime: new Date().toISOString()
              }
            : null,
          _engine: undefined
        }));
      },

      addExecutionLog: (log: ExecutionLog) => {
        set((state) => ({
          ...state,
          currentExecution: state.currentExecution
            ? { ...state.currentExecution, logs: [...state.currentExecution.logs, log] }
            : null
        }));
      },

      clearExecution: () => {
        set((state) => ({
          ...state,
          currentExecution: null,
          isExecuting: false
        }));
      },

      // History actions (simplified for MVP)
      undo: () => {
        // TODO: Implement undo functionality
      },

      redo: () => {
        // TODO: Implement redo functionality
      },

  pushHistory: (state: unknown) => {
        // TODO: Implement history push
      },

      // Settings actions
      setApiKey: (provider: string, key: string) => {
        set((state) => ({
          ...state,
          apiKeys: { ...state.apiKeys, [provider]: key }
        }));
      },

      removeApiKey: (provider: string) => {
        set((state) => {
          const newApiKeys = { ...state.apiKeys };
          delete newApiKeys[provider];
          return { ...state, apiKeys: newApiKeys };
        });
      },

      // Storage actions
      loadFromStorage: () => {
        const data = loadFromStorage();
        set((state) => {
          const newState = { ...state, ...data };
          // Apply dark mode class on load
          if (newState.isDarkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          return newState;
        });
      },

      saveToStorage: () => {
        const state = get();
        saveToStorage({
          workspaces: state.workspaces,
          currentWorkspaceId: state.currentWorkspaceId,
          currentWorkflowId: state.currentWorkflowId,
          isDarkMode: state.isDarkMode,
          apiKeys: state.apiKeys
        });
      }
    }))
  )
);

// Auto-save to localStorage
useAppStore.subscribe(
  (state) => state,
  (state) => state.saveToStorage(),
  { fireImmediately: false }
);