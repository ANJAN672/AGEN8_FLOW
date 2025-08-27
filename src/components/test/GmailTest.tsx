/**
 * Gmail Integration Test Component
 * For testing the Gmail OAuth flow and API calls
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { GmailAuthButton } from '@/components/ui/GmailAuthButton';
import { gmailApi } from '@/lib/services/gmailApi';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, FileText, List } from 'lucide-react';

// Credentials will be provided by the user via input fields

export const GmailTest: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Email form state
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    body: '',
    isHtml: false
  });

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
    if (!authenticated) {
      setResult(null);
      setError(null);
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.to || !emailForm.subject) {
      setError('To and Subject are required');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await gmailApi.sendEmail({
        to: emailForm.to,
        subject: emailForm.subject,
        body: emailForm.body,
        isHtml: emailForm.isHtml
      });
      
      setResult({
        type: 'send',
        data: result
      });
      
      // Clear form
      setEmailForm({ to: '', subject: '', body: '', isHtml: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!emailForm.to || !emailForm.subject) {
      setError('To and Subject are required');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await gmailApi.createDraft({
        to: emailForm.to,
        subject: emailForm.subject,
        body: emailForm.body,
        isHtml: emailForm.isHtml
      });
      
      setResult({
        type: 'draft',
        data: result
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  const handleListMessages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await gmailApi.listMessages({ maxResults: 5 });
      
      setResult({
        type: 'list',
        data: result
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list messages');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Gmail Integration Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Authentication</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="clientId">Google OAuth Client ID</Label>
                <Input
                  id="clientId"
                  placeholder="Paste your Google OAuth Client ID"
                  value={(emailForm as any).clientId ?? ''}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, clientId: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="clientSecret">Google OAuth Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder="Paste your Google OAuth Client Secret"
                  value={(emailForm as any).clientSecret ?? ''}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, clientSecret: e.target.value }))}
                />
              </div>
            </div>
            <GmailAuthButton
              clientId={(emailForm as any).clientId || ''}
              clientSecret={(emailForm as any).clientSecret || ''}
              onAuthChange={handleAuthChange}
            />
          </div>

          {isAuthenticated && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Send Email</h3>
                  
                  <div>
                    <Label htmlFor="to">To</Label>
                    <Input
                      id="to"
                      type="email"
                      placeholder="recipient@example.com"
                      value={emailForm.to}
                      onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="Email subject"
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="body">Body</Label>
                    <Textarea
                      id="body"
                      placeholder="Email content..."
                      rows={4}
                      value={emailForm.body}
                      onChange={(e) => setEmailForm(prev => ({ ...prev, body: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isHtml"
                      checked={emailForm.isHtml}
                      onChange={(e) => setEmailForm(prev => ({ ...prev, isHtml: e.target.checked }))}
                    />
                    <Label htmlFor="isHtml">HTML Format</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSendEmail} 
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send Email
                    </Button>
                    
                    <Button 
                      onClick={handleCreateDraft} 
                      disabled={loading}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Create Draft
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Actions</h3>
                  
                  <Button 
                    onClick={handleListMessages} 
                    disabled={loading}
                    variant="outline"
                    className="flex items-center gap-2 w-full"
                  >
                    <List className="w-4 h-4" />
                    List Recent Messages
                  </Button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              {result && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Result</h3>
                    <Badge variant="secondary">{result.type}</Badge>
                  </div>
                  <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-h-96">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};