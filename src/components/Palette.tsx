import { useState, useMemo } from 'react';
import { Search, Plus, Settings, HelpCircle, BookOpen, Folder, ChevronLeft, Sparkles, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getAllBlocks } from '@/lib/blocks/registry';
import { useAppStore } from '@/lib/store';

export function Palette() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const allBlocks = getAllBlocks();
  const { 
    workspaces, 
    currentWorkspaceId, 
    leftSidebarCollapsed, 
    toggleLeftSidebarCollapsed,
    openRightPanel,
    setCopilotSeed
  } = useAppStore();
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  
  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(allBlocks.map(block => block.category || 'other'));
    const sortedCats = Array.from(cats).sort();
    return ['all', ...sortedCats];
  }, [allBlocks]);
  
  const filteredBlocks = useMemo(() => {
    const filtered = allBlocks.filter(block => {
      // Hide the Start block from the palette
      if (block.type === 'starter') return false;
      
      const matchesSearch = !searchTerm || 
        block.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (block.description && block.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || 
        (block.category && block.category === selectedCategory) ||
        (!block.category && selectedCategory === 'other');
      
      return matchesSearch && matchesCategory;
    });
    
    return filtered;
  }, [allBlocks, searchTerm, selectedCategory]);

  const onDragStart = (event: React.DragEvent, blockType: string) => {
    event.dataTransfer.setData('application/reactflow', blockType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleAskCopilot = () => {
    setCopilotSeed("Help me choose the right blocks for my workflow");
    openRightPanel('copilot');
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header with persistent toggle and workspace title */}
      <div className="p-3 shrink-0">
        <Card className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">{currentWorkspace?.name || "My Workspace"}</span>
            <Badge variant="outline" className="text-xs">
              {filteredBlocks.length} blocks
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Collapse sidebar"
            onClick={toggleLeftSidebarCollapsed}
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Card>
      </div>

      <div className="px-3 shrink-0">
        <Card className="p-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm truncate">default-agent</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Plus className="w-4 h-4" />
          </Button>
        </Card>
      </div>

      {/* AI Helper */}
      <div className="px-3 mb-3 shrink-0">
        <Card className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">AI Assistant</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleAskCopilot}
              className="h-7 text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
            >
              Ask AI
            </Button>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Get help choosing the right blocks
          </p>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <div className="px-3 mb-3 shrink-0">
        <Card className="p-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search blocks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                >
                  <Filter className="w-3 h-3 mr-1" />
                  {selectedCategory === 'all' ? 'All' : selectedCategory}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {categories.map((category) => (
                  <DropdownMenuItem
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={selectedCategory === category ? 'bg-accent' : ''}
                  >
                    {category === 'all' ? 'All Categories' : category}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {(searchTerm || selectedCategory !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="h-8 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Scrollable Blocks Container */}
      <div className="flex-1 px-3 mb-3 min-h-0">
        <Card className="h-full flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredBlocks.map((block) => {
                const IconComponent = block.icon;
                return (
                  <Tooltip key={block.type}>
                    <TooltipTrigger asChild>
                      <div
                        className="w-full text-left px-2 py-2 rounded-md hover:bg-muted cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors border border-transparent hover:border-border"
                        draggable
                        onDragStart={(e) => onDragStart(e, block.type)}
                        style={{ userSelect: 'none' }}
                      >
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: block.bgColor || '#6b7280' }}
                        >
                          <IconComponent size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{block.name}</span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-medium">{block.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {block.description || 'No description available'}
                        </p>
                        {block.longDescription && (
                          <p className="text-xs text-muted-foreground">
                            {block.longDescription}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              {filteredBlocks.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-2">
                    {searchTerm || selectedCategory !== 'all' ? 'No blocks match your filters' : 'No blocks found'}
                  </div>
                  {(searchTerm || selectedCategory !== 'all') && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedCategory('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Footer buttons */}
      <div className="px-3 py-2 bg-card/80 backdrop-blur border-t border-border shrink-0">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><Settings className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><HelpCircle className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><BookOpen className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><Folder className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}