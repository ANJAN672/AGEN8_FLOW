import React, { useEffect } from 'react';
import { slackChannelManager } from '@/lib/realtime/SlackChannelManager';

/**
 * Component that automatically loads Slack channels when requested
 * This runs in the background and triggers channel loading for dropdowns
 */
export const SlackChannelAutoLoader: React.FC = () => {
  useEffect(() => {
    const handleAutoLoad = async (event: CustomEvent) => {
      const { nodeId, timestamp } = event.detail;
      
      console.log(`🚀 Auto-loading Slack channels triggered by ${nodeId} at ${timestamp}`);
      
      // Check if we already have channels
      if (slackChannelManager.getAllChannels().length > 0) {
        console.log('✅ Channels already loaded, skipping auto-load');
        return;
      }
      
      try {
        // Try to find a Slack token from the current workflow context
        const token = await findSlackToken();
        
        if (!token) {
          console.log('⚠️ No Slack token found for auto-loading channels');
          return;
        }
        
        console.log(`🔄 Auto-loading channels with token: ${token.substring(0, 10)}...`);
        
        // Load channels using the Slack API
        const channels = await loadSlackChannels(token);
        
        if (channels && channels.length > 0) {
          slackChannelManager.setChannels(token, channels);
          console.log(`✅ Auto-loaded ${channels.length} Slack channels`);
        }
        
      } catch (error) {
        console.error('❌ Failed to auto-load Slack channels:', error);
      }
    };
    
    // Listen for auto-load requests
    window.addEventListener('SLACK_AUTO_LOAD_CHANNELS', handleAutoLoad as EventListener);
    
    return () => {
      window.removeEventListener('SLACK_AUTO_LOAD_CHANNELS', handleAutoLoad as EventListener);
    };
  }, []);
  
  return null; // This component doesn't render anything
};

// Helper function to find Slack token from workflow context
async function findSlackToken(): Promise<string | null> {
  try {
    // Try to get token from localStorage or sessionStorage
    const storedToken = localStorage.getItem('slack_token') || sessionStorage.getItem('slack_token');
    if (storedToken && storedToken.startsWith('xoxb-')) {
      return storedToken;
    }
    
    // Try to get token from current workflow nodes
    const workflowData = (window as any).__AGEN8_WORKFLOW_DATA__;
    if (workflowData && workflowData.nodes) {
      for (const node of workflowData.nodes) {
        if (node.type === 'slack' && node.data?.apiKey) {
          const token = node.data.apiKey;
          if (token.startsWith('xoxb-')) {
            return token;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding Slack token:', error);
    return null;
  }
}

// Helper function to load channels from Slack API
async function loadSlackChannels(token: string): Promise<Array<{ id: string; label: string }> | null> {
  try {
    const response = await fetch('/api/slack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        method: 'conversations.list',
        types: 'public_channel,private_channel',
        limit: 100
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }
    
    const channels = data.channels || [];
    return channels.map((channel: any) => ({
      id: channel.id,
      label: channel.is_private 
        ? `🔒 ${channel.name} (Private)` 
        : `📢 #${channel.name}`
    }));
    
  } catch (error) {
    console.error('Error loading Slack channels:', error);
    return null;
  }
}