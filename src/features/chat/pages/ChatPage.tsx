  import React, { useEffect, useRef, useState } from 'react';
import { LlmMessage } from '../../../shared/types/llm';

interface Conversation {
  id: string;
  title: string;
  messages: LlmMessage[];
  systemPrompt: string;
  temperature: number;
  model: string;
  createdAt: number;
}

export default function ChatPage() {
  const [models, setModels] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [input, setInput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isMentionOpen, setIsMentionOpen] = useState<boolean>(false);
  const [mentionQuery, setMentionQuery] = useState<string>('');
  const [activeMentionIndex, setActiveMentionIndex] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const streamingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteModalCancelRef = useRef<HTMLButtonElement>(null);
  const deleteOverlayRef = useRef<HTMLDivElement>(null);
  const deleteModalCloseRef = useRef<HTMLButtonElement>(null);

  const currentConv = conversations.find(c => c.id === currentConvId);

  useEffect(() => {
    (async () => {
      const list = await (window as any).api.ollama.listModels();
      setModels(list);
      const saved = localStorage.getItem('conversations');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setConversations(parsed);
          if (parsed.length > 0) {
            setCurrentConvId(parsed[0].id);
          }
        } catch (e) {
          console.error('Failed to load conversations:', e);
        }
      }
      if (!saved || JSON.parse(saved).length === 0) {
        createNewConversation(list[0] || '');
      }
    })();
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('conversations', JSON.stringify(conversations));
      // Update File > Recent Chats in native menu (best-effort)
      try {
        const items = conversations.slice(0, 10).map(c => ({ id: c.id, title: c.title }));
        if ((window as any).api?.menu?.setRecentChats) {
          (window as any).api.menu.setRecentChats(items);
        }
      } catch {}
    }
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConv?.messages]);

  useEffect(() => {
    if (showDeleteModal) {
      requestAnimationFrame(() => deleteModalCloseRef.current?.focus());
    }
  }, [showDeleteModal]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDeleteModal) {
        setShowDeleteModal(false);
        setConversationToDelete(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showDeleteModal]);

  function createNewConversation(modelName?: string) {
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      systemPrompt: 'You are a helpful assistant.',
      temperature: 0.7,
      model: modelName || models[0] || '',
      createdAt: Date.now(),
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConvId(newConv.id);
  }

  function deleteConversation(id: string) {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (currentConvId === id && filtered.length > 0) {
        setCurrentConvId(filtered[0].id);
      } else if (filtered.length === 0) {
        createNewConversation();
      }
      return filtered;
    });
  }

  function updateConversation(id: string, updates: Partial<Conversation>) {
    setConversations(prev => 
      prev.map(c => c.id === id ? { ...c, ...updates } : c)
    );
    if (updates.model && announceRef.current) {
      announceRef.current.textContent = `Switched model to ${updates.model}`;
    }
  }

  async function generateTitle(messages: LlmMessage[]): Promise<string> {
    if (messages.length === 0) return 'New Chat';
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (!firstUserMsg) return 'New Chat';
    let title = firstUserMsg.content.trim().replace(/[?!.]+$/, '');
    if (title.length <= 40) {
      return title.charAt(0).toUpperCase() + title.slice(1);
    }
    const maxLength = 40;
    if (title.length > maxLength) {
      const truncated = title.substring(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 20) {
        title = truncated.substring(0, lastSpace) + '...';
      } else {
        title = truncated + '...';
      }
    }
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  async function pull(name: string) {
    await (window as any).api.ollama.pull(name, (s: string) => console.log('download:', s));
    const list = await (window as any).api.ollama.listModels();
    setModels(list);
  }

  async function send() {
    if (!currentConv || !input || isStreaming) return;
    const userMessage = input.trim();
    setInput('');
    const updatedMessages: LlmMessage[] = [
      ...currentConv.messages,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '' }
    ];
    updateConversation(currentConv.id, { messages: updatedMessages });
    if (currentConv.messages.length === 0) {
      const title = await generateTitle([{ role: 'user', content: userMessage }]);
      updateConversation(currentConv.id, { title });
    }
    const msgs: LlmMessage[] = [];
    if (currentConv.systemPrompt.trim()) {
      msgs.push({ role: 'system', content: currentConv.systemPrompt.trim() });
    }
    for (const m of currentConv.messages) {
      if (m.content) msgs.push(m);
    }
    msgs.push({ role: 'user', content: userMessage });
    streamingRef.current = true;
    setIsStreaming(true);
    let assistantResponse = '';
    await (window as any).api.ollama.chatStream(
      { model: currentConv.model, messages: msgs, temperature: currentConv.temperature },
      {
        onToken: (chunk: string) => {
          assistantResponse += chunk;
          setConversations(prev =>
            prev.map(c => {
              if (c.id !== currentConv.id) return c;
              const msgsCopy = c.messages.slice();
              const last = msgsCopy[msgsCopy.length - 1];
              if (last && last.role === 'assistant') {
                last.content = assistantResponse;
              }
              return { ...c, messages: msgsCopy };
            })
          );
        },
        onCompleted: () => {
          streamingRef.current = false;
          setIsStreaming(false);
          if (announceRef.current) {
            announceRef.current.textContent = `Assistant: ${assistantResponse}`;
          }
          if (inputRef.current) {
            requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
          }
        },
        onError: (error: string) => {
          streamingRef.current = false;
          setIsStreaming(false);
          setConversations(prev =>
            prev.map(c => {
              if (c.id !== currentConv.id) return c;
              const msgsCopy = c.messages.slice();
              const last = msgsCopy[msgsCopy.length - 1];
              if (last && last.role === 'assistant') {
                last.content = `Error: ${error}`;
              }
              return { ...c, messages: msgsCopy };
            })
          );
          if (announceRef.current) {
            announceRef.current.textContent = `Error: ${error}`;
          }
          if (inputRef.current) {
            requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
          }
        },
      }
    );
  }

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid rgba(99, 102, 241, 0.3)',
    background: 'rgba(15, 23, 42, 0.8)',
    color: 'white',
    fontSize: 14
  };

  const buttonStyle = {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    background: '#8b5cf6',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.2s'
  };

  const defaultModelSuggestions = [
    'llama3:latest',
    'llama3.1:8b',
    'mistral:latest',
    'mixtral:8x7b',
    'qwen2.5:7b',
    'gemma2:9b',
    'phi3:mini',
    'codellama:7b',
    'deepseek-coder:6.7b',
    'zephyr:7b',
  ];

  const mentionOptions = (models.length > 0 ? models : defaultModelSuggestions);

  const mentionMatches = mentionOptions
    .filter(m => mentionQuery ? m.toLowerCase().includes(mentionQuery.toLowerCase()) : true)
    .slice(0, 8);

  function findActiveMention(text: string, caret: number): { triggerIndex: number; query: string } | null {
    // Look back from caret to find an '@' that starts the token, stopping at whitespace
    let i = caret - 1;
    while (i >= 0 && !/\s/.test(text[i])) {
      i--;
    }
    const tokenStart = i + 1;
    if (text[tokenStart] === '@') {
      const query = text.slice(tokenStart + 1, caret);
      return { triggerIndex: tokenStart, query };
    }
    return null;
  }

  function applyMentionSelection(modelName: string) {
    if (!inputRef.current) return;
    const el = inputRef.current;
    const caret = el.selectionStart ?? input.length;
    const active = findActiveMention(input, caret);
    if (!active) return;
    const before = input.slice(0, active.triggerIndex);
    const after = input.slice(caret);
    const inserted = `@${modelName}`;
    const nextValue = `${before}${inserted}${after}`;
    setInput(nextValue);
    // Move caret to end of inserted mention
    requestAnimationFrame(() => {
      const pos = (before + inserted).length;
      el.setSelectionRange(pos, pos);
      el.focus();
    });
    setIsMentionOpen(false);
    setMentionQuery('');
    setActiveMentionIndex(0);
    if (currentConv) {
      updateConversation(currentConv.id, { model: modelName });
    }
  }

  useEffect(() => {
    const handler = () => {
      createNewConversation(models[0] || '');
    };
    window.addEventListener('app:new-chat', handler as EventListener);
    return () => {
      window.removeEventListener('app:new-chat', handler as EventListener);
    };
  }, [models]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<string>;
      const id = custom.detail;
      if (!id) return;
      const exists = conversations.find(c => c.id === id);
      if (exists) {
        setCurrentConvId(id);
      }
    };
    window.addEventListener('app:open-chat', handler as EventListener);
    return () => window.removeEventListener('app:open-chat', handler as EventListener);
  }, [conversations]);

  return (
    <div style={{ display: 'flex', height: '100%', background: '#0f172a' }} aria-label="Chat">
      <div style={{ 
        width: 260, 
        borderRight: '1px solid rgba(99, 102, 241, 0.3)', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'rgba(15, 23, 42, 0.8)'
      }}>
        <div style={{ padding: 16, borderBottom: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <button
            onClick={() => createNewConversation()}
            style={{
              ...buttonStyle,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#7c3aed';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#8b5cf6';
            }}
          >
            <span style={{ fontSize: 18 }} aria-hidden="true">+</span> New Chat
          </button>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderLeft: conv.id === currentConvId ? '3px solid #8b5cf6' : '3px solid transparent',
                background: conv.id === currentConvId ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              <button
                onClick={() => setCurrentConvId(conv.id)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: conv.id === currentConvId ? 600 : 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {conv.title} <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', fontWeight: 400 }}>({conv.messages.length} messages)</span>
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConversationToDelete(conv.id);
                  setShowDeleteModal(true);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: 16,
                  flexShrink: 0,
                }}
                aria-label="Delete conversation"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!currentConv ? (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            Select or create a conversation to start chatting
          </div>
        ) : (
          <>
            <div style={{ 
              padding: '16px 24px', 
              borderBottom: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.8)'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: 'white' }}>{currentConv.title}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <label htmlFor="header-model-select" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 13 }}>Model</label>
                  <select
                    id="header-model-select"
                    aria-label="Select model for this chat"
                    value={currentConv.model}
                    onChange={(e) => updateConversation(currentConv.id, { model: e.target.value })}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      background: '#1f2937',
                      color: 'white',
                      fontSize: 13
                    }}
                  >
                    {models.map((m) => (
                      <option key={m} value={m} style={{ background: '#1e293b', color: 'white' }}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{
                  ...buttonStyle,
                  padding: '8px 16px',
                  fontSize: 13,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#7c3aed';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#8b5cf6';
                }}
              >
                Settings
              </button>
            </div>

            {showSettings && (
              <div style={{
                padding: 16,
                background: 'rgba(30, 41, 59, 0.8)',
                borderBottom: '1px solid rgba(99, 102, 241, 0.3)',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center', maxWidth: 800 }}>
                  <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 14 }}>Model:</label>
                  <select 
                    aria-label="Model" 
                    value={currentConv.model} 
                    onChange={(e) => updateConversation(currentConv.id, { model: e.target.value })}
                    style={{ ...inputStyle, padding: '8px 12px' }}
                  >
                    {models.map((m) => (
                      <option key={m} value={m} style={{ background: '#1e293b', color: 'white' }}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 14 }}>Temperature:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      aria-label="Temperature"
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={currentConv.temperature}
                      onChange={(e) => updateConversation(currentConv.id, { temperature: Number(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: 'white', fontSize: 14, minWidth: 30 }}>{currentConv.temperature.toFixed(1)}</span>
                  </div>

                  <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 14, alignSelf: 'start', paddingTop: 8 }}>System Prompt:</label>
                  <textarea
                    aria-label="System prompt"
                    rows={3}
                    value={currentConv.systemPrompt}
                    onChange={(e) => updateConversation(currentConv.id, { systemPrompt: e.target.value })}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder="System instructions for the AI..."
                  />
                </div>
              </div>
            )}

            <div style={{ 
              flex: 1, 
              overflow: 'auto', 
              padding: 24,
              background: '#0f172a'
            }}>
              {currentConv.messages.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: 60, 
                  color: 'rgba(255, 255, 255, 0.5)' 
                }}>
                  Start a conversation by typing a message below
                </div>
              ) : (
                currentConv.messages.map((m, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      marginBottom: 24,
                      padding: '16px 20px',
                      borderRadius: 12,
                      background: m.role === 'user' 
                        ? 'rgba(139, 92, 246, 0.1)' 
                        : m.role === 'assistant'
                        ? 'rgba(96, 165, 250, 0.1)'
                        : 'rgba(148, 163, 184, 0.1)',
                      border: '1px solid ' + (
                        m.role === 'user' 
                          ? 'rgba(139, 92, 246, 0.3)' 
                          : m.role === 'assistant'
                          ? 'rgba(96, 165, 250, 0.3)'
                          : 'rgba(148, 163, 184, 0.3)'
                      ),
                    }}
                  >
                    <h3 style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: 14, 
                      fontWeight: 600,
                      color: m.role === 'user' ? '#a78bfa' : m.role === 'assistant' ? '#60a5fa' : '#94a3b8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System'}
                    </h3>
                    <div style={{ 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {m.content || (m.role === 'assistant' && isStreaming ? '...' : '')}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ 
              padding: 24, 
              borderTop: '1px solid rgba(99, 102, 241, 0.3)',
              background: 'rgba(15, 23, 42, 0.8)'
            }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  aria-label="Message"
                  aria-autocomplete="list"
                  aria-controls={isMentionOpen ? 'mention-listbox' : undefined}
                  aria-expanded={isMentionOpen}
                  value={input}
                  ref={inputRef}
                  onChange={(e) => {
                    const value = e.target.value;
                    setInput(value);
                    const caret = e.target.selectionStart ?? value.length;
                    const active = findActiveMention(value, caret);
                    if (active) {
                      setIsMentionOpen(true);
                      setMentionQuery(active.query);
                      setActiveMentionIndex(0);
                    } else {
                      setIsMentionOpen(false);
                      setMentionQuery('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === '@' || (e.shiftKey && e.key === '2')) {
                      // Open suggestions immediately on '@'
                      setIsMentionOpen(true);
                      setMentionQuery('');
                      setActiveMentionIndex(0);
                    }
                    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
                      e.preventDefault();
                      send();
                      return;
                    }
                    if (isMentionOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                      e.preventDefault();
                      const dir = e.key === 'ArrowDown' ? 1 : -1;
                      const next = (activeMentionIndex + dir + mentionMatches.length) % Math.max(mentionMatches.length, 1);
                      setActiveMentionIndex(next);
                      return;
                    }
                    if (isMentionOpen && e.key === 'Enter') {
                      if (mentionMatches[activeMentionIndex]) {
                        e.preventDefault();
                        applyMentionSelection(mentionMatches[activeMentionIndex]);
                      }
                      return;
                    }
                    if (isMentionOpen && e.key === 'Escape') {
                      e.preventDefault();
                      setIsMentionOpen(false);
                      setMentionQuery('');
                      return;
                    }
                  }}
                  style={{ ...inputStyle, flex: 1, fontSize: 15 }}
                  placeholder="Type your message..."
                  disabled={isStreaming}
                />
                <button 
                  onClick={send} 
                  disabled={!currentConv.model || !input || isStreaming}
                  style={{
                    ...buttonStyle,
                    padding: '12px 24px',
                    opacity: (!currentConv.model || !input || isStreaming) ? 0.5 : 1,
                    cursor: (!currentConv.model || !input || isStreaming) ? 'not-allowed' : 'pointer'
                  }}
                  aria-label="Send message"
                  title="Send (Enter)"
                  onMouseOver={(e) => {
                    if (currentConv.model && input && !isStreaming) {
                      e.currentTarget.style.background = '#7c3aed';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (currentConv.model && input && !isStreaming) {
                      e.currentTarget.style.background = '#8b5cf6';
                    }
                  }}
                >
                  {isStreaming ? 'Sending...' : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span>Send</span>
                      <span
                        aria-hidden="true"
                        style={{
                          fontSize: 11,
                          color: 'rgba(255, 255, 255, 0.85)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}
                      >
                        Enter
                      </span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div 
        ref={announceRef}
        className="sr-only"
        role="status"
      />

      {showDeleteModal && conversationToDelete && (
        <>
          <div
            ref={deleteOverlayRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-description"
            onClick={(e) => {
              if (e.target === deleteOverlayRef.current) {
                setShowDeleteModal(false);
                setConversationToDelete(null);
              }
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              style={{
                background: '#1e293b',
                borderRadius: 16,
                maxWidth: 500,
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                position: 'relative',
              }}
            >
              <button
                ref={deleteModalCloseRef}
                onClick={() => {
                  setShowDeleteModal(false);
                  setConversationToDelete(null);
                }}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: 28,
                  cursor: 'pointer',
                  padding: '0 8px',
                  lineHeight: 1,
                }}
                aria-label="Close dialog"
              >
                ×
              </button>
              <div style={{
                padding: '24px 24px 16px 24px',
                borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
              }}>
                <h2
                  id="delete-modal-title"
                  style={{
                    color: 'white',
                    fontSize: 24,
                    margin: 0,
                  }}
                >
                  Delete Conversation
                </h2>
              </div>

              <div id="delete-modal-description" style={{ padding: 24 }}>
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, margin: 0, marginBottom: 24 }}>
                  Are you sure you want to delete this conversation? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    ref={deleteModalCancelRef}
                    onClick={() => {
                      setShowDeleteModal(false);
                      setConversationToDelete(null);
                    }}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      border: '1px solid rgba(99, 102, 241, 0.5)',
                      background: 'transparent',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      deleteConversation(conversationToDelete);
                      setShowDeleteModal(false);
                      setConversationToDelete(null);
                    }}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#dc2626',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#b91c1c';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#dc2626';
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {isMentionOpen && mentionMatches.length > 0 && (
                <div
                  id="mention-listbox"
                  role="listbox"
                  aria-label="Model suggestions"
                  aria-activedescendant={`mention-option-${activeMentionIndex}`}
                  style={{
                    marginTop: 8,
                    maxHeight: 240,
                    overflowY: 'auto',
                    background: '#0b1220',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                  }}
                >
                  {mentionMatches.map((m, idx) => (
                    <div
                      key={m}
                      id={`mention-option-${idx}`}
                      role="option"
                      aria-selected={idx === activeMentionIndex}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyMentionSelection(m);
                      }}
                      onMouseEnter={() => setActiveMentionIndex(idx)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: idx === activeMentionIndex ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                        color: 'white',
                        borderBottom: '1px solid rgba(99, 102, 241, 0.1)'
                      }}
                    >
                      @{m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


