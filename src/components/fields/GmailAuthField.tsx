/**
 * Gmail Authentication Field Component
 * Custom field that shows Gmail auth status and provides sign-in functionality
 */

import React, { useState, useEffect } from 'react';
import { GmailAuthButton } from '@/components/ui/GmailAuthButton';
import { Label } from '@/components/ui/label';

interface GmailAuthFieldProps {
  id: string;
  title: string;
  clientId: string;
  clientSecret: string;
  onChange?: (authenticated: boolean) => void;
}

export const GmailAuthField: React.FC<GmailAuthFieldProps> = ({
  id,
  title,
  clientId,
  clientSecret,
  onChange
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
    onChange?.(authenticated);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {title}
      </Label>
      <GmailAuthButton
        clientId={clientId}
        clientSecret={clientSecret}
        onAuthChange={handleAuthChange}
        className="w-full"
      />
    </div>
  );
};