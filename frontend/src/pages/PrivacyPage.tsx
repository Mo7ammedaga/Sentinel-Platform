import React, { useEffect, useState } from 'react';
import { privacyApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { Card, Spinner, ErrorNote } from '../components/ui';

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
  if (!notice) return <Spinner />;

  const list = (title: string, items: string[]) => (
    <Card>
      <h2 className="mb-2 text-sm font-semibold text-slate-200">{title}</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </Card>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Monitoring Notice</h1>
        <p className="mt-1 text-sm text-muted">{notice.purpose}</p>
      </div>
      <Card className="border-accent/40">
        <h2 className="mb-1 text-sm font-semibold text-slate-200">How the AI is used</h2>
        <p className="text-sm text-slate-300">{notice.ai_disclaimer}</p>
      </Card>
      {list('What is collected', notice.what_is_collected)}
      {list('What is NOT collected', notice.what_is_not_collected)}
      {list('Your rights', notice.your_rights)}
      <p className="text-xs text-muted">Event data is retained for {notice.retention_days} days.</p>
    </div>
  );
}
