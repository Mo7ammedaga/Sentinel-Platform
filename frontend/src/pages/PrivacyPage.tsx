import React, { useEffect, useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Scale } from 'lucide-react';
import { privacyApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { Card, ErrorNote } from '../components/ui';
import { CardSkeleton } from '../components/Skeleton';

interface Notice {
  purpose: string;
  what_is_collected: string[];
  what_is_not_collected: string[];
  ai_disclaimer: string;
  your_rights: string[];
  retention_days: number;
}

export function PrivacyPage() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    privacyApi.notice().then(setNotice).catch((e) => setError(apiError(e)));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!notice) return <div className="max-w-3xl space-y-4"><CardSkeleton rows={3} /></div>;

  const list = (title: string, items: string[], Icon: React.ElementType) => (
    <Card>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-200">
        <Icon className="h-4 w-4 text-surface-500" /> {title}
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-surface-400">
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </Card>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Monitoring Notice</h1>
        <p className="mt-1 text-sm text-surface-500">{notice.purpose}</p>
      </div>
      <Card className="border-l-4 border-l-primary-500">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-surface-200">
          <ShieldCheck className="h-4 w-4 text-primary-400" /> How the AI is used
        </h2>
        <p className="text-sm text-surface-400">{notice.ai_disclaimer}</p>
      </Card>
      {list('What is collected', notice.what_is_collected, Eye)}
      {list('What is NOT collected', notice.what_is_not_collected, EyeOff)}
      {list('Your rights', notice.your_rights, Scale)}
      <p className="text-xs text-surface-600">Event data is retained for {notice.retention_days} days.</p>
    </div>
  );
}
