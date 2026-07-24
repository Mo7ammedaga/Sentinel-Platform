import React, { useCallback, useEffect, useState } from 'react';
import { chatApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DirectoryUser, Message } from '../types';
import { Card, Spinner, ErrorNote } from '../components/ui';

export function ChatPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [active, setActive] = useState<DirectoryUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    chatApi.directory()
      .then(setPeople)
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const loadConversation = useCallback(async (u: DirectoryUser) => {
    setActive(u);
    try {
      const msgs = await chatApi.conversation(u.id);
      setMessages(msgs);
      // Mark messages they sent me as read.
      await Promise.all(
        msgs.filter((m) => m.recipient_id === user?.id && !m.is_read)
          .map((m) => chatApi.markRead(m.id))
      );
    } catch (e) {
      setError(apiError(e));
    }
  }, [user?.id]);

  const send = async () => {
    if (!text.trim() || !active) return;
    try {
      await chatApi.send(active.id, text.trim());
      setText('');
      setMessages(await chatApi.conversation(active.id));
    } catch (e) {
      setError(apiError(e));
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Team Chat</h1>
        <p className="text-sm text-muted">Direct messages with colleagues. Sending and reading are recorded as events.</p>
      </div>
      {error && <ErrorNote message={error} />}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Colleagues</h2>
          <ul className="space-y-1">
            {people.map((p) => (
              <li key={p.id}>
                <button onClick={() => loadConversation(p)}
                        className={`w-full rounded px-2 py-1.5 text-left text-sm ${active?.id === p.id ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/50'}`}>
                  {p.name} <span className="text-xs text-muted">· {p.role}</span>
                </button>
              </li>
            ))}
            {people.length === 0 && <li className="text-sm text-muted">No colleagues yet.</li>}
          </ul>
        </Card>

        <Card className="flex min-h-[24rem] flex-col">
          {!active ? (
            <p className="text-sm text-muted">Select a colleague to start chatting.</p>
          ) : (
            <>
              <div className="mb-2 text-sm font-semibold text-slate-200">{active.name}</div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-1.5 text-sm ${mine ? 'bg-accent text-white' : 'bg-slate-800 text-slate-200'}`}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && <p className="text-sm text-muted">No messages yet — say hello.</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && send()}
                       placeholder="Type a message…"
                       className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent" />
                <button onClick={send}
                        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white">Send</button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
