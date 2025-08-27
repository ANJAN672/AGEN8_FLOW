import { slackChannelManager } from './SlackChannelManager';

/**
 * Reactive Slack channel options that automatically update when channels are loaded
 */
export const createReactiveSlackChannelOptions = () => {
  let lastVersion = 0;
  let cachedOptions: Array<{ id: string; label: string }> = [];

  return () => {
    const currentVersion = slackChannelManager.getVersion();
    
    // Only regenerate options if version changed
    if (currentVersion !== lastVersion) {
      lastVersion = currentVersion;
      
      const allChannels = slackChannelManager.getAllChannels();
      const timestamp = Date.now();
      
      cachedOptions = [];
      
      if (allChannels.length > 0) {
        // Add actual channels
        cachedOptions.push(...allChannels);
        
        // Add manual entry option
        cachedOptions.push({ 
          id: `manual_${timestamp}`, 
          label: '🔧 Enter channel manually'
        });
        
        console.log(`✅ Reactive options updated: ${allChannels.length} channels (v${currentVersion})`);
      } else {
        // No channels loaded yet
        cachedOptions = [
          { id: `loading_${timestamp}`, label: '⏳ Loading channels...' },
          { id: `manual_${timestamp}`, label: '🔧 Enter channel manually' }
        ];
        
        console.log(`⏳ Reactive options: No channels loaded (v${currentVersion})`);
      }
    }
    
    return cachedOptions;
  };
};

/**
 * Enhanced options function that triggers channel loading automatically
 */
export const createAutoLoadingSlackChannelOptions = (nodeId?: string) => {
  const reactiveOptions = createReactiveSlackChannelOptions();
  let loadingTriggered = false;
  
  return () => {
    const options = reactiveOptions();
    
    // If no channels and we haven't triggered loading yet, trigger it
    if (!loadingTriggered && slackChannelManager.getAllChannels().length === 0) {
      loadingTriggered = true;
      
      // Trigger channel loading in the background
      setTimeout(() => {
        console.log('🚀 Auto-triggering Slack channel loading...');
        window.dispatchEvent(new CustomEvent('SLACK_AUTO_LOAD_CHANNELS', {
          detail: { nodeId, timestamp: Date.now() }
        }));
      }, 100);
    }
    
    return options;
  };
};