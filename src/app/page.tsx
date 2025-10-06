"use client";

import { useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Loader2, Plus, AlertTriangle, RefreshCw, Image as ImageIcon } from "lucide-react";
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
  usePromptInputAttachments,
  PromptInputAttachments,
  PromptInputAttachment,
} from "@/components/ai-elements/prompt-input";

// Storage key for persisting chat sessions
const STORAGE_KEY = "chat_sessions";
const CURRENT_CHAT_KEY = "current_chat_id";

// Helper to save messages to localStorage
function saveToStorage(chatId: string, messages: any[]) {
  if (typeof window === 'undefined') return;
  try {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    sessions[chatId] = {
      messages,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    localStorage.setItem(CURRENT_CHAT_KEY, chatId);
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
}

// Helper to load messages from localStorage
function loadFromStorage(chatId: string): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return sessions[chatId]?.messages || [];
  } catch (e) {
    console.error('Failed to load from storage:', e);
    return [];
  }
}

// Helper to get last active chat ID
function getLastChatId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(CURRENT_CHAT_KEY);
  } catch (e) {
    return null;
  }
}

// Small helper component to render an image add button inside the PromptInput context
function AddImageButton() {
  const { openFileDialog, files } = usePromptInputAttachments();
  return (
    <button
      type="button"
      onClick={openFileDialog}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200 border border-gray-200 dark:border-gray-600 transition"
      title="Add images"
    >
      <ImageIcon className="w-4 h-4" />
      <span className="hidden sm:inline">Image</span>
      {files.length > 0 && (
        <span className="ml-1 rounded bg-purple-500 text-white px-1 text-[10px] leading-4">{files.length}</span>
      )}
    </button>
  );
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [webSearching, setWebSearching] = useState(false);

  // Initialize chatId - restore last session or create new one
  const [chatId, setChatId] = useState<string>(() => {
    if (typeof window === 'undefined') return `chat-${Date.now()}`;
    const lastId = getLastChatId();
    return lastId || `chat-${Date.now()}`;
  });

  // Set mounted flag to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    onError: (err: any) => {
      const msg = (err?.message || '').toLowerCase();
      if (err?.status === 429 || msg.includes('rate limit')) {
        setRateLimited(true);
        setThinking(false);
      }
    },
  });

  // Load messages from storage when component mounts or chatId changes
  useEffect(() => {
    if (mounted) {
      const storedMessages = loadFromStorage(chatId);
      if (storedMessages.length > 0) {
        setMessages(storedMessages);
      }
    }
  }, [chatId, mounted, setMessages]);

  // Save messages to storage whenever they change
  useEffect(() => {
    if (mounted && messages.length > 0) {
      saveToStorage(chatId, messages);
    }
  }, [messages, chatId, mounted]);

  useEffect(() => {
    if (status !== 'streaming' && status !== 'submitted') {
      setThinking(false);
    }
  }, [status]);

  const isLoading = status === "streaming" || status === "submitted" || thinking;

  function startNewChat() {
    // Generate new unique chat ID
    const newChatId = `chat-${Date.now()}`;
    setChatId(newChatId);
    // Clear messages (will trigger save of empty array to new chatId)
    setMessages([]);
    // Reset all state
    setInput('');
    setRateLimited(false);
    setThinking(false);
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-900 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md border border-gray-300 dark:border-gray-600 flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800">AI</div>
            <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100">Assistant</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startNewChat}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
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
        <ConversationContent className="max-w-4xl w-full mx-auto px-3 pb-28">
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
                    const key = `${message.id}-${i}`;
                    // Render text parts
                    if (part.type === 'text') {
                      if (message.role === 'assistant') {
                        return (
                          <Response
                            key={key}
                            className="prose dark:prose-invert max-w-none text-sm leading-relaxed"
                          >
                            {part.text}
                          </Response>
                        );
                      }
                      return (
                        <div key={key} className="text-sm break-words whitespace-pre-wrap">
                          {part.text}
                        </div>
                      );
                    }
                    // Render image file parts
                    if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
                      return (
                        <div key={key} className="my-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={part.url}
                            alt={part.filename || 'image'}
                            className="max-h-72 rounded-md border border-gray-200 dark:border-gray-700 object-contain bg-white dark:bg-gray-900"
                            loading="lazy"
                          />
                        </div>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
      </Conversation>
      {/* Composer */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white dark:bg-gray-900 px-3 py-3">
        <div className="max-w-4xl mx-auto">
          <PromptInput
            accept="image/*"
            multiple
            onSubmit={async (message, event) => {
              event.preventDefault();
              const hasImages = (message.files?.length || 0) > 0;
              const rawText = message.text || '';
              const text = rawText.trim();
              if (!text && !hasImages) return; // nothing to send

              try {
                setThinking(true);
                // If only images, give the model a neutral instruction so it produces output
                let finalText = text || 'Please analyze the attached image(s).';

                // If web search is enabled and there's textual content, fetch context first
                if (webSearchEnabled && text) {
                  setWebSearching(true);
                  try {
                    const res = await fetch('/api/web-search', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ query: text }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      const sources = (data.results || []).slice(0, 5).map((r: any, i: number) => `${i + 1}. ${r.title} - ${r.url}`).join('\n');
                      const condensed = data.answer ? data.answer : '';
                      const contextBlock = `\n\n[Web Search Context]\n${condensed}\nSources:\n${sources}\n\nUse the web search context above when forming your answer. If the context seems irrelevant, explain why.`;
                      finalText = `${finalText}${contextBlock}`;
                    } else {
                      console.warn('Web search failed, proceeding without context');
                    }
                  } catch (e) {
                    console.warn('Web search error, continuing without context', e);
                  } finally {
                    setWebSearching(false);
                  }
                }

                const originalUserText = text || (hasImages ? '(images)' : '');
                const contextMarker = '\n\n[Web Search Context]';
                sendMessage({ text: finalText, files: message.files });
                // Immediately restore displayed user message to original text (hide injected context)
                setTimeout(() => {
                  setMessages(prev => {
                    const copy = [...prev];
                    for (let i = copy.length - 1; i >= 0; i--) {
                      const m: any = copy[i];
                      if (m.role === 'user') {
                        // Adjust text parts
                        if (Array.isArray(m.parts)) {
                          m.parts = m.parts.map((p: any) => {
                            if (p.type === 'text') {
                              const t = p.text || '';
                              const trimmed = t.includes(contextMarker) ? t.split(contextMarker)[0] : originalUserText;
                              return { ...p, text: trimmed };
                            }
                            return p;
                          });
                        }
                        break;
                      }
                    }
                    return copy;
                  });
                }, 0);
                setInput('');
              } catch (e) {
                console.error('Failed sending message', e);
                const msg = (e as any)?.message?.toLowerCase?.() || '';
                if (msg.includes('rate limit')) setRateLimited(true);
              }
            }}
            className="flex gap-3 items-end"
          >
            <div className="flex flex-col w-full bg-gray-50 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-600 rounded-xl focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-colors">
              <PromptInputAttachments>
                {(file) => <PromptInputAttachment data={file} />}
              </PromptInputAttachments>
              <div className="flex items-end pl-1 pr-2 py-2 gap-2">
                <AddImageButton />
                <button
                  type="button"
                  onClick={() => setWebSearchEnabled(v => !v)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border transition-colors select-none ${webSearchEnabled
                    ? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200'}`}
                  title="Toggle web search"
                >
                  {webSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                    <span className={`w-2 h-2 rounded-full ${webSearchEnabled ? 'bg-blue-500' : 'bg-gray-400'}`} />
                  )}
                  Web
                </button>
                <div className="flex-1">
                  <PromptInputTextarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question or drop images"
                    disabled={isLoading}
                    rows={1}
                    className="flex-1 bg-transparent border-0 focus:ring-0 resize-none text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                </div>
                <div className="flex items-center gap-2 pr-1">
                  {(isLoading || webSearching) && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  <PromptInputSubmit disabled={isLoading} className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 disabled:hover:bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors" />
                </div>
              </div>
            </div>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}