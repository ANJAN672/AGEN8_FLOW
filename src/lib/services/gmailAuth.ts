/**
 * Gmail OAuth 2.0 Service with Popup Authentication
 * Handles automatic token management and refresh
 */

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at: number; // calculated timestamp
}

export interface GmailAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

// Default redirect URI for this application
const DEFAULT_REDIRECT_URI = `${window.location.origin}/oauth/gmail-callback`;

class GmailAuthService {
  private config: GmailAuthConfig | null = null;
  private tokens: GmailTokens | null = null;
  private readonly STORAGE_KEY = 'gmail_oauth_tokens';
  private readonly CONFIG_STORAGE_KEY = 'gmail_oauth_config';
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  /**
   * Initialize the Gmail auth service with client credentials
   */
  initialize(config: GmailAuthConfig): void {
    this.config = {
      ...config,
      redirectUri: config.redirectUri || DEFAULT_REDIRECT_URI
    };
    
    // Save config to storage for persistence (excluding client secret for security)
    this.saveConfigToStorage();
    
    // Load existing tokens from storage
    this.loadTokensFromStorage();
  }

  /**
   * Auto-initialize from stored config if available
   */
  private autoInitialize(): boolean {
    if (this.config) return true;
    
    const storedConfig = this.loadConfigFromStorage();
    if (storedConfig?.clientId) {
      // We have stored config but missing client secret
      // This is expected for security reasons
      return false;
    }
    return false;
  }

  /**
   * Get the redirect URI that users should configure in their Google OAuth app
   */
  getRedirectUri(): string {
    return this.config?.redirectUri || DEFAULT_REDIRECT_URI;
  }

  /**
   * Check if user is authenticated and tokens are valid
   */
  isAuthenticated(): boolean {
    // Try to auto-initialize if not already done
    this.autoInitialize();
    
    if (!this.tokens) return false;
    
    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const expiresAt = this.tokens.expires_at;
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    
    return now < (expiresAt - bufferTime);
  }

