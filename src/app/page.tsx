"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Paperclip, Trash2, Loader2, Plus, AlertTriangle, RefreshCw } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [prepUploading, setPrepUploading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [chatId, setChatId] = useState<string>(() => Date.now().toString());
  const [thinking, setThinking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, sendMessage, status } = useChat({
    id: chatId,
    onError: (err: any) => {
      const msg = (err?.message || '').toLowerCase();
      if (err?.status === 429 || msg.includes('rate limit')) {
        setRateLimited(true);
        setThinking(false);
      }
    },
  });

  useEffect(() => {
    if (status !== 'streaming' && status !== 'submitted') {
      setThinking(false);
    }
  }, [status]);

  const isLoading = status === "streaming" || status === "submitted" || prepUploading || thinking;

  // ---- Attachment Helpers (purely front-end; message still sent as text) ----
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });

  async function resizeImageFile(file: File, maxDimension = 640): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const dataUrl = canvas.toDataURL(file.type || 'image/png', 0.85);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function buildAttachmentSection(files: File[]): Promise<string> {
    if (!files.length) return '';
    const lines: string[] = [];
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        try {
          const resized = await resizeImageFile(f, 640);
          lines.push(`![${f.name}](${resized})`);
        } catch {
          lines.push(`(Failed to embed image ${f.name})`);
        }
      } else if (/^(text|application\/(json|xml))/i.test(f.type) || /\.(txt|json|csv|md|xml|log)$/i.test(f.name)) {
        try {
          const text = await f.text();
          const snippet = text.slice(0, 800);
          lines.push(`**File: ${f.name} (${formatFileSize(f.size)}) snippet:**`);
          lines.push('```');
          lines.push(snippet);
          if (text.length > 800) lines.push('... (truncated)');
          lines.push('```');
        } catch {
          lines.push(`(Could not read file ${f.name})`);
        }
      } else {
        lines.push(`(File ${f.name} ${formatFileSize(f.size)} omitted binary content)`);
      }
    }
    return '\n\n' + lines.join('\n');
  }

  // Basic markdown image renderer for assistant/user text parts containing data URLs
  function renderTextWithImages(text: string) {
    const imageRegex = /!\[[^\]]*\]\((data:image\/[a-zA-Z0-9.+-]+;base64,[^)]+)\)/g;
    const parts: (string | { img: string })[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = imageRegex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      parts.push({ img: match[1] });
      lastIndex = imageRegex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts.map((p, i) => {
      if (typeof p === 'string') return <span key={i}>{p}</span>;
      return (
        <img
          key={i}
          src={p.img}
          alt="embedded"
          className="inline-block max-h-56 rounded-md border border-gray-200 dark:border-gray-700 object-cover mr-2 my-2"
        />
      );
    });
  }

  function startNewChat() {
    setAttachedFiles([]);
    setInput('');
    setRateLimited(false);
    setThinking(false);
    setChatId(Date.now().toString());
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="border-b bg-white/80 dark:bg-gray-900/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">AI</div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Support Assistant</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Chat session #{chatId.slice(-4)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startNewChat}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <Plus className="w-3.5 h-3.5" /> New Chat
            </button>
            {isLoading && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>
        </div>
        {rateLimited && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border-t border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Rate limit reached. Start a new chat or wait a moment before retrying.</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={startNewChat}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-600 text-white text-[11px] font-medium hover:bg-amber-700"
              >
                <RefreshCw className="w-3 h-3" /> New Chat
              </button>
              <button
                onClick={() => setRateLimited(false)}
                className="text-amber-700 dark:text-amber-300 hover:underline"
              >Dismiss</button>
            </div>
          </div>
        )}
      </div>
      <Conversation>
        <ConversationContent className="max-w-4xl w-full mx-auto px-4 pb-32">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Type a message below to begin"
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts?.map((part, i) => {
                    if (part.type !== 'text') return null;
                    const key = `${message.id}-${i}`;
                    if (message.role === 'assistant') {
                      // Use Response for markdown / rich content
                      return (
                        <Response
                          key={key}
                          className="prose dark:prose-invert max-w-none text-sm leading-relaxed"
                        >
                          {part.text}
                        </Response>
                      );
                    }
                    // User message: inline images + text (no markdown parsing overhead beyond custom images)
                    return (
                      <div key={key} className="text-sm break-words">
                        {renderTextWithImages(part.text)}
                      </div>
                    );
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
      </Conversation>
      {/* Composer */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/90 dark:bg-gray-900/90 backdrop-blur px-4 py-4">
        <div className="max-w-4xl mx-auto">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachedFiles.map((f, idx) => (
                <div key={idx} className="group flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg pl-2 pr-1 py-1 text-xs shadow-sm">
                  <span className="truncate max-w-[140px]" title={`${f.name} (${formatFileSize(f.size)})`}>{f.type.startsWith('image/') ? '🖼️' : '📎'} {f.name}</span>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900 transition"
                    aria-label="Remove attachment"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <PromptInput
            onSubmit={async (message, event) => {
              event.preventDefault();
              if (!message.text && attachedFiles.length === 0) return;

              setPrepUploading(true);
              try {
                let composedText = message.text || '';
                if (attachedFiles.length > 0) {
                  // Reuse markdown embedding (resized images + file snippets)
                  const attachmentBlock = await buildAttachmentSection(attachedFiles);
                  composedText = composedText + attachmentBlock;
                }
                if (composedText.trim()) {
                  setThinking(true);
                  sendMessage({ text: composedText }); // Only 'text' field as expected by hook
                }
                setInput('');
                setAttachedFiles([]);
              } catch (e) {
                console.error('Failed preparing attachments', e);
                const msg = (e as any)?.message?.toLowerCase?.() || '';
                if (msg.includes('rate limit')) setRateLimited(true);
              } finally {
                setPrepUploading(false);
              }
            }}

            className="flex gap-3 items-end"
          >
            <div className="flex items-end w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl shadow-sm focus-within:shadow-md transition-shadow px-2 py-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition"
                title="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask something... Attach images or text files."
                disabled={isLoading}
                rows={1}
                className="flex-1 bg-transparent border-0 focus:ring-0 resize-none text-sm"
              />
              <div className="flex items-center gap-2 pr-1">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                <PromptInputSubmit disabled={isLoading} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
            </div>
          </PromptInput>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".txt,.md,.json,.csv,.xml,image/*,.log"
        />
      </div>
    </div>
  );
}
