/**
 * Gmail API Service
 * Provides high-level functions for Gmail operations
 */

import { gmailAuth } from './gmailAuth';

export interface EmailMessage {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload?: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
    }>;
  };
  internalDate: string;
}

export interface SendEmailResult {
  messageId: string;
  threadId: string;
  status: 'sent';
}

export interface ListMessagesResult {
  messages: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

class GmailApiService {
  private readonly BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';
  private authService: any = null;

  /**
   * Initialize the Gmail API service with an auth service
   */
  initialize(authService: any): void {
    this.authService = authService;
  }

  /**
   * Send an email
   */
  async sendEmail(message: EmailMessage): Promise<SendEmailResult> {
    const authService = this.authService || gmailAuth;
    const accessToken = await authService.getAccessToken();
    
    // Get user info to set proper From header
    let fromHeader = '';
    try {
      const userInfo = await authService.getUserInfo();
      fromHeader = `From: ${userInfo.name} <${userInfo.email}>\r\n`;
      console.log(`✅ Using sender info: ${userInfo.name} <${userInfo.email}>`);
    } catch (error) {
      console.warn('⚠️ Could not get user info for From header:', error);
      // Gmail will use the authenticated user's email as fallback
    }
    
    // Build RFC 2822 email message
    let emailContent = '';
    if (fromHeader) emailContent += fromHeader;
    emailContent += `To: ${message.to}\r\n`;
    if (message.cc) emailContent += `Cc: ${message.cc}\r\n`;
    if (message.bcc) emailContent += `Bcc: ${message.bcc}\r\n`;
    emailContent += `Subject: ${message.subject}\r\n`;
    emailContent += `Content-Type: text/${message.isHtml ? 'html' : 'plain'}; charset=utf-8\r\n`;
    emailContent += `\r\n${message.body}`;

    // Base64url encode the message
    const encodedMessage = btoa(unescape(encodeURIComponent(emailContent)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch(`${this.BASE_URL}/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to send email: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return {
      messageId: result.id,
      threadId: result.threadId,
      status: 'sent'
    };
  }

  /**
   * Create a draft email
   */
  async createDraft(message: EmailMessage): Promise<{ draftId: string; messageId: string }> {
    const authService = this.authService || gmailAuth;
    const accessToken = await authService.getAccessToken();
    
    // Get user info to set proper From header
    let fromHeader = '';
    try {
      const userInfo = await authService.getUserInfo();
      fromHeader = `From: ${userInfo.name} <${userInfo.email}>\r\n`;
      console.log(`✅ Using sender info for draft: ${userInfo.name} <${userInfo.email}>`);
    } catch (error) {
      console.warn('⚠️ Could not get user info for From header in draft:', error);
      // Gmail will use the authenticated user's email as fallback
    }
    
    // Build RFC 2822 email message
    let emailContent = '';
    if (fromHeader) emailContent += fromHeader;
    emailContent += `To: ${message.to}\r\n`;
    if (message.cc) emailContent += `Cc: ${message.cc}\r\n`;
    if (message.bcc) emailContent += `Bcc: ${message.bcc}\r\n`;
    emailContent += `Subject: ${message.subject}\r\n`;
    emailContent += `Content-Type: text/${message.isHtml ? 'html' : 'plain'}; charset=utf-8\r\n`;
    emailContent += `\r\n${message.body}`;

    // Base64url encode the message
    const encodedMessage = btoa(unescape(encodeURIComponent(emailContent)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch(`${this.BASE_URL}/drafts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          raw: encodedMessage
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to create draft: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return {
      draftId: result.id,
      messageId: result.message.id
    };
  }

  /**
   * List messages from inbox
   */
  async listMessages(options: {
    maxResults?: number;
    pageToken?: string;
    query?: string;
  } = {}): Promise<ListMessagesResult> {
    const authService = this.authService || gmailAuth;
    const accessToken = await authService.getAccessToken();
    
    const params = new URLSearchParams({
      maxResults: (options.maxResults || 10).toString(),
      ...(options.pageToken && { pageToken: options.pageToken }),
      ...(options.query && { q: options.query })
    });

    const response = await fetch(`${this.BASE_URL}/messages?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to list messages: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    
    // Get full message details for each message
    const messages: GmailMessage[] = [];
    if (result.messages) {
      for (const msg of result.messages.slice(0, options.maxResults || 10)) {
        try {
          const fullMessage = await this.getMessage(msg.id);
          messages.push(fullMessage);
        } catch (error) {
          console.warn(`Failed to get message ${msg.id}:`, error);
        }
      }
    }

    return {
      messages,
      nextPageToken: result.nextPageToken,
      resultSizeEstimate: result.resultSizeEstimate || 0
    };
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(messageId: string): Promise<GmailMessage> {
    const authService = this.authService || gmailAuth;
    const accessToken = await authService.getAccessToken();
    
    const response = await fetch(`${this.BASE_URL}/messages/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get message: ${errorData.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Extract email content from Gmail message
   */
  extractEmailContent(message: GmailMessage): {
    from: string;
    to: string;
    subject: string;
    body: string;
    date: string;
  } {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    
    let body = '';
    
    // Extract body from payload
    if (message.payload?.body?.data) {
      body = this.decodeBase64Url(message.payload.body.data);
    } else if (message.payload?.parts) {
      // Look for text/plain or text/html parts
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          if (part.body?.data) {
            body = this.decodeBase64Url(part.body.data);
            break;
          }
        }
      }
    }
    
    // Fallback to snippet if no body found
    if (!body) {
      body = message.snippet;
    }

    return {
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      body,
      date: getHeader('Date')
    };
  }

  /**
   * Decode base64url encoded string
   */
  private decodeBase64Url(str: string): string {
    try {
      // Convert base64url to base64
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      const padded = base64 + '==='.slice((base64.length + 3) % 4);
      // Decode and convert to UTF-8
      return decodeURIComponent(escape(atob(padded)));
    } catch (error) {
      console.warn('Failed to decode base64url string:', error);
      return str;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const authService = this.authService || gmailAuth;
    return authService.isAuthenticated();
  }

  /**
   * Get current user info
   */
  async getUserInfo() {
    const authService = this.authService || gmailAuth;
    return authService.getUserInfo();
  }

  /**
   * Logout user and optionally revoke access
   */
  async logout(revokeAccess: boolean = false): Promise<void> {
    const authService = this.authService || gmailAuth;
    await authService.logout(revokeAccess);
  }
}

// Export singleton instance
export const gmailApi = new GmailApiService();