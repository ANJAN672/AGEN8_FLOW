import React from 'react';

/**
 * Real-time Slack Channel Manager
 * Provides reactive updates for Slack channel dropdowns
 */

interface SlackChannel {
  id: string;
  label: string;
}

interface SlackChannelCache {
  [token: string]: SlackChannel[];
}

class SlackChannelManager {
  private cache: SlackChannelCache = {};
  private listeners: Set<() => void> = new Set();
  private version = 0;

  // Get channels for a specific token
  getChannels(token: string): SlackChannel[] {
    return this.cache[token] || [];
  }

  // Get all channels across all tokens
  getAllChannels(): SlackChannel[] {
    const allChannels: SlackChannel[] = [];
    for (const channels of Object.values(this.cache)) {
      allChannels.push(...channels);
    }
    return allChannels;
  }

  // Set channels for a token and notify listeners
  setChannels(token: string, channels: SlackChannel[]): void {
    this.cache[token] = channels;
    this.version++;
    this.notifyListeners();
    
    // Also dispatch a global event for components that don't use the manager directly
    window.dispatchEvent(new CustomEvent('SLACK_CHANNELS_UPDATED', {
      detail: { token, channels, version: this.version }
    }));
  }

  // Subscribe to channel updates
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Get current version for cache busting
  getVersion(): number {
    return this.version;
  }

  // Check if channels exist for a token
  hasChannels(token: string): boolean {
    return this.cache[token] && this.cache[token].length > 0;
  }

  // Clear cache for a token
  clearChannels(token: string): void {
    delete this.cache[token];
    this.version++;
    this.notifyListeners();
  }

  // Clear all cache
  clearAll(): void {
    this.cache = {};
    this.version++;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in Slack channel listener:', error);
      }
    });
  }
}

// Global singleton instance
export const slackChannelManager = new SlackChannelManager();

// React hook for using the channel manager
export const useSlackChannels = (token?: string) => {
  const [version, setVersion] = React.useState(slackChannelManager.getVersion());
  
  React.useEffect(() => {
    const unsubscribe = slackChannelManager.subscribe(() => {
      setVersion(slackChannelManager.getVersion());
    });
    
    return unsubscribe;
  }, []);

  const channels = token ? slackChannelManager.getChannels(token) : slackChannelManager.getAllChannels();
  const hasChannels = token ? slackChannelManager.hasChannels(token) : channels.length > 0;

  return {
    channels,
    hasChannels,
    version,
    setChannels: (newChannels: SlackChannel[]) => {
      if (token) {
        slackChannelManager.setChannels(token, newChannels);
      }
    },
    clearChannels: () => {
      if (token) {
        slackChannelManager.clearChannels(token);
      }
    }
  };
};

// For non-React usage
export const getSlackChannels = (token?: string): SlackChannel[] => {
  return token ? slackChannelManager.getChannels(token) : slackChannelManager.getAllChannels();
};

export const setSlackChannels = (token: string, channels: SlackChannel[]): void => {
  slackChannelManager.setChannels(token, channels);
};

export const hasSlackChannels = (token?: string): boolean => {
  return token ? slackChannelManager.hasChannels(token) : slackChannelManager.getAllChannels().length > 0;
};