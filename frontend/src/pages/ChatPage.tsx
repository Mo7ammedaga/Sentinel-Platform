import React, { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DirectoryUser, Message } from '../types';
import { Card, Spinner, ErrorNote, EmptyState, Avatar } from '../components/ui';

export function ChatPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [active, setActive] = useState<DirectoryUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatApi.directory()
      .then(setPeople)
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // The API returns newest-first (for pagination); a chat thread reads
  // oldest-to-newest, so reverse before rendering.
  const loadConversation = useCallback(async (u: DirectoryUser) => {
    setActive(u);
    try {
      const msgs = await chatApi.conversation(u.id);
      setMessages([...msgs].reverse());
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
      setMessages([...(await chatApi.conversation(active.id))].reverse());
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

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Colleagues</h2>
          {people.length === 0 ? (
            <EmptyState message="No colleagues yet." />
          ) : (
            <ul className="space-y-1">
              {people.map((p) => (
                <li key={p.id}>
                  <button onClick={() => loadConversation(p)}
                          className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm transition ${active?.id === p.id ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/50'}`}>
                    <Avatar name={p.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{p.name}</span>
                      <span className="block truncate text-xs capitalize text-muted">{p.role}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex min-h-[26rem] flex-col">
          {!active ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted">Select a colleague to start chatting.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Avatar name={active.name} />
                <div>
                  <div className="text-sm font-semibold text-slate-100">{active.name}</div>
                  <div className="text-xs capitalize text-muted">{active.role}</div>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {messages.length === 0 && <p className="text-sm text-muted">No messages yet — say hello.</p>}
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-1.5 text-sm ${mine ? 'bg-accent text-white' : 'bg-slate-800 text-slate-200'}`}>
                        <div>{m.content}</div>
                        <div className={`mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-slate-500'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="mt-3 flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && send()}
                       placeholder="Type a message…"
                       className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent" />
                <button onClick={send}
                        className="shrink-0 rounded bg-accent px-4 py-2 text-sm font-medium text-white">Send</button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
