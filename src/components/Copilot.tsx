import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Sparkles, X, Wand2, Zap, Settings } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { copilotService } from '@/lib/services/copilot';
import { openaiService } from '@/lib/services/openai';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  workflowGenerated?: boolean;
}

export function Copilot() {
  const { 
    toggleCopilot, 
    copilotSeed, 
    setCopilotSeed,
    currentWorkspaceId,
    currentWorkflowId,
    updateWorkflow,
    workspaces
  } = useAppStore();
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: openaiService.isConfigured() 
        ? '🚀 Hi! I\'m your AI workflow builder. I create workflows exactly as you describe them - no templates, no assumptions, just what you ask for.\n\n🎯 **How I work:**\n• **Listen First** - I build exactly what you describe\n• **Your Way** - Simple requests get simple workflows, complex ones get robust solutions\n• **60+ Integrations** - WhatsApp, Slack, Gmail, APIs, databases, and more\n• **Flexible Flow** - You decide the order and connections\n\n💬 **Just tell me what you want:**\n• "Basic chatbot that responds via Slack"\n• "Send email summaries to my team"\n• "Process files and notify me on WhatsApp"\n• "Simple API that returns data"\n\nDescribe your workflow in plain English - I\'ll build it! 🛠️' 
        : 'Hi! I\'m your AI workflow builder, but I need an OpenAI API key to function. Please configure your API key in the .env.local file.',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Auto-focus input when component mounts
  useEffect(() => {
    if (textareaRef.current && openaiService.isConfigured()) {
      textareaRef.current.focus();
    }
  }, []);

  // Keep a stable ref to the sender to avoid effect dependencies noise
  const handleSendMessageRef = useRef<(messageContent?: string) => Promise<void>>();

  // If a seed is present, auto-send it once, then clear the seed
  useEffect(() => {
    if (copilotSeed) {
      // Send as a normal user message (avoid adding a separate "seed" preview message)
      handleSendMessageRef.current?.(copilotSeed);
      setCopilotSeed(null);
    }
  }, [copilotSeed, setCopilotSeed]);

  const handleSendMessage = async (messageContent?: string) => {
    const content = messageContent ?? input.trim();
    if (!content) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    if (messageContent === undefined) setInput('');
    
    // Show immediate typing indicator
    setTypingIndicator(true);
    
    // Small delay to show responsiveness
    setTimeout(() => {
      setTypingIndicator(false);
      setIsGenerating(true);
    }, 300);

    try {
      // Check if user wants to create a workflow
      const lc = content.toLowerCase();
      const workflowKeywords = [
        'create', 'build', 'make', 'workflow', 'generate', 'automation', 'automate', 
        'connect', 'integrate', 'process', 'analyze', 'fetch', 'send', 'store',
        'youtube', 'google', 'api', 'database', 'email', 'notification', 'report',
        'chatbot', 'data analysis', 'content', 'social media', 'e-commerce'
      ];
      const isWorkflowRequest = workflowKeywords.some(keyword => lc.includes(keyword)) || 
                               lc.includes(' to ') || // "connect X to Y"
                               lc.includes(' with ') || // "integrate X with Y"
                               lc.includes(' from ') || // "fetch data from X"
                               lc.includes(' and '); // "do X and Y"

      if (isWorkflowRequest && openaiService.isConfigured()) {
        await handleWorkflowGeneration(content, userMessage);
      } else {
        await handleRegularChat(content, userMessage);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}.\n\nLet me try a different approach. Could you rephrase your request?`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
      setTypingIndicator(false);
    }
  };

  // keep ref updated with the latest impl on every render (no deps to avoid lint churn)
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  });

  const handleRegularChat = async (content: string, userMessage: ChatMessage) => {
    const conversationHistory = messages
      .filter(m => m.id !== 'welcome' && m.role !== 'user' || m.id !== userMessage.id)
      .map(m => ({ role: m.role, content: m.content }));

    // Create streaming message immediately
    const streamingMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true
    };

    setMessages(prev => [...prev, streamingMessage]);

    let fullContent = '';
    let lastUpdateTime = Date.now();
    
    await copilotService.streamChatWithContext(
      content,
      conversationHistory,
      (chunk) => {
        fullContent += chunk;
        const now = Date.now();
        
        // Throttle updates for better performance (update every 50ms max)
        if (now - lastUpdateTime > 50) {
          setMessages(prev => prev.map(m => 
            m.id === streamingMessage.id 
              ? { ...m, content: fullContent }
              : m
          ));
          lastUpdateTime = now;
        }
      }
    );

    // Final update to ensure all content is shown
    setMessages(prev => prev.map(m => 
      m.id === streamingMessage.id 
        ? { ...m, content: fullContent, isStreaming: false }
        : m
    ));
  };

  const handleWorkflowGeneration = async (content: string, userMessage: ChatMessage) => {
    setIsCreatingWorkflow(true);
    
    try {
      // Show immediate planning message
      const planningMessage: ChatMessage = {
        id: `planning-${Date.now()}`,
        role: 'assistant',
        content: `🧠 **Analyzing your request...**\n\nI'm planning the perfect workflow for: "${content}"\n\n⚡ This will take just a moment...`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, planningMessage]);
      
      // Generate workflow plan
      const plan = await copilotService.generateWorkflowPlan(content);
      
      // Update planning message to show what we're building
      setMessages(prev => prev.map(m => 
        m.id === planningMessage.id 
          ? { 
              ...m, 
              content: `🎯 **Workflow Plan Ready!**\n\n**"${plan.description}"**\n\n🔧 **Building blocks:**\n${plan.blocks.map(b => `• ${b.name}`).join('\n')}\n\n⚡ **Creating workflow now...**`
            }
          : m
      ));
      
      // Implement the workflow
      const { nodes, edges } = await copilotService.implementWorkflowPlan(plan);
      
      // Update the current workflow
      if (currentWorkspaceId && currentWorkflowId) {
        const currentWorkspace = workspaces.find(ws => ws.id === currentWorkspaceId);
        const currentWorkflow = currentWorkspace?.workflows.find(wf => wf.id === currentWorkflowId);
        
        if (currentWorkflow) {
          const updatedWorkflow = {
            ...currentWorkflow,
            nodes: [...currentWorkflow.nodes, ...nodes],
            edges: [...currentWorkflow.edges, ...edges],
            updatedAt: new Date().toISOString()
          };
          
          updateWorkflow(currentWorkspaceId, updatedWorkflow);
        }
      }
      
      // Success message with better formatting
      const successMessage: ChatMessage = {
        id: `success-${Date.now()}`,
        role: 'assistant',
        content: `🎉 **Workflow Created Successfully!**\n\n📊 **Added to canvas:**\n• ${nodes.length} blocks\n• ${edges.length} connections\n\n🔧 **Workflow components:**\n${plan.blocks.map(b => `• **${b.name}**: ${b.description}`).join('\n')}\n\n✅ **Ready to use!** You can now run the workflow or customize the blocks as needed.`,
        timestamp: new Date().toISOString(),
        workflowGenerated: true
      };
      
      setMessages(prev => [...prev, successMessage]);
      
    } catch (error) {
      console.error('Workflow generation error:', error);
      const errorMessage: ChatMessage = {
        id: `workflow-error-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Workflow Creation Failed**\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\n💡 **Let me help differently:**\n• Try describing your workflow in simpler terms\n• I can suggest blocks manually\n• Or ask me specific questions about workflow building`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  const handleSend = () => handleSendMessage();

  const generateQuickWorkflow = async (type: 'chatbot' | 'notification' | 'simple-api') => {
    const prompts = {
      chatbot: 'Create a basic chatbot that responds to messages',
      'notification': 'Send me notifications when something happens',
      'simple-api': 'Build a simple API that processes data and returns results'
    };
    
    await handleSendMessage(prompts[type]);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">AI Copilot</h3>
            <Badge variant={openaiService.isConfigured() ? "default" : "destructive"} className="text-xs">
              {openaiService.isConfigured() ? "Active" : "No API Key"}
            </Badge>
          </div>
          

        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 [&>[data-radix-scroll-area-scrollbar]]:hidden">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <Card className={`max-w-[85%] p-3 ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : message.workflowGenerated
                  ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                  : 'bg-card'
              }`}>
                <div className="flex items-start gap-2">
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 mt-0.5">
                      {message.workflowGenerated ? (
                        <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content.split('\n').map((line, index) => {
                        // Simple markdown-like formatting
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return <div key={index} className="font-bold text-foreground mb-1">{line.slice(2, -2)}</div>;
                        }
                        if (line.startsWith('• ')) {
                          return <div key={index} className="ml-2 text-muted-foreground">{line}</div>;
                        }
                        if (line.includes('**')) {
                          const parts = line.split('**');
                          return (
                            <div key={index}>
                              {parts.map((part, i) => 
                                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                              )}
                            </div>
                          );
                        }
                        return <div key={index}>{line}</div>;
                      })}
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                      )}
                    </div>
                    <span className={`text-xs mt-2 block ${
                      message.role === 'user' 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          ))}
          
          {(isGenerating || isCreatingWorkflow || typingIndicator) && (
            <div className="flex justify-start">
              <Card className="max-w-[85%] p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                    {isCreatingWorkflow ? '🔧 Building your workflow...' : 
                     typingIndicator ? '💭 Processing...' : 
                     '🤔 Thinking...'}
                  </span>
                </div>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      {openaiService.isConfigured() && (
        <div className="p-4 border-b border-border">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Quick Workflows:</p>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateQuickWorkflow('chatbot')}
                disabled={isGenerating || isCreatingWorkflow}
              >
                <Wand2 className="w-3 h-3 mr-1" />
                Chatbot
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateQuickWorkflow('api-processor')}
                disabled={isGenerating || isCreatingWorkflow}
              >
                <Wand2 className="w-3 h-3 mr-1" />
                API Processor
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateQuickWorkflow('data-analyzer')}
                disabled={isGenerating || isCreatingWorkflow}
              >
                <Wand2 className="w-3 h-3 mr-1" />
                Data Analyzer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                openaiService.isConfigured() 
                  ? "Describe the workflow you want to create... (Press Enter to send, Shift+Enter for new line)" 
                  : "Configure OpenAI API key to use AI features"
              }
              className="min-h-[60px] resize-none pr-12 transition-all duration-200 focus:ring-2 focus:ring-blue-500 scrollbar-none"
              disabled={!openaiService.isConfigured() || isGenerating || isCreatingWorkflow}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
        {input.trim() && (
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {input.length}/1000
              </div>
            )}
          </div>
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isGenerating || isCreatingWorkflow || !openaiService.isConfigured()}
            className="px-4 py-2 h-auto min-h-[60px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            {isGenerating || isCreatingWorkflow ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
                  <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {!openaiService.isConfigured() && (
          <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-200">
            <Settings className="w-3 h-3 inline mr-1" />
            Add your OpenAI API key to .env.local to enable AI features
          </div>
        )}
      </div>
    </div>
  );
}