import { useState, useEffect } from 'react';
import { slackChannelManager } from '@/lib/realtime/SlackChannelManager';

/**
 * Hook that provides reactive Slack channels with automatic UI updates
 */
export const useReactiveSlackChannels = (token?: string) => {
  const [version, setVersion] = useState(slackChannelManager.getVersion());
  const [channels, setChannels] = useState(() => 
    token ? slackChannelManager.getChannels(token) : slackChannelManager.getAllChannels()
  );

  useEffect(() => {
    // Subscribe to channel updates
    const unsubscribe = slackChannelManager.subscribe(() => {
      const newVersion = slackChannelManager.getVersion();
      const newChannels = token ? slackChannelManager.getChannels(token) : slackChannelManager.getAllChannels();
      
      setVersion(newVersion);
      setChannels(newChannels);
      
      console.log(`🔄 Reactive channels updated: ${newChannels.length} channels (v${newVersion})`);
    });

    // Also listen for global events
    const handleGlobalUpdate = (event: CustomEvent) => {
      const { token: eventToken, channels: eventChannels, version: eventVersion } = event.detail;
      
      if (!token || token === eventToken) {
        setVersion(eventVersion);
        setChannels(token ? slackChannelManager.getChannels(token) : slackChannelManager.getAllChannels());
        
        console.log(`🌐 Global channel update: ${eventChannels.length} channels (v${eventVersion})`);
      }
    };

    window.addEventListener('SLACK_CHANNELS_UPDATED', handleGlobalUpdate as EventListener);

    return () => {
      unsubscribe();
      window.removeEventListener('SLACK_CHANNELS_UPDATED', handleGlobalUpdate as EventListener);
    };
  }, [token]);

  return {
    channels,
    hasChannels: channels.length > 0,
    version,
    loading: channels.length === 0,
    refresh: () => {
      // Trigger a refresh by clearing and reloading
      if (token) {
        slackChannelManager.clearChannels(token);
      } else {
        slackChannelManager.clearAll();
      }
      
      // Trigger auto-load
      window.dispatchEvent(new CustomEvent('SLACK_AUTO_LOAD_CHANNELS', {
        detail: { nodeId: 'manual-refresh', timestamp: Date.now() }
      }));
    }
  };
};