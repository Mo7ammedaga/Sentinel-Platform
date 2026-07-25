import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { securityApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { ActivityPoint } from '../types';
import { Modal } from './Modal';
import { Badge, Spinner, ErrorNote, EmptyState } from './ui';

/** A user's 7-day activity timeline — the backend endpoint has existed since
 * Phase A but never had a frontend surface until now. */
export function UserActivityModal({ userId, userName, onClose }: {
  userId: number; userName: string; onClose: () => void;
}) {
  const [activity, setActivity] = useState<ActivityPoint[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    securityApi.userActivity(userId)
      .then(setActivity)
      .catch((e) => setError(apiError(e)));
  }, [userId]);

  return (
    <Modal open onClose={onClose} title={`Activity timeline · ${userName}`}>
      {error && <ErrorNote message={error} />}
      {!error && !activity && <Spinner label="Loading timeline…" />}
      {activity && activity.length === 0 && <EmptyState message="No activity in the last 7 days." icon={Clock} />}
      {activity && activity.length > 0 && (
        <ol className="max-h-96 space-y-0 overflow-y-auto">
          {activity.map((a, i) => (
            <li key={i} className="relative flex gap-3 pb-4 pl-1 last:pb-0">
              {i < activity.length - 1 && (
                <span className="absolute left-[7px] top-4 h-full w-px bg-surface-800" />
              )}
              <span className={`relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-surface-900 ${
                a.status === 'critical' ? 'bg-danger-500' : a.status === 'suspicious' ? 'bg-warning-500' : 'bg-surface-600'
              }`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-surface-200">{a.action.replace(/_/g, ' ')}</span>
                  <Badge status={a.status} />
                </div>
                <div className="mt-0.5 text-xs text-surface-500">
                  {new Date(a.time).toLocaleString()} · risk {a.risk.toFixed(0)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
