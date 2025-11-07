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
}

export default function ModelDetailModal({ isOpen, model, compatibility, onClose, onDownload }: ModelDetailModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setDownloading(false);
      setDownloadStatus('');
      setProgress(0);
    }
  }, [isOpen]);

  if (!isOpen || !model) return null;

  const handleDownload = async () => {
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
        } else if (status.toLowerCase().includes('pulling') || status.toLowerCase().includes('downloading')) {
          setDownloadStatus(`Downloading: ${status}`);
        } else if (status.toLowerCase().includes('success') || status.toLowerCase().includes('complete')) {
          setProgress(100);
          setDownloadStatus('Download complete!');
        }
      });

      setProgress(100);
      setDownloadStatus('Model installed successfully!');
      
      setTimeout(() => {
        setDownloading(false);
        onClose();
      }, 2000);
    } catch (error) {
      setDownloadStatus(`Error: ${error}`);
      setDownloading(false);
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
        onClick={downloading ? undefined : onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <div
          style={{
            background: '#1e293b',
            borderRadius: 16,
            maxWidth: 600,
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
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
                  onClick={onClose}
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
                  style={{ position: 'absolute', left: '-9999px' }}
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  Download progress: {progress}%
                </div>
              </div>
            )}

            <p style={{ 
              color: 'rgba(255, 255, 255, 0.6)', 
              fontSize: 13, 
              margin: 0,
              marginBottom: 24,
            }}>
              💡 Ollama models are optimized for local CPU/GPU usage
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleDownload}
                disabled={!compatibility.ok || downloading}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: compatibility.ok && !downloading ? '#8b5cf6' : '#64748b',
                  color: 'white',
                  cursor: compatibility.ok && !downloading ? 'pointer' : 'not-allowed',
                  fontWeight: 500,
                  fontSize: 16,
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  if (compatibility.ok && !downloading) {
                    e.currentTarget.style.background = '#7c3aed';
                  }
                }}
                onMouseOut={(e) => {
                  if (compatibility.ok && !downloading) {
                    e.currentTarget.style.background = '#8b5cf6';
                  }
                }}
                aria-label={downloading ? `Downloading ${model.repo_id}` : `Download ${model.repo_id}`}
              >
                {downloading ? 'Downloading...' : compatibility.ok ? 'Download Model' : 'Not Compatible'}
              </button>
              
              {!downloading && (
                <button
                  onClick={onClose}
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
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
}


