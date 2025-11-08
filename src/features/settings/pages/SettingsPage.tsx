import React, { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState('');
  const resetButtonRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (async () => setSettings(await window.api.settings.get()))();
    const off = window.api.settings.onChanged((s: any) => setSettings(s));
    return () => off && off();
  }, []);

  useEffect(() => {
    if (showResetModal) {
      resetButtonRef.current?.focus();
    }
  }, [showResetModal]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showResetModal) {
        setShowResetModal(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showResetModal]);

  if (!settings) return <div style={{ padding: 24, color: 'white' }}>Loading…</div>;

  async function save(partial: any) {
    await window.api.settings.update(partial);
  }

  async function handleResetEverything() {
    setResetting(true);
    setResetStatus('Starting reset...');
    
    try {
      if (!window.api.ollama.resetEverything) {
        throw new Error('Reset functionality not available. Please restart the app.');
      }
      
      const result = await window.api.ollama.resetEverything((status: string) => {
        setResetStatus(status);
      });
      
      if (result.success) {
        setResetStatus(result.message || 'Reset complete! Reloading...');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setResetStatus(`Error: ${result.message || 'Reset failed'}`);
        setResetting(false);
      }
    } catch (e: any) {
      setResetStatus(`Error: ${e?.message || String(e)}`);
      setResetting(false);
    }
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
    transition: 'all 0.2s',
    fontSize: 14
  };

  const keyboardShortcuts = [
    { keys: 'Ctrl+1', description: 'Navigate to Chat' },
    { keys: 'Ctrl+2', description: 'Navigate to Catalog' },
    { keys: 'Ctrl+3', description: 'Navigate to Downloads' },
    { keys: 'Ctrl+4', description: 'Navigate to Settings' },
    { keys: 'Escape', description: 'Close modals and dialogs' },
    { keys: 'Enter', description: 'Send message in Chat' },
    { keys: 'Tab', description: 'Navigate between focusable elements' },
  ];

  return (
    <div className="page" aria-label="Settings">
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 32, color: 'white' }}>Settings</h1>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#8b5cf6' }}>Mode</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, maxWidth: 800, alignItems: 'center' }}>
          <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>Experience</label>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }} role="radiogroup" aria-label="Experience mode">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255, 255, 255, 0.9)' }}>
              <input
                type="radio"
                name="mode"
                value="beginner"
                checked={(settings.mode || 'beginner') === 'beginner'}
                onChange={() => { setSettings({ ...settings, mode: 'beginner' }); save({ mode: 'beginner' }); }}
              />
              Beginner
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255, 255, 255, 0.9)' }}>
              <input
                type="radio"
                name="mode"
                value="power"
                checked={settings.mode === 'power'}
                onChange={() => { setSettings({ ...settings, mode: 'power' }); save({ mode: 'power' }); }}
              />
              Power user
            </label>
            <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>
              Power mode allows installing large models with a confirmation.
            </span>
          </div>
        </div>
      </section>
      
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: '#8b5cf6' }}>General</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, maxWidth: 800, alignItems: 'center' }}>
          <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>Ollama Host</label>
          <input
            aria-label="Ollama host"
            value={settings.ollamaHost || ''}
            onChange={(e) => setSettings({ ...settings, ollamaHost: e.target.value })}
            onBlur={() => save({ ollamaHost: settings.ollamaHost })}
            style={inputStyle}
            placeholder="http://localhost:11434"
          />
          <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>Models Directory</label>
          <input
            aria-label="Models directory"
            value={settings.modelsDir || ''}
            onChange={(e) => setSettings({ ...settings, modelsDir: e.target.value })}
            onBlur={() => save({ modelsDir: settings.modelsDir })}
            style={inputStyle}
          />
          <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>Hugging Face Token</label>
          <input
            aria-label="Hugging Face token"
            type="password"
            value={settings.hfToken || ''}
            onChange={(e) => setSettings({ ...settings, hfToken: e.target.value })}
            onBlur={() => save({ hfToken: settings.hfToken })}
            style={inputStyle}
            placeholder="Optional: for private models"
          />
        </div>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: '#8b5cf6' }}>Keyboard Shortcuts</h2>
        <div style={{ maxWidth: 600 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(99, 102, 241, 0.3)', color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                  Keys
                </th>
                <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(99, 102, 241, 0.3)', color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {keyboardShortcuts.map((shortcut, index) => (
                <tr key={index}>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(99, 102, 241, 0.1)' }}>
                    <code style={{ 
                      background: 'rgba(139, 92, 246, 0.2)', 
                      padding: '4px 8px', 
                      borderRadius: 4,
                      color: '#a78bfa',
                      fontSize: 13,
                      fontFamily: 'monospace'
                    }}>
                      {shortcut.keys}
                    </code>
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(99, 102, 241, 0.1)', color: 'rgba(255, 255, 255, 0.8)' }}>
                    {shortcut.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ 
        marginBottom: 48, 
        padding: 24, 
        borderRadius: 12, 
        border: '2px solid rgba(220, 38, 38, 0.5)',
        background: 'rgba(220, 38, 38, 0.1)'
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#fca5a5' }}>Danger Zone</h2>
        <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: 20, lineHeight: 1.6 }}>
          The following action will permanently delete all data, including:
        </p>
        <ul style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: 20, lineHeight: 1.8, paddingLeft: 20 }}>
          <li>All downloaded models</li>
          <li>All chat conversations</li>
          <li>Ollama installation</li>
          <li>Application settings and data</li>
        </ul>
        <p style={{ color: '#fca5a5', fontWeight: 600, marginBottom: 20 }}>
          ⚠️ This action cannot be undone!
        </p>
        <button
          onClick={() => setShowResetModal(true)}
          style={{
            ...buttonStyle,
            background: '#dc2626',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#b91c1c';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#dc2626';
          }}
        >
          Reset Everything
        </button>
      </section>

      {showResetModal && (
        <>
          <div
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
            onClick={resetting ? undefined : () => setShowResetModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
            aria-describedby="reset-modal-description"
          >
            <div
              style={{
                background: '#1e293b',
                borderRadius: 16,
                maxWidth: 600,
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(220, 38, 38, 0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                padding: '24px 24px 16px 24px',
                borderBottom: '1px solid rgba(220, 38, 38, 0.3)',
              }}>
                <h3
                  id="reset-modal-title"
                  style={{
                    color: '#fca5a5',
                    fontSize: 24,
                    margin: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                  }}
                >
                  <span style={{ flex: 1 }}>⚠️ Reset Everything</span>
                  {!resetting && (
                    <button
                      onClick={() => setShowResetModal(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: 28,
                        cursor: 'pointer',
                        padding: '0 8px',
                        lineHeight: 1,
                      }}
                      aria-label="Close modal"
                    >
                      ×
                    </button>
                  )}
                </h3>
              </div>

              <div id="reset-modal-description" style={{ padding: 24 }}>
                {!resetting ? (
                  <>
                    <p style={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.6, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>
                      This will permanently delete:
                    </p>
                    <ul style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: 24, lineHeight: 1.8, paddingLeft: 20 }}>
                      <li>All downloaded Ollama models</li>
                      <li>Complete Ollama installation</li>
                      <li>All chat conversations and history</li>
                      <li>All application settings</li>
                    </ul>
                    <p style={{ color: '#fca5a5', fontWeight: 600, marginBottom: 24 }}>
                      This action is irreversible. Are you absolutely sure?
                    </p>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                      <button
                        ref={resetButtonRef}
                        onClick={() => setShowResetModal(false)}
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
                        onClick={handleResetEverything}
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
                        Yes, Reset Everything
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        width: '100%',
                        height: 8,
                        background: 'rgba(220, 38, 38, 0.2)',
                        borderRadius: 4,
                        overflow: 'hidden',
                        marginBottom: 16
                      }}>
                        <div style={{
                          width: '100%',
                          height: '100%',
                          background: '#dc2626',
                          animation: 'shimmer 2s infinite',
                        }} />
                      </div>
                      <p style={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: 16,
                        marginBottom: 8,
                        fontWeight: 600
                      }}>
                        {resetStatus}
                      </p>
                      <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
                        Please wait, this may take a few moments...
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
        </>
      )}
    </div>
  );
}


