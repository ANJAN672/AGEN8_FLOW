/**
 * Gmail OAuth Callback Page
 * Handles the OAuth callback and sends the authorization code to the parent window
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const GmailOAuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (error) {
          setStatus('error');
          setMessage(errorDescription || error || 'Authentication failed');
          
          // Send error to parent window
          if (window.opener) {
            window.opener.postMessage({
              type: 'GMAIL_OAUTH_ERROR',
              error: errorDescription || error || 'Authentication failed'
            }, window.location.origin);
          }
          
          // Close window after a delay
          setTimeout(() => {
            window.close();
          }, 3000);
          
          return;
        }

        if (code) {
          setStatus('success');
          setMessage('Authentication successful! Closing window...');
          
          // Send success message to parent window
          if (window.opener) {
            window.opener.postMessage({
              type: 'GMAIL_OAUTH_SUCCESS',
              code: code
            }, window.location.origin);
          }
          
          // Close window after a short delay
          setTimeout(() => {
            window.close();
          }, 1500);
          
          return;
        }

        // No code or error found
        setStatus('error');
        setMessage('Invalid callback - no authorization code received');
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'GMAIL_OAUTH_ERROR',
            error: 'Invalid callback - no authorization code received'
          }, window.location.origin);
        }
        
        setTimeout(() => {
          window.close();
        }, 3000);
        
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setMessage('Failed to process authentication callback');
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'GMAIL_OAUTH_ERROR',
            error: 'Failed to process authentication callback'
          }, window.location.origin);
        }
        
        setTimeout(() => {
          window.close();
        }, 3000);
      }
    };

    // Process callback immediately
    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center space-y-4">
            {status === 'processing' && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Processing Authentication
                </h2>
              </>
            )}
            
            {status === 'success' && (
              <>
                <CheckCircle className="h-8 w-8 text-green-600" />
                <h2 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  Authentication Successful
                </h2>
              </>
            )}
            
            {status === 'error' && (
              <>
                <AlertCircle className="h-8 w-8 text-red-600" />
                <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
                  Authentication Failed
                </h2>
              </>
            )}
            
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {message}
            </p>
            
            {status === 'error' && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                This window will close automatically in a few seconds.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GmailOAuthCallback;