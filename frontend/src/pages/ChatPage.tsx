import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Check, CheckCheck, Smile } from 'lucide-react';
import { chatApi } from '../api/endpoints';
import { apiError, API_BASE } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DirectoryUser, Message } from '../types';
import { Card, Avatar, EmptyState } from '../components/ui';
import { CardSkeleton } from '../components/Skeleton';

const EMOJIS = ['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '👀', '✅', '❤️', '😅', '🤔', '🚀', '💯', '👏', '😢'];

function avatarUrl(userId: number) {
  return `${API_BASE}/api/v1/auth/avatar/${userId}`;
}

function TypingDots({ className = 'bg-surface-500' }: { className?: string }) {
  return (
    <span className="flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-1 w-1 animate-typingDot rounded-full ${className}`} style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

export function ChatPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [active, setActive] = useState<DirectoryUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatApi.directory()
      .then(setPeople)
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, text]);

  const loadConversation = useCallback(async (u: DirectoryUser) => {
    setActive(u);
    setShowEmoji(false);
    try {
      const msgs = await chatApi.conversation(u.id);
      setMessages([...msgs].reverse()); // API returns newest-first; a thread reads oldest→newest
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

  if (loading) return <div className="grid gap-4 lg:grid-cols-[260px_1fr]"><CardSkeleton /><CardSkeleton rows={5} /></div>;

  return (
    <div className="flex flex-col space-y-4 lg:h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-xl font-semibold text-white">Team Chat</h1>
        <p className="text-sm text-surface-500">Direct messages with colleagues. Sending and reading are recorded as events.</p>
      </div>
      {error && <p className="text-sm text-danger-400">{error}</p>}

      {/* Below lg the two panels stack — each needs its own bounded height
          so internal scrolling still works without a fixed-height parent. */}
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[260px_1fr]">
        <Card className="flex h-64 flex-col overflow-hidden !p-0 lg:h-auto">
          <h2 className="border-b border-surface-800 px-4 py-3 text-sm font-semibold text-surface-200">Colleagues</h2>
          {people.length === 0 ? (
            <EmptyState message="No colleagues yet." />
          ) : (
            <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
              {people.map((p) => (
                <li key={p.id}>
                  <button onClick={() => loadConversation(p)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${active?.id === p.id ? 'bg-primary-500/10' : 'hover:bg-surface-800/60'}`}>
                    <span className="relative">
                      <Avatar name={p.name} avatarUrl={avatarUrl(p.id)} size="sm" />
                      {/* Presence dot is cosmetic — no real presence-tracking backend exists. */}
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-900 bg-success-500" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${active?.id === p.id ? 'text-primary-300' : 'text-surface-300'}`}>{p.name}</span>
                      <span className="block truncate text-xs capitalize text-surface-600">{p.role}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex h-[28rem] min-h-0 flex-col !p-0 lg:h-auto">
          {!active ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-surface-500">Select a colleague to start chatting.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 border-b border-surface-800 px-4 py-3">
                <Avatar name={active.name} avatarUrl={avatarUrl(active.id)} />
                <div>
                  <div className="text-sm font-semibold text-surface-100">{active.name}</div>
                  <div className="text-xs capitalize text-surface-500">{active.role} · online</div>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {messages.length === 0 && <p className="text-sm text-surface-500">No messages yet — say hello.</p>}
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex animate-slideUp ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'rounded-br-sm bg-primary-600 text-white' : 'rounded-bl-sm bg-surface-800 text-surface-200'}`}>
                        <div>{m.content}</div>
                        <div className={`mt-0.5 flex items-center gap-1 text-[10px] ${mine ? 'justify-end text-white/70' : 'text-surface-500'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {mine && (m.is_read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Composing preview — reflects your own draft, not a real peer
                    signal (no chat presence channel exists on the backend). */}
                {text.trim().length > 0 && (
                  <div className="flex animate-fadeIn justify-end">
                    <div className="rounded-2xl rounded-br-sm bg-primary-600/40 px-3.5 py-2">
                      <TypingDots className="bg-white/80" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="relative border-t border-surface-800 p-3">
                {showEmoji && (
                  <div className="absolute bottom-full left-3 mb-2 grid grid-cols-8 gap-1 rounded-lg border border-surface-700 bg-surface-800 p-2 shadow-elevated">
                    {EMOJIS.map((e) => (
                      <button key={e} onClick={() => { setText((t) => t + e); setShowEmoji(false); }}
                              aria-label={`Insert ${e}`}
                              className="rounded p-1 text-lg hover:bg-surface-700">
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEmoji((v) => !v)} aria-label="Emoji picker"
                          className="shrink-0 rounded-lg p-2 text-surface-500 hover:bg-surface-800 hover:text-surface-300">
                    <Smile className="h-4 w-4" />
                  </button>
                  <label htmlFor="chat-message-input" className="sr-only">Message</label>
                  <input
                    id="chat-message-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder="Type a message…"
                    className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-100 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/40"
                  />
                  <button onClick={send} disabled={!text.trim()} aria-label="Send message"
                          className="shrink-0 rounded-lg bg-primary-600 p-2 text-white transition-colors hover:bg-primary-500 disabled:opacity-40">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
