import React, { useState, useEffect } from 'react';

interface ModelDetailModalProps {
  isOpen: boolean;
  model: {
    repo_id: string;
    description: string;
    likes: number;
    downloads: number;
    smallestGgufSize?: number;
    worksLocally: boolean;
  } | null;
  compatibility: {
    ok: boolean;
    level: string;
    text: string;
  };
  onClose: () => void;
  onDownload: (repoId: string) => void;
  installedNames?: string[];
  onDownloaded?: (repoId: string) => void;
  onRemoved?: (repoId: string) => void;
  returnFocusEl?: HTMLElement | null;
}

export default function ModelDetailModal({ isOpen, model, compatibility, onClose, onDownload, installedNames, onDownloaded, onRemoved, returnFocusEl }: ModelDetailModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [mode, setMode] = useState<'beginner' | 'power'>('beginner');
  const downloadBtnRef = React.useRef<HTMLButtonElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const liveRef = React.useRef<HTMLDivElement>(null);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const confirmOverlayRef = React.useRef<HTMLDivElement>(null);
  const confirmCancelRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setDownloading(false);
      setDownloadStatus('');
      setProgress(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const toFocus = downloadBtnRef.current || containerRef.current;
      requestAnimationFrame(() => toFocus?.focus());
    }
  }, [isOpen]);

  // When the confirmation dialog opens, move focus into it
  useEffect(() => {
    if (showDownloadConfirm) {
      requestAnimationFrame(() => confirmCancelRef.current?.focus());
    }
  }, [showDownloadConfirm]);

  // Allow Escape to close the confirmation dialog and restore focus
  useEffect(() => {
    if (!showDownloadConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDownloadConfirm(false);
        requestAnimationFrame(() => downloadBtnRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDownloadConfirm]);

  // Load settings to determine mode (beginner | power)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await window.api.settings.get();
        if (!cancelled) {
          const m = (s?.mode === 'power' ? 'power' : 'beginner') as 'beginner' | 'power';
          setMode(m);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Native <dialog> handles focus trapping while open
  // Global Escape handler for the details modal (disabled while confirm is open)
  useEffect(() => {
    if (!isOpen || downloading) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDownloadConfirm) {
        e.preventDefault();
        onClose();
        if (returnFocusEl) requestAnimationFrame(() => returnFocusEl.focus());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, downloading, showDownloadConfirm, onClose, returnFocusEl]);

  if (!isOpen || !model) return null;

  const isInstalled = Array.isArray(installedNames) ? installedNames.includes(model.repo_id) : false;

  const startDownload = async () => {
    setDownloading(true);
    setDownloadStatus('Starting download...');
    setProgress(0);

    try {
      await window.api.ollama.pull(model.repo_id, (status: string) => {
        setDownloadStatus(status);
        
        const percentMatch = status.match(/(\d+)%/);
        if (percentMatch) {
          const percent = parseInt(percentMatch[1]);
          setProgress(percent);
          if (liveRef.current) liveRef.current.textContent = `Download progress: ${percent}%`;
        } else if (status.toLowerCase().includes('pulling') || status.toLowerCase().includes('downloading')) {
          setDownloadStatus(`Downloading: ${status}`);
        } else if (status.toLowerCase().includes('success') || status.toLowerCase().includes('complete')) {
          setProgress(100);
          setDownloadStatus('Download complete!');
        }
      });

      setProgress(100);
      setDownloadStatus('Model installed successfully!');
      try { onDownloaded && onDownloaded(model.repo_id); } catch {}
      if (liveRef.current) liveRef.current.textContent = `Model ${model.repo_id} installed successfully`;
      
      setTimeout(() => {
        setDownloading(false);
        onClose();
        // Restore focus to the element that opened the modal
        if (returnFocusEl) {
          requestAnimationFrame(() => returnFocusEl.focus());
        }
      }, 1200);
    } catch (error) {
      setDownloadStatus(`Error: ${error}`);
      setDownloading(false);
    }
  };

  const handleDownload = async () => {
    // In power mode, allow download even if not compatible, but confirm first (use app-styled modal)
    if (!compatibility.ok && mode === 'power') {
      setShowDownloadConfirm(true);
      return;
    }
    // In beginner mode, block when not compatible (button should also be disabled)
    if (!compatibility.ok && mode !== 'power') {
      return;
    }
    await startDownload();
  };

  const handleRemove = async () => {
    if (!model) return;
    try {
      setRemoving(true);
      setDownloadStatus('Removing model…');
      const ok = await window.api.ollama.deleteModel(model.repo_id);
      if (ok) {
        setDownloadStatus('Model removed.');
        try { onRemoved && onRemoved(model.repo_id); } catch {}
        if (liveRef.current) liveRef.current.textContent = `Model ${model.repo_id} removed`;
        setTimeout(() => {
          setRemoving(false);
          onClose();
          if (returnFocusEl) requestAnimationFrame(() => returnFocusEl.focus());
        }, 800);
      } else {
        setDownloadStatus('Failed to remove model.');
        setRemoving(false);
      }
    } catch (e) {
      setDownloadStatus(`Error: ${String(e)}`);
      setRemoving(false);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Size unknown';
    const gb = bytes / (1024 ** 3);
    return `~${gb.toFixed(1)} GB`;
  };

  return (
    <>
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        onClick={(e) => {
          if (e.target === overlayRef.current && !downloading) {
            onClose();
            if (returnFocusEl) requestAnimationFrame(() => returnFocusEl.focus());
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
            width: 'min(600px, calc(100% - 40px))',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
          ref={containerRef}
          tabIndex={-1}
          aria-busy={downloading}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !downloading && !showDownloadConfirm) {
              e.preventDefault();
              onClose();
              if (returnFocusEl) requestAnimationFrame(() => returnFocusEl.focus());
            }
          }}
        >
          <div style={{
            padding: '24px 24px 16px 24px',
            borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <h2 id="modal-title" style={{ color: 'white', fontSize: 24, margin: 0, flex: 1 }}>
                {model.repo_id}
              </h2>
              {!downloading && (
                <button
                  onClick={() => {
                    onClose();
                    if (returnFocusEl) requestAnimationFrame(() => returnFocusEl.focus());
                  }}
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
            </div>
          </div>

          <div id="modal-description" style={{ padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 16, marginBottom: 8 }}>Description</h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, margin: 0 }}>
                {model.description || 'No description available.'}
              </p>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 16,
              marginBottom: 20,
              padding: 16,
              background: 'rgba(99, 102, 241, 0.1)',
              borderRadius: 8,
            }}>
              <div>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12, marginBottom: 4 }}>Size</div>
                <div style={{ color: 'white', fontSize: 16, fontWeight: 500 }}>
                  {formatSize(model.smallestGgufSize)}
                </div>
              </div>
              <div>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12, marginBottom: 4 }}>Popularity</div>
                <div style={{ color: 'white', fontSize: 16, fontWeight: 500 }}>
                  {model.likes} likes
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <span style={{
                display: 'inline-block',
                background: compatibility.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: compatibility.ok ? '#86efac' : '#fca5a5',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
              }}>
                {compatibility.text}
              </span>
            </div>

            {downloading && (
              <div 
                style={{ 
                  marginBottom: 24,
                  padding: 16,
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: 8,
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: 'white', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                    Downloading...
                  </div>
                  <div 
                    style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 13 }}
                    aria-live="polite"
                  >
                    {downloadStatus}
                  </div>
                </div>
                
                <div style={{
                  width: '100%',
                  height: 8,
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}>
                  <div 
                    style={{
                      width: progress > 0 ? `${progress}%` : '100%',
                      height: '100%',
                      background: progress > 0 ? '#8b5cf6' : 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.5), transparent)',
                      transition: 'width 0.3s ease',
                      animation: progress > 0 ? 'none' : 'shimmer 1.5s infinite',
                    }}
                  />
                </div>
                
                <div 
                  className="sr-only"
                  role="status"
                  ref={liveRef}
                >
                  Download progress: {progress}%
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleDownload}
                disabled={downloading || isInstalled || removing || (mode !== 'power' && !compatibility.ok)}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: ((!downloading && !isInstalled && !removing) && (compatibility.ok || mode === 'power')) ? '#8b5cf6' : '#64748b',
                  color: 'white',
                  cursor: ((!downloading && !isInstalled && !removing) && (compatibility.ok || mode === 'power')) ? 'pointer' : 'not-allowed',
                  fontWeight: 500,
                  fontSize: 16,
                  transition: 'all 0.2s',
                  opacity: isInstalled ? 0.6 : 1,
                }}
                ref={downloadBtnRef}
                onMouseOver={(e) => {
                  if ((compatibility.ok || mode === 'power') && !downloading && !isInstalled && !removing) {
                    e.currentTarget.style.background = '#7c3aed';
                  }
                }}
                onMouseOut={(e) => {
                  if ((compatibility.ok || mode === 'power') && !downloading && !isInstalled && !removing) {
                    e.currentTarget.style.background = '#8b5cf6';
                  }
                }}
                aria-label={
                  downloading
                    ? `Downloading ${model.repo_id}`
                    : isInstalled
                    ? `${model.repo_id} is already installed`
                    : `Download ${model.repo_id}`
                }
              >
                {downloading ? 'Downloading...' : isInstalled ? 'Installed' : ((compatibility.ok || mode === 'power') ? 'Download Model' : 'Not Compatible')}
              </button>
              
              {!downloading && (
                <button
                  onClick={() => { onClose(); if (returnFocusEl) requestAnimationFrame(() => returnFocusEl.focus()); }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: 8,
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    background: 'transparent',
                    color: 'rgba(255, 255, 255, 0.9)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: 16,
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
              )}
              
              {isInstalled && !downloading && (
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  style={{
                    padding: '12px 24px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#dc2626',
                    color: 'white',
                    cursor: removing ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    fontSize: 16,
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (!removing) e.currentTarget.style.background = '#b91c1c';
                  }}
                  onMouseOut={(e) => {
                    if (!removing) e.currentTarget.style.background = '#dc2626';
                  }}
                  aria-label={`Remove ${model.repo_id}`}
                >
                  {removing ? 'Removing…' : 'Remove Model'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {showDownloadConfirm && (
        <div
          ref={confirmOverlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-confirm-title"
          aria-describedby="download-confirm-description"
          onClick={(e) => {
            if (e.target === confirmOverlayRef.current) {
              setShowDownloadConfirm(false);
              // Return focus to the original download button
              requestAnimationFrame(() => downloadBtnRef.current?.focus());
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            zIndex: 1100,
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
              maxWidth: 520,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            <div style={{ padding: '24px 24px 16px 24px', borderBottom: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <h2 id="download-confirm-title" style={{ color: 'white', fontSize: 22, margin: 0, flex: 1 }}>
                  Proceed with large download?
                </h2>
                <button
                  onClick={() => {
                    setShowDownloadConfirm(false);
                    requestAnimationFrame(() => downloadBtnRef.current?.focus());
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: 28,
                    cursor: 'pointer',
                    padding: '0 8px',
                    lineHeight: 1,
                  }}
                  aria-label="Close confirmation"
                >
                  ×
                </button>
              </div>
            </div>
            <div id="download-confirm-description" style={{ padding: 24 }}>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6, margin: 0, marginBottom: 16 }}>
                This model may be too large for your device and could fail.
              </p>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6, margin: 0, marginBottom: 24 }}>
                Download <span style={{ color: 'white', fontWeight: 600 }}>{model.repo_id}</span> anyway?
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  ref={confirmCancelRef}
                  onClick={() => {
                    setShowDownloadConfirm(false);
                    requestAnimationFrame(() => downloadBtnRef.current?.focus());
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
                  onClick={async () => {
                    setShowDownloadConfirm(false);
                    await startDownload();
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#8b5cf6',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#7c3aed';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#8b5cf6';
                  }}
                >
                  Download anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


