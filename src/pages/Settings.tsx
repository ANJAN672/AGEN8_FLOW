import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/state/settings';

export default function Settings() {
  const { apiBaseUrl, setApiBaseUrl } = useSettings();
  const [value, setValue] = useState(apiBaseUrl);

  useEffect(() => setValue(apiBaseUrl), [apiBaseUrl]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Settings</h1>
      <Card className="p-4 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="api-base">API Base URL</Label>
          <Input
            id="api-base"
            placeholder="/api or https://your-backend.com/api"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="text-xs text-muted-foreground">Changes apply immediately across the app.</div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setApiBaseUrl(value)}>Save</Button>
          <Button variant="secondary" onClick={() => setValue('/api')}>Reset</Button>
        </div>
      </Card>
    </div>
  );
}