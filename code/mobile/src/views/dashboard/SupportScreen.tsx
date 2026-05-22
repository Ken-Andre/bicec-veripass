import { useRef, useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { apiClient, fetchWithCorrelation } from '../../services/apiClient';
import { AlertCircle, FileText, Loader2, MessageCircle, Paperclip, Send, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { SupportMessage } from '../../types';

const MAX_MESSAGE_CHARS = 4000;
const IMAGE_MAX_SIZE_MB = 4;
const PDF_MAX_SIZE_MB = 6;
const PDF_MAX_PAGES = 5;
const IMAGE_MAX_SIZE_BYTES = IMAGE_MAX_SIZE_MB * 1024 * 1024;
const PDF_MAX_SIZE_BYTES = PDF_MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ACCEPTED_ATTACHMENT_LABEL = `JPG/PNG ${IMAGE_MAX_SIZE_MB} Mo max - PDF ${PDF_MAX_SIZE_MB} Mo, ${PDF_MAX_PAGES} pages max`;

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(size / 1024))} Ko`;
}

async function sha256File(file: File) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function countPdfPages(file: File) {
  const buffer = await file.arrayBuffer();
  const text = new TextDecoder('latin1').decode(buffer);
  return (text.match(/\/Type\s*\/Page\b/g) || []).length;
}

async function validateAttachment(file: File) {
  if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
    return 'Format non supporte. Utilisez JPG, PNG ou PDF.';
  }
  if ((file.type === 'image/jpeg' || file.type === 'image/png') && file.size > IMAGE_MAX_SIZE_BYTES) {
    return `Image trop volumineuse. Limite: ${IMAGE_MAX_SIZE_MB} Mo.`;
  }
  if (file.type === 'application/pdf') {
    if (file.size > PDF_MAX_SIZE_BYTES) {
      return `PDF trop volumineux. Limite: ${PDF_MAX_SIZE_MB} Mo.`;
    }
    const pageCount = await countPdfPages(file);
    if (pageCount < 1) {
      return 'PDF invalide ou sans page lisible.';
    }
    if (pageCount > PDF_MAX_PAGES) {
      return `PDF trop long. Limite: ${PDF_MAX_PAGES} pages.`;
    }
  }
  return null;
}

export function SupportScreen() {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');

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

  const handleFileChange = async (file: File | null) => {
    setError('');
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const validationError = await validateAttachment(file);
    if (validationError) {
      setSelectedFile(null);
      setError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const appendOptimisticMessage = (message: SupportMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const replaceOptimisticMessage = (tempId: string, saved: SupportMessage) => {
    setMessages((prev) => prev.map((msg) => (msg.id === tempId ? saved : msg)));
  };

  const removeOptimisticMessage = (tempId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
  };

  const sendTextMessage = async (content: string, optimistic: SupportMessage) => {
    const saved = await apiClient.post<SupportMessage, { content: string }>(
      `/support/threads/${threadId}/messages`,
      { content },
    );
    replaceOptimisticMessage(optimistic.id, saved);
  };

  const sendAttachmentMessage = async (content: string, file: File, optimistic: SupportMessage) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('content', content);
    formData.append('sha256', await sha256File(file));

    const response = await fetchWithCorrelation(`/api/v1/support/threads/${threadId}/attachments`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      let detail = 'Envoi du fichier impossible.';
      try {
        const data = await response.json();
        detail = data.detail || detail;
      } catch {
        // Keep generic message.
      }
      throw new Error(detail);
    }
    const saved = await response.json() as SupportMessage;
    replaceOptimisticMessage(optimistic.id, saved);
  };

  const handleSend = async () => {
    const content = input.trim();
    if ((!content && !selectedFile) || !threadId || sending) return;
    if (content.length > MAX_MESSAGE_CHARS) {
      setError(`Message trop long. Limite: ${MAX_MESSAGE_CHARS} caracteres.`);
      return;
    }

    const file = selectedFile;
    if (file) {
      const validationError = await validateAttachment(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSending(true);
    setError('');
    setInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const tempId = `temp_${Date.now()}`;
    const optimistic: SupportMessage = {
      id: tempId,
      thread_id: threadId,
      sender: 'user',
      content: content || `Fichier envoye: ${file?.name}`,
      attachment_filename: file?.name ?? null,
      attachment_sha256: null,
      attachment_path: file ? 'pending' : null,
      created_at: new Date().toISOString(),
    };
    appendOptimisticMessage(optimistic);

    try {
      if (file) {
        await sendAttachmentMessage(content, file, optimistic);
      } else {
        await sendTextMessage(content, optimistic);
      }
    } catch (err) {
      removeOptimisticMessage(tempId);
      setInput(content);
      setSelectedFile(file);
      setError(err instanceof Error ? err.message : 'Envoi impossible. Veuillez reessayer.');
    } finally {
      setSending(false);
    }
  };

  const remainingChars = MAX_MESSAGE_CHARS - input.length;

  return (
    <ScreenLayoutV2 showBack title={t('support.title')} contentClassName="px-4 py-0">
      <div className="flex h-[calc(100dvh-7rem)] flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {loading && (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map((i) => (
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
                'max-w-[82%] rounded-2xl px-4 py-3',
                msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
              )}>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                {(msg.attachment_filename || msg.attachment_path) && (
                  <div className={cn(
                    'mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                    msg.sender === 'user' ? 'bg-white/15 text-primary-foreground' : 'bg-background text-foreground'
                  )}>
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{msg.attachment_filename || 'Fichier joint'}</span>
                  </div>
                )}
                <p className={cn('text-[10px] mt-1', msg.sender === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-border bg-background/95 pt-3 pb-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-muted-foreground">
            <span>{ACCEPTED_ATTACHMENT_LABEL}</span>
            <span className={remainingChars < 0 ? 'text-destructive' : ''}>{input.length}/{MAX_MESSAGE_CHARS}</span>
          </div>

          {selectedFile && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{selectedFile.name}</p>
                <p className="text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
              </div>
              <button
                type="button"
                aria-label="Retirer le fichier"
        onClick={() => void handleFileChange(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              aria-label="Joindre un fichier"
              onClick={() => fileInputRef.current?.click()}
              disabled={!threadId || sending}
              className="h-12 w-12 shrink-0 rounded-xl border border-border bg-card text-muted-foreground flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              value={input}
              maxLength={MAX_MESSAGE_CHARS}
              onChange={(e) => {
                setInput(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSend()}
              placeholder={selectedFile ? 'Ajouter un message optionnel...' : t('support.placeholder')}
              disabled={!threadId || sending}
              className="min-w-0 flex-1 h-12 rounded-xl border border-border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
            />
            <button
              aria-label="Envoyer le message"
              onClick={handleSend}
              disabled={(!input.trim() && !selectedFile) || !threadId || sending || remainingChars < 0}
              className="h-12 w-12 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </ScreenLayoutV2>
  );
}
