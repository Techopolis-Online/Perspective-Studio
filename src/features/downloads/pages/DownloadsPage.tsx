import React, { useEffect, useState } from 'react';

export default function DownloadsPage() {
  const [installedModels, setInstalledModels] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const models = await window.api.ollama.listModels();
        setInstalledModels(models || []);
      } catch (e) {
        console.error('Failed to fetch installed models:', e);
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24, background: '#0f172a', color: 'white', height: '100%' }} aria-label="Downloads">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: 'white', fontSize: 24, marginBottom: 12 }}>Installed Models</h2>
        <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }}>
          Models are downloaded and managed by Ollama. Use the Catalog to download new models.
        </p>
      </div>
      
      {installedModels.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255, 255, 255, 0.5)' }}>
          No models installed yet. Browse the Catalog to download models.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {installedModels.map((model) => (
            <div 
              key={model} 
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 8,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h3 style={{ color: 'white', fontSize: 16, fontWeight: 500, margin: 0 }}>{model}</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13, margin: '4px 0 0 0' }}>
                  Ready to use in Chat
                </p>
              </div>
              <span style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600
              }}>
                Installed
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


