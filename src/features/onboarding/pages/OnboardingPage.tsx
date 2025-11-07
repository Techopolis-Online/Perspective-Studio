import React, { useState, useEffect } from 'react';

export default function OnboardingPage({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [step, setStep] = useState<'experience' | 'setup'>('experience');
  const [selectedMode, setSelectedMode] = useState<'beginner' | 'power' | null>(null);

  useEffect(() => {
    async function checkSetup() {
      const installed = await window.api.ollama.isInstalled();
      setOllamaInstalled(installed);
      
      if (installed) {
        try {
          const updateInfo = await window.api.ollama.checkUpdate();
          setNeedsUpdate(updateInfo.needsUpdate);
        } catch {}
      }
      
      setChecking(false);
    }
    checkSetup();
  }, []);

  function push(status: string) {
    setLog((prev) => [...prev, status]);
  }

  async function quickStart() {
    if (busy) return;
    setBusy(true);
    setLog([]);
    setProgress(0);
    
    try {
      if (!ollamaInstalled) {
        push('Setting up your AI environment…');
        setProgress(10);
        push('This will only take a moment!');
        
        const res = await window.api.ollama.install((s: string) => {
          push(s);
          if (s.includes('Installing') || s.includes('Downloading')) {
            setProgress(30);
          } else if (s.includes('complete') || s.includes('successfully')) {
            setProgress(60);
          }
        });
        
        if (!res?.success) {
          push(`${res?.message || 'Setup encountered an issue.'}`);
          push('You can try again or set up manually.');
          setBusy(false);
          return;
        }
        setOllamaInstalled(true);
        setProgress(70);
      } else {
        push('Everything looks good!');
        setProgress(20);
      }
      
      push('Starting AI server…');
      setProgress(ollamaInstalled ? 40 : 75);
      const running = await window.api.ollama.ensureServer((s: string) => {
        push(s);
        if (s.includes('ready') || s.includes('running')) {
          setProgress(ollamaInstalled ? 60 : 85);
        }
      });
      
      if (!running) {
        push('Server is starting up…');
        push('This may take a moment. You can continue and it will connect automatically.');
      } else {
        setProgress(ollamaInstalled ? 70 : 90);
      }
      
      const model = 'llama3.2:1b';
      push(`Downloading starter model: ${model}…`);
      push('This is a small, fast model perfect for getting started!');
      setProgress(ollamaInstalled ? 75 : 92);
      
      const ok = await window.api.ollama.pull(model, (s: string) => {
        if (s && !s.includes('pulling') && !s.includes('downloading')) {
          if (s.includes('complete') || s.includes('success')) {
            push(s);
          }
        }
      });
      
      if (!ok) {
        push('Model download had issues, but you can download models later from the Catalog.');
      } else {
        push(`Successfully downloaded ${model}!`);
        setProgress(98);
      }
      
      push('All set! Welcome to Perspective Studio!');
      setProgress(100);
      await new Promise((r) => setTimeout(r, 1000));
      
      await window.api.settings.update({ firstRun: false, mode: selectedMode || 'beginner' });
      onDone();
    } catch (error: any) {
      push(`An error occurred: ${error?.message || 'Unknown error'}`);
      push('You can try again.');
      setBusy(false);
    }
  }

  async function downloadModelOnly() {
    if (busy) return;
    setBusy(true);
    setLog([]);
    setProgress(0);
    
    try {
      if (needsUpdate) {
        push('Checking for updates…');
        setProgress(5);
        push('An update is available, but you can continue with the current version.');
        setProgress(10);
      }
      
      push('Starting AI server…');
      setProgress(20);
      const running = await window.api.ollama.ensureServer((s: string) => {
        push(s);
        if (s.includes('ready') || s.includes('running')) {
          setProgress(40);
        }
      });
      
      if (!running) {
        push('Server is starting up…');
      } else {
        setProgress(50);
      }
      
      const model = 'llama3.2:1b';
      push(`Downloading starter model: ${model}…`);
      setProgress(60);
      
      const ok = await window.api.ollama.pull(model, (s: string) => {
        if (s && !s.includes('pulling') && !s.includes('downloading')) {
          if (s.includes('complete') || s.includes('success')) {
            push(s);
          }
        }
      });
      
      if (!ok) {
        push('Model download had issues, but you can download models later from the Catalog.');
      } else {
        push(`Successfully downloaded ${model}!`);
        setProgress(95);
      }
      
      push('All set! Welcome to Perspective Studio!');
      setProgress(100);
      await new Promise((r) => setTimeout(r, 1000));
      
      await window.api.settings.update({ firstRun: false, mode: selectedMode || 'beginner' });
      onDone();
    } catch (error: any) {
      push(`An error occurred: ${error?.message || 'Unknown error'}`);
      setBusy(false);
    }
  }

  async function skipSetup(mode: 'beginner' | 'power') {
    await window.api.settings.update({ firstRun: false, mode });
    onDone();
  }

  if (checking) {
    return (
      <div style={{ 
        padding: 48, 
        maxWidth: 800, 
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        background: '#0f172a',
        color: 'white'
      }} aria-label="Onboarding">
        <div style={{ textAlign: 'center' }}>
          <p>Checking your setup…</p>
        </div>
      </div>
    );
  }

  if (step === 'experience') {
    return (
      <div style={{ 
        padding: 48, 
        maxWidth: 800, 
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        background: '#0f172a',
        minHeight: '100vh'
      }} aria-label="Onboarding Experience Selection">
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <h1 style={{ fontSize: 36, fontWeight: 600, marginBottom: 12, color: 'white' }}>
            Welcome to Perspective Studio
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6 }}>
            How familiar are you with AI?
          </p>
        </div>

        <div style={{ display: 'flex', gap: 24, flexDirection: 'column' }}>
          <button
            onClick={() => skipSetup('beginner')}
            style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '2px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 16,
              padding: 32,
              color: 'white',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)';
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px 0', color: 'white' }}>
              Beginner Mode
            </div>
            <p style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.6, margin: 0 }}>
              Guided setup with simple defaults and helpful tips.
            </p>
          </button>

          <button
            onClick={() => skipSetup('power')}
            style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '2px solid rgba(139, 92, 246, 0.3)',
              borderRadius: 16,
              padding: 32,
              color: 'white',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px 0', color: 'white' }}>
              Power User Mode
            </div>
            <p style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.6, margin: 0 }}>
              Full controls and advanced options from the start.
            </p>
          </button>
        </div>

        <p style={{ marginTop: 32, textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
          You can change this later in Settings
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: 48, 
      maxWidth: 800, 
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      justifyContent: 'center',
      background: '#0f172a',
      minHeight: '100vh'
    }} aria-label="Onboarding">
      <button
        onClick={() => setStep('experience')}
        disabled={busy}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 16px',
          fontSize: 14,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'transparent',
          color: 'rgba(255, 255, 255, 0.7)',
          borderRadius: 8,
          cursor: busy ? 'not-allowed' : 'pointer',
          marginBottom: 24,
          transition: 'all 0.2s',
        }}
        onMouseOver={(e) => {
          if (!busy) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            e.currentTarget.style.color = 'white';
          }
        }}
        onMouseOut={(e) => {
          if (!busy) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
          }
        }}
      >
        Back
      </button>
      
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontSize: 36, fontWeight: 600, marginBottom: 12, color: 'white' }}>
          Welcome to Perspective Studio
        </h1>
      </div>

      {!ollamaInstalled && (
        <div style={{ 
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 16,
          padding: 32,
          marginBottom: 24,
          color: 'white',
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>
            One-Click Setup
          </h2>
          <p style={{ fontSize: 16, marginBottom: 24, opacity: 0.9, lineHeight: 1.6 }}>
            We'll automatically set up everything you need, start the AI server, and download a starter model. 
            Just click the button below and relax - we've got you covered!
          </p>
          <button 
            onClick={quickStart} 
            disabled={busy} 
            style={{ 
              padding: '14px 28px',
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background: busy ? '#64748b' : '#8b5cf6',
              color: 'white',
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: busy ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.4)',
              width: '100%'
            }}
            onMouseOver={(e) => {
              if (!busy) {
                e.currentTarget.style.background = '#7c3aed';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.5)';
              }
            }}
            onMouseOut={(e) => {
              if (!busy) {
                e.currentTarget.style.background = '#8b5cf6';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
              }
            }}
          >
            {busy ? 'Setting everything up…' : 'Get Started - One Click Setup'}
          </button>
          
          <button 
            onClick={() => skipSetup(selectedMode || 'beginner')}
            disabled={busy}
            style={{
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginTop: 12,
            }}
            onMouseOver={(e) => {
              if (!busy) {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                e.currentTarget.style.color = 'white';
              }
            }}
            onMouseOut={(e) => {
              if (!busy) {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
              }
            }}
          >
            Skip Setup - I'll Configure Later
          </button>
          
          {busy && progress > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ 
                width: '100%', 
                height: 8, 
                background: 'rgba(255,255,255,0.3)', 
                borderRadius: 4,
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${progress}%`, 
                  height: '100%', 
                  background: 'white',
                  transition: 'width 0.3s ease',
                  borderRadius: 4
                }} />
              </div>
              <p style={{ marginTop: 8, fontSize: 14, opacity: 0.9 }}>
                {Math.round(progress)}% complete
              </p>
            </div>
          )}
        </div>
      )}

      {log.length > 0 && (
        <div style={{ 
          border: '1px solid rgba(99, 102, 241, 0.3)', 
          borderRadius: 12, 
          padding: 20, 
          background: 'rgba(15, 23, 42, 0.8)',
          marginBottom: 24,
          maxHeight: 300,
          overflowY: 'auto'
        }}>
          <div style={{ 
            fontSize: 14, 
            fontWeight: 600, 
            marginBottom: 12, 
            color: 'white' 
          }}>
            Setup Progress:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {log.map((l, i) => (
              <div 
                key={i} 
                style={{ 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  fontSize: 14,
                  lineHeight: 1.6,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  padding: '4px 0',
                  opacity: i === log.length - 1 ? 1 : 0.8
                }}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      )}

      

    </div>
  );
}