  /**
   * Get current access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    if (!this.config) {
      throw new Error('Gmail auth service not initialized');
    }

    if (!this.tokens) {
      throw new Error('No tokens available. Please authenticate first.');
    }

    // If token is still valid, return it
    if (this.isAuthenticated()) {
      return this.tokens.access_token;
    }

    // Token is expired, try to refresh
    try {
      await this.refreshAccessToken();
      return this.tokens!.access_token;
    } catch (error) {
      // Refresh failed, need to re-authenticate
      throw new Error('Token expired and refresh failed. Please re-authenticate.');
    }
  }

  /**
   * Start OAuth flow with popup window
   */
  async authenticate(): Promise<GmailTokens> {
    if (!this.config) {
      throw new Error('Gmail auth service not initialized');
    }

    return new Promise((resolve, reject) => {
      // Create OAuth URL
      const authUrl = this.buildAuthUrl();
      
      // Open popup window
      const popup = window.open(
        authUrl,
        'gmail-oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        reject(new Error('Failed to open popup window. Please allow popups for this site.'));
        return;
      }

      // Listen for messages from the popup
      const messageListener = (event: MessageEvent) => {
        // Verify origin for security
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data.type === 'GMAIL_OAUTH_SUCCESS' && event.data.code) {
          // Clean up
          window.removeEventListener('message', messageListener);
          clearInterval(pollTimer);
          
          // Exchange code for tokens
          this.exchangeCodeForTokens(event.data.code)
            .then(resolve)
            .catch(reject);
        } else if (event.data.type === 'GMAIL_OAUTH_ERROR') {
          // Clean up
          window.removeEventListener('message', messageListener);
          clearInterval(pollTimer);
          
          reject(new Error(event.data.error || 'OAuth authentication failed'));
        }
      };

      window.addEventListener('message', messageListener);

      // Poll for popup closure (fallback)
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          window.removeEventListener('message', messageListener);
          reject(new Error('Authentication cancelled by user'));
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollTimer);
        window.removeEventListener('message', messageListener);
        if (!popup.closed) {
          popup.close();
        }
        reject(new Error('Authentication timeout'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Build OAuth authorization URL
   */
  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config!.clientId,
      redirect_uri: this.config!.redirectUri!,
      scope: this.SCOPES,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<GmailTokens> {
    if (!this.config) {
      throw new Error('Gmail auth service not initialized');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri!,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
    }

    const tokenData = await response.json();
    
    // Calculate expiration timestamp
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    
    this.tokens = {
      ...tokenData,
      expires_at: expiresAt
    };

    // Save tokens to storage
    this.saveTokensToStorage();
    
    return this.tokens;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.config || !this.tokens?.refresh_token) {
      throw new Error('Cannot refresh token: missing config or refresh token');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Token refresh failed: ${errorData.error_description || response.statusText}`);
    }

    const tokenData = await response.json();
    
    // Update tokens (refresh_token might not be included in response)
    this.tokens = {
      ...this.tokens,
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      // Keep existing refresh_token if not provided
      refresh_token: tokenData.refresh_token || this.tokens.refresh_token
    };

    // Save updated tokens
    this.saveTokensToStorage();
  }

  /**
   * Save tokens to localStorage
   */
  private saveTokensToStorage(): void {
    if (this.tokens) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tokens));
    }
  }

  /**
   * Load tokens from localStorage
   */
  private loadTokensFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.tokens = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load Gmail tokens from storage:', error);
      this.tokens = null;
    }
  }

  /**
   * Clear stored tokens and optionally revoke access (logout)
   */
  async logout(revokeAccess: boolean = false): Promise<void> {
    try {
      // If we have tokens and want to revoke access, call Google's revoke endpoint
      if (revokeAccess && this.tokens?.access_token) {
        try {
          const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${this.tokens.access_token}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            }
          });
          
          if (response.ok) {
            console.log('✅ Successfully revoked Gmail access token');
          } else {
            console.warn('⚠️ Failed to revoke Gmail access token, but continuing with local logout');
          }
        } catch (error) {
          console.warn('⚠️ Error revoking Gmail access token:', error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error during logout process:', error);
    } finally {
      // Always clear local state regardless of revoke success
      this.tokens = null;
      localStorage.removeItem(this.STORAGE_KEY);
      
      // Optionally clear config as well for complete logout
      if (revokeAccess) {
        this.config = null;
        localStorage.removeItem(this.CONFIG_STORAGE_KEY);
      }
    }
  }

  /**
   * Save config to localStorage
   */
  private saveConfigToStorage(): void {
    if (this.config) {
      // Don't store the client secret in localStorage for security
      const configToStore = {
        clientId: this.config.clientId,
        redirectUri: this.config.redirectUri
      };
      localStorage.setItem(this.CONFIG_STORAGE_KEY, JSON.stringify(configToStore));
    }
  }

  /**
   * Load config from localStorage
   */
  private loadConfigFromStorage(): Partial<GmailAuthConfig> | null {
    try {
      const stored = localStorage.getItem(this.CONFIG_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load Gmail config from storage:', error);
    }
    return null;
  }

  /**
   * Get user info from Google API with multiple fallback strategies
   */
  async getUserInfo(): Promise<{ email: string; name: string; picture: string }> {
    try {
      const accessToken = await this.getAccessToken();
      
      // Try multiple endpoints for user info
      const endpoints = [
        'https://www.googleapis.com/oauth2/v2/userinfo',
        'https://www.googleapis.com/oauth2/v1/userinfo',
        'https://openidconnect.googleapis.com/v1/userinfo'
      ];
      
      let lastError: Error | null = null;
      
      for (const endpoint of endpoints) {
        try {
          console.log(`🔍 Trying user info endpoint: ${endpoint}`);
          
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || response.statusText || 'Unknown error';
            lastError = new Error(`${endpoint} failed: ${errorMessage} (Status: ${response.status})`);
            console.warn(`❌ ${endpoint} failed:`, lastError.message);
            continue;
          }

          const userInfo = await response.json();
          console.log(`✅ Successfully got user info from ${endpoint}:`, userInfo);
          
          // Normalize the response format
          const normalizedInfo = {
            email: userInfo.email || userInfo.emailAddress || '',
            name: userInfo.name || userInfo.displayName || this.extractNameFromEmail(userInfo.email || userInfo.emailAddress || ''),
            picture: userInfo.picture || userInfo.photo || userInfo.avatar_url || ''
          };
          
          // If we don't have a proper name, try to construct it from given_name and family_name
          if (!normalizedInfo.name || normalizedInfo.name === normalizedInfo.email) {
            if (userInfo.given_name || userInfo.family_name) {
              normalizedInfo.name = `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim();
            }
          }
          
          // Final fallback: extract name from email
          if (!normalizedInfo.name || normalizedInfo.name === normalizedInfo.email) {
            normalizedInfo.name = this.extractNameFromEmail(normalizedInfo.email);
          }
          
          console.log(`✅ Normalized user info:`, normalizedInfo);
          return normalizedInfo;
          
        } catch (endpointError) {
          lastError = endpointError instanceof Error ? endpointError : new Error(String(endpointError));
          console.warn(`❌ ${endpoint} failed:`, lastError.message);
          continue;
        }
      }
      
      // If all endpoints failed, throw the last error
      throw lastError || new Error('All user info endpoints failed');
      
    } catch (error) {
      console.error('❌ getUserInfo failed:', error);
      
      // If it's already our custom error, re-throw it
      if (error instanceof Error && error.message.includes('failed:')) {
        throw error;
      }
      
      // Handle other errors (network, token issues, etc.)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Authentication failed: ${errorMessage}. Please re-authenticate with Google.`);
    }
  }
  
  /**
   * Extract a readable name from an email address
   */
  private extractNameFromEmail(email: string): string {
    if (!email) return 'Gmail User';
    
    const localPart = email.split('@')[0];
    if (!localPart) return 'Gmail User';
    
    // Handle common patterns like firstname.lastname, first_last, etc.
    return localPart
      .replace(/[._-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ') || 'Gmail User';
  }
}

// Export singleton instance
export const gmailAuth = new GmailAuthService();