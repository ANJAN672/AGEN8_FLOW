/**
 * Gmail Authentication Button Component
 * Handles OAuth popup flow and displays auth status
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, LogOut, User, AlertCircle, CheckCircle, Copy, ExternalLink, Info } from 'lucide-react';
import { gmailAuth } from '@/lib/services/gmailAuth';
import { gmailApi } from '@/lib/services/gmailApi';

interface GmailAuthButtonProps {
  clientId: string;
  clientSecret: string;
  onAuthChange?: (isAuthenticated: boolean) => void;
  className?: string;
}

export const GmailAuthButton: React.FC<GmailAuthButtonProps> = ({
  clientId,
  clientSecret,
  onAuthChange,
  className = ''
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; picture: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSetupInfo, setShowSetupInfo] = useState(false);
  const [redirectUri, setRedirectUri] = useState<string>('');
  const [credentialsStored, setCredentialsStored] = useState(false);

  // Store credentials in sessionStorage for persistence during auth flow
  useEffect(() => {
    if (clientId) sessionStorage.setItem('gmail_temp_client_id', clientId);
    if (clientSecret) sessionStorage.setItem('gmail_temp_client_secret', clientSecret);
    setCredentialsStored(Boolean(clientId && clientSecret));
  }, [clientId, clientSecret]);

  // Initialize auth service and check existing authentication
  useEffect(() => {
    const initializeAuth = async () => {
      let currentClientId = clientId || sessionStorage.getItem('gmail_temp_client_id') || '';
      let currentClientSecret = clientSecret || sessionStorage.getItem('gmail_temp_client_secret') || '';

      if (currentClientId && currentClientSecret) {
        gmailAuth.initialize({ clientId: currentClientId, clientSecret: currentClientSecret });
        setRedirectUri(gmailAuth.getRedirectUri());
        const authenticated = gmailAuth.isAuthenticated();
        setIsAuthenticated(authenticated);

        if (authenticated) {
          try {
            gmailApi.initialize(gmailAuth);
            const info = await gmailApi.getUserInfo();
            setUserInfo(info);
            setError(null);
          } catch (err) {
            console.warn('Failed to get user info:', err);
            setError('Connected but failed to fetch user info. Gmail functions should still work.');
          }
        }
        onAuthChange?.(authenticated);
      } else {
        setIsAuthenticated(false);
        setUserInfo(null);
        setError('Please configure Client ID and Client Secret');
        onAuthChange?.(false);
      }
    };

    initializeAuth();

    // React instantly to credentials changes from the node inputs
    const listener = () => {
      const id = sessionStorage.getItem('gmail_temp_client_id') || '';
      const secret = sessionStorage.getItem('gmail_temp_client_secret') || '';
      const hasCreds = Boolean(id && secret);
      setCredentialsStored(hasCreds);
      // Enable sign-in button immediately by updating local error state
      if (!hasCreds) {
        setError('Please configure Client ID and Client Secret');
      } else {
        setError(null);
      }
    };
    window.addEventListener('AGEN8_GMAIL_CREDENTIALS_CHANGED', listener as any);
    return () => window.removeEventListener('AGEN8_GMAIL_CREDENTIALS_CHANGED', listener as any);
  }, [clientId, clientSecret, onAuthChange]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const handleSignIn = async () => {
    // Get credentials from props or sessionStorage
    let currentClientId = clientId || sessionStorage.getItem('gmail_temp_client_id') || '';
    let currentClientSecret = clientSecret || sessionStorage.getItem('gmail_temp_client_secret') || '';
    
    if (!currentClientId || !currentClientSecret) {
      setError('Client ID and Client Secret are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Re-initialize with current credentials to ensure they're set
      gmailAuth.initialize({ clientId: currentClientId, clientSecret: currentClientSecret });
      
      const tokens = await gmailAuth.authenticate();
      
      // Initialize Gmail API with the auth service
      gmailApi.initialize(gmailAuth);
      
      setIsAuthenticated(true);
      onAuthChange?.(true);
      
      // Try to get user info, but don't fail if it doesn't work
      try {
        const info = await gmailApi.getUserInfo();
        setUserInfo(info);
        setError(null);
      } catch (userInfoErr) {
        console.warn('Failed to get user info after auth:', userInfoErr);
        setError('Authenticated successfully, but failed to fetch user details. Gmail functions should still work.');
        setUserInfo({ email: 'Unknown', name: 'Gmail User', picture: '' });
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      setIsAuthenticated(false);
      setUserInfo(null);
      onAuthChange?.(false);
      console.error('Gmail authentication error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      
      // Call Gmail API logout with revoke access for complete sign out
      await gmailApi.logout(true);
      
      // Clear stored credentials from sessionStorage
      sessionStorage.removeItem('gmail_temp_client_id');
      sessionStorage.removeItem('gmail_temp_client_secret');
      
      // Reset component state
      setIsAuthenticated(false);
      setUserInfo(null);
      setError(null);
      setCredentialsStored(false);
      
      // Notify parent component
      onAuthChange?.(false);
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('AGEN8_GMAIL_SIGNOUT'));
      
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if logout fails, clear local state
      setIsAuthenticated(false);
      setUserInfo(null);
      setError('Signed out locally (server logout may have failed)');
      onAuthChange?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated && userInfo) {
    return (
      <div className={`w-full ${className}`}>
        <div className="space-y-2">
          {/* Connected Status Row */}
          <div className="flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Gmail Connected
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={isLoading}
              className="h-7 px-2 text-xs text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-800/50 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-green-600/30 border-t-green-600 rounded-full animate-spin mr-1" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut size={12} className="mr-1" />
                  Sign Out
                </>
              )}
            </Button>
          </div>

          {/* User Info Row */}
          <div className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {userInfo.picture ? (
                <img
                  src={userInfo.picture}
                  alt={userInfo.name}
                  className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold ${userInfo.picture ? 'hidden' : 'flex'}`}
                style={{ display: userInfo.picture ? 'none' : 'flex' }}
              >
                {userInfo.name ? userInfo.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'GM'}
              </div>
            </div>

            {/* User Details */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {userInfo.name || 'Gmail User'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {userInfo.email}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {!isAuthenticated ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              onClick={handleSignIn}
              disabled={isLoading || !(credentialsStored || (clientId && clientSecret))}
              className="flex-1 flex items-center justify-center gap-2 bg-[#ea4335] hover:bg-[#d33b2c] text-white h-11 px-4 font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Mail size={18} />
                  Sign in with Google
                </>
              )}
            </Button>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSetupInfo(!showSetupInfo)}
                  className="h-11 w-11 p-0 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
                >
                  <Info size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Setup Instructions</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {!(credentialsStored || (clientId && clientSecret)) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-sm text-amber-800 dark:text-amber-200">
                Please enter your Client ID and Client Secret above to enable authentication
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Connected as {userInfo?.email || 'Gmail User'}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              Ready to send emails
            </p>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="h-8 px-2 text-xs border-green-300 dark:border-green-600 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-green-600/30 border-t-green-600 rounded-full animate-spin mr-1" />
                Signing out...
              </>
            ) : (
              <>
                <LogOut size={12} className="mr-1" />
                Sign Out
              </>
            )}
          </Button>
        </div>
      )}

      {showSetupInfo && redirectUri && !isAuthenticated && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-blue-600 dark:text-blue-400" />
              <h4 className="font-medium text-blue-800 dark:text-blue-200">OAuth Setup Instructions</h4>
            </div>
            
            <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <p>1. Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800 dark:hover:text-blue-200">Google Cloud Console</a></p>
              <p>2. Create or select a project</p>
              <p>3. Enable the Gmail API</p>
              <p>4. Create OAuth 2.0 credentials</p>
              <p>5. Add this redirect URI to your OAuth app:</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-medium text-blue-800 dark:text-blue-200">
                Redirect URI (copy this):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={redirectUri}
                  readOnly
                  className="flex-1 px-2 py-1 text-xs font-mono bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(redirectUri)}
                  className="h-7 px-2 text-xs"
                >
                  <Copy size={12} />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <ExternalLink size={14} className="text-blue-600 dark:text-blue-400" />
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open Google Cloud Console
              </a>
            </div>
          </CardContent>
        </Card>
      )}
      
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
        </div>
      )}
      
      {!clientId || !clientSecret ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm text-yellow-800 dark:text-yellow-200">
            Please configure Client ID and Client Secret
          </span>
        </div>
      ) : null}
    </div>
  );
};