import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { mockSupport } from '../../services/mockData';
import { Send } from 'lucide-react';
import { cn } from '../../lib/utils';

export function SupportScreen() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState(mockSupport.messages);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg = {
      id: 'm_' + Date.now(),
      thread_id: 't1',
      sender: 'user' as const,
      content: input.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages([...messages, newMsg]);
    setInput('');
    // Mock agent response after 2s
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: 'm_' + Date.now(),
        thread_id: 't1',
        sender: 'agent' as const,
        content: 'Merci pour votre message. Un agent vous répondra dans les plus brefs délais.',
        created_at: new Date().toISOString(),
      }]);
    }, 2000);
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScreenLayout showBack title={t('support.title')}>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex', msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3',
                msg.sender === 'user' ? 'bg-primary text-white rounded-br-md' : 'bg-slate-100 text-slate-800 rounded-bl-md'
              )}>
                <p className="text-sm">{msg.content}</p>
                <p className={cn('text-[10px] mt-1', msg.sender === 'user' ? 'text-white/60' : 'text-slate-400')}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3 pb-2">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('support.placeholder')}
              className="flex-1 h-12 rounded-xl border border-slate-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="h-12 w-12 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
}
