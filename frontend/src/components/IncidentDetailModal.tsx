import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, Wrench, ArrowUpRight, Paperclip, StickyNote, Activity,
  Download, Upload, ArrowUpCircle,
} from 'lucide-react';
import { securityApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { useToast } from './Toast';
import { AdminSummary, IncidentAction, IncidentActionType, IncidentDetail, IncidentSeverity } from '../types';
import { Modal } from './Modal';
import { Button } from './Button';
import { Select, Textarea, Input } from './Field';
import { Avatar, Badge, ErrorNote, Spinner } from './ui';
import { formatBytes } from '../utils/format';

const ACTION_ICONS: Record<IncidentActionType, React.ElementType> = {
  containment: ShieldCheck,
  remediation: Wrench,
  escalation: ArrowUpRight,
  evidence: Paperclip,
  note: StickyNote,
  status_change: Activity,
};

const RESPONSE_STATES = ['confirmed', 'containing', 'resolved'];
const READ_ONLY_STATES = ['closed', 'false_positive'];

export function IncidentDetailModal({ investigationId, onClose, onChanged }: {
  investigationId: number; onClose: () => void; onChanged: () => void;
}) {
  const { show } = useToast();
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [admins, setAdmins] = useState<AdminSummary[]>([]);
  const [error, setError] = useState('');

  const [resolutionSummary, setResolutionSummary] = useState('');
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateTo, setEscalateTo] = useState<number | ''>('');
  const [escalateNote, setEscalateNote] = useState('');
  const [newActionType, setNewActionType] = useState<'containment' | 'remediation' | 'note'>('containment');
  const [newActionDesc, setNewActionDesc] = useState('');
  const [newEvidenceFile, setNewEvidenceFile] = useState<File | null>(null);
  const [newEvidenceDesc, setNewEvidenceDesc] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const d = await securityApi.investigation(investigationId);
      setDetail(d);
      setResolutionSummary(d.resolution_summary || '');
    } catch (e) { setError(apiError(e)); }
  };
  useEffect(() => {
    load();
    securityApi.admins().then(setAdmins).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investigationId]);

  const readOnly = !!detail && READ_ONLY_STATES.includes(detail.state);

  const run = async (key: string, fn: () => Promise<unknown>, successMsg?: string) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await load();
      onChanged();
      if (successMsg) show(successMsg, 'success');
      return true;
    } catch (e) {
      setError(apiError(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const changeSeverity = (severity: IncidentSeverity) =>
    run('severity', () => securityApi.setSeverity(investigationId, severity));

  const submitEscalate = async () => {
    if (!escalateTo) return;
    const ok = await run('escalate',
      () => securityApi.escalate(investigationId, Number(escalateTo), escalateNote || undefined),
      'Incident escalated.');
    // Only clear the form on success — on failure the analyst's selection
    // and note must survive so they can retry without redoing it.
    if (ok) { setEscalateOpen(false); setEscalateNote(''); setEscalateTo(''); }
  };

  const transition = (state: string) =>
    run('transition', () => securityApi.updateInvestigation(
      investigationId, state, undefined, state === 'closed' ? resolutionSummary : undefined),
      `Marked ${state.replace('_', ' ')}.`);

  const addAction = async () => {
    if (!newActionDesc.trim()) return;
    const ok = await run('action', () => securityApi.addAction(investigationId, newActionType, newActionDesc.trim()));
    if (ok) setNewActionDesc('');
  };

  const uploadEvidence = async () => {
    if (!newEvidenceFile) return;
    const ok = await run('evidence',
      () => securityApi.uploadEvidence(investigationId, newEvidenceFile, newEvidenceDesc || undefined),
      'Evidence attached.');
    if (ok) { setNewEvidenceFile(null); setNewEvidenceDesc(''); }
  };

  const downloadEvidence = async (id: number, filename: string) => {
    try { await securityApi.downloadEvidence(id, filename); } catch (e) { setError(apiError(e)); }
  };

  if (!detail) {
    return (
      <Modal open onClose={onClose} title="Incident" size="lg">
        {error ? <ErrorNote message={error} /> : <Spinner label="Loading incident…" />}
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} size="lg"
           title={`Incident #${detail.id}${detail.alert ? ` · ${detail.alert.title}` : ''}`}>
      <div className="space-y-5">
        {error && <ErrorNote message={error} />}

        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-surface-800 bg-surface-800/30 p-3">
          <div className="flex items-center gap-3">
            {detail.subject_user && <Avatar name={detail.subject_user.name} size="md" />}
            <div>
              <div className="text-sm font-medium text-surface-100">
                {detail.subject_user?.name || 'Unknown user'}
              </div>
              <div className="text-xs text-surface-500">{detail.subject_user?.email}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={detail.state} />
            {detail.severity && <Badge status={detail.severity} />}
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-surface-400">Severity</label>
            <Select
              value={detail.severity || ''}
              disabled={busy === 'severity'}
              onChange={(e) => changeSeverity(e.target.value as IncidentSeverity)}
              className="w-36 py-1.5 text-xs"
            >
              <option value="" disabled>Set severity…</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
        )}

        <div className="rounded-lg border border-surface-800 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-surface-500">Escalation</span>
          </div>
          {detail.escalated_to ? (
            <div className="flex items-center gap-2 text-sm text-surface-300">
              <ArrowUpCircle className="h-4 w-4 text-primary-400" />
              Escalated to <span className="font-medium text-surface-100">{detail.escalated_to.name}</span>
              {detail.escalation_note && <span className="text-surface-500">— {detail.escalation_note}</span>}
            </div>
          ) : readOnly ? (
            <p className="text-xs text-surface-600">Not escalated.</p>
          ) : admins.length === 0 ? (
            <p className="text-xs text-surface-600">
              No other administrators in this organization to escalate to.
            </p>
          ) : escalateOpen ? (
            <div className="space-y-2">
              <Select value={escalateTo} onChange={(e) => setEscalateTo(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Select an administrator…</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
              </Select>
              <Textarea rows={2} placeholder="Note for the administrator (optional)…"
                        value={escalateNote} onChange={(e) => setEscalateNote(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" loading={busy === 'escalate'} disabled={!escalateTo} onClick={submitEscalate}>
                  Escalate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEscalateOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="secondary" icon={<ArrowUpCircle className="h-3.5 w-3.5" />}
                    onClick={() => setEscalateOpen(true)}>
              Escalate to administrator
            </Button>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-surface-500">Response timeline</span>
            <span className="text-xs text-surface-600">{detail.actions.length}</span>
          </div>
          {!readOnly && (
            <div className="mb-2 flex flex-col gap-2 sm:flex-row">
              <Select value={newActionType} onChange={(e) => setNewActionType(e.target.value as typeof newActionType)}
                      className="w-full py-1.5 text-xs sm:w-40">
                <option value="containment">Containment</option>
                <option value="remediation">Remediation</option>
                <option value="note">Note</option>
              </Select>
              <Input
                value={newActionDesc}
                onChange={(e) => setNewActionDesc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAction()}
                placeholder="Describe the action taken…"
                className="py-1.5 text-xs"
              />
              <Button size="sm" loading={busy === 'action'} disabled={!newActionDesc.trim()} onClick={addAction}>
                Log
              </Button>
            </div>
          )}
          {detail.actions.length === 0 ? (
            <p className="text-xs text-surface-600">No actions logged yet.</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {detail.actions.map((a: IncidentAction) => {
                const Icon = ACTION_ICONS[a.action_type] || Activity;
                return (
                  <li key={a.id} className="flex items-start gap-2.5 rounded-lg bg-surface-800/50 px-3 py-2 text-sm">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-surface-500" />
                    <div className="min-w-0">
                      <p className="text-surface-300">{a.description}</p>
                      <p className="mt-0.5 text-xs text-surface-600">
                        {a.actor_name || 'Unknown'} · {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-surface-500">Evidence</span>
            <span className="text-xs text-surface-600">{detail.evidence.length}</span>
          </div>
          {!readOnly && (
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input type="file" onChange={(e) => setNewEvidenceFile(e.target.files?.[0] ?? null)}
                     className="w-full text-xs text-surface-400 file:mr-2 file:rounded-md file:border-0 file:bg-surface-700 file:px-2.5 file:py-1.5 file:text-xs file:text-surface-200" />
              <Input value={newEvidenceDesc} onChange={(e) => setNewEvidenceDesc(e.target.value)}
                     placeholder="Caption (optional)"
                     className="py-1.5 text-xs sm:w-40" />
              <Button size="sm" loading={busy === 'evidence'} disabled={!newEvidenceFile} onClick={uploadEvidence}
                      icon={<Upload className="h-3 w-3" />}>
                Attach
              </Button>
            </div>
          )}
          {detail.evidence.length === 0 ? (
            <p className="text-xs text-surface-600">No evidence attached.</p>
          ) : (
            <ul className="space-y-1.5">
              {detail.evidence.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-800/50 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-surface-300">
                    {ev.filename}{' '}
                    {ev.size_bytes != null && <span className="text-xs text-surface-600">({formatBytes(ev.size_bytes)})</span>}
                    {ev.description && <span className="text-xs text-surface-600"> — {ev.description}</span>}
                  </span>
                  <button onClick={() => downloadEvidence(ev.id, ev.filename)}
                          aria-label={`Download ${ev.filename}`}
                          className="shrink-0 rounded p-1.5 text-surface-500 hover:bg-surface-700 hover:text-surface-200">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-surface-800 p-3">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-surface-500">
            Resolution summary
          </span>
          {readOnly ? (
            <p className="text-sm text-surface-300">
              {detail.resolution_summary || 'No summary recorded.'}
            </p>
          ) : (
            <Textarea rows={3} placeholder="What was done, and why the case is being closed…"
                      value={resolutionSummary} onChange={(e) => setResolutionSummary(e.target.value)} />
          )}
        </div>

        {!readOnly && RESPONSE_STATES.includes(detail.state) && (
          <div className="flex flex-wrap gap-2 border-t border-surface-800 pt-4">
            {detail.state === 'confirmed' && (
              <Button size="sm" variant="secondary" loading={busy === 'transition'}
                      onClick={() => transition('containing')}>
                Start containment
              </Button>
            )}
            {detail.state !== 'resolved' && (
              <Button size="sm" variant="secondary" loading={busy === 'transition'}
                      onClick={() => transition('resolved')}>
                Mark resolved
              </Button>
            )}
            <Button size="sm" variant="primary" loading={busy === 'transition'}
                    disabled={!resolutionSummary.trim()}
                    onClick={() => transition('closed')}>
              Close &amp; archive
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
