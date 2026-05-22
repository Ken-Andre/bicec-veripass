import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { apiClient } from '../../services/apiClient';
import { Send, MessageCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { SupportMessage } from '../../types';

export function SupportScreen() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');

  useEffect(() => {
    let active = true;
    async function loadThread() {
      try {
        const thread = await apiClient.get<{ id: string }>('/support/threads/current');
        const data = await apiClient.get<SupportMessage[]>(`/support/threads/${thread.id}/messages`);
        if (!active) return;
        setThreadId(thread.id);
        setMessages(data || []);
      } catch {
        if (active) setMessages([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadThread();
    return () => { active = false; };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !threadId) return;
    const content = input.trim();
    setInput('');
    // Optimistic
    const optimistic: SupportMessage = {
      id: 'temp_' + Date.now(),
      thread_id: threadId,
      sender: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const saved = await apiClient.post<SupportMessage, { content: string }>(`/support/threads/${threadId}/messages`, { content });
      setMessages(prev => prev.map((msg) => msg.id === optimistic.id ? saved : msg));
    } catch {
      setMessages(prev => prev.filter((msg) => msg.id !== optimistic.id));
      setInput(content);
    }
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScreenLayoutV2 showBack title={t('support.title')}>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {loading && (
            <div className="space-y-3 animate-pulse">
              {[1,2].map(i => (
                <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-end' : 'justify-start')}>
                  <div className={cn('h-12 rounded-2xl w-2/3', i % 2 === 0 ? 'bg-primary/20' : 'bg-muted')} />
                </div>
              ))}
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">{t('support.empty')}</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex', msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3',
                msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
              )}>
                <p className="text-sm">{msg.content}</p>
                <p className={cn('text-[10px] mt-1', msg.sender === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 pb-2">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('support.placeholder')}
              disabled={!threadId}
              className="flex-1 h-12 rounded-xl border border-border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
            />
            <button
              aria-label="Envoyer le message"
              onClick={handleSend}
              disabled={!input.trim() || !threadId}
              className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </ScreenLayoutV2>
  );
}
