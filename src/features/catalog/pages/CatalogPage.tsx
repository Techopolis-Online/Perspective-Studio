import React, { useEffect, useState } from 'react';
import { ModelEntry } from '../types';
import ModelDetailModal from '../components/ModelDetailModal';

export default function CatalogPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [totalMemBytes, setTotalMemBytes] = useState<number | null>(null);
  const [filterWorksOnDevice, setFilterWorksOnDevice] = useState(false);
  const [openerEl, setOpenerEl] = useState<HTMLElement | null>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const mem = await window.api.system.memory();
        setTotalMemBytes(mem.totalMemBytes || null);
      } catch {}
      setLoading(true);
      const models = await window.api.ollama.catalog.listTop(500);
      setResults(Array.isArray(models) ? models : []);
      try {
        const installed = await window.api.ollama.listModels();
        setInstalledModels(Array.isArray(installed) ? installed : []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  function bytesToGb(bytes: number | null | undefined) {
    if (!bytes || bytes <= 0) return null;
    return bytes / (1024 ** 3);
  }

  function compatibilityFor(entry: ModelEntry) {
    const hasCpuFile = entry.worksLocally === true;
    const ramGb = bytesToGb(totalMemBytes);
    const sizeGb = bytesToGb(entry.smallestGgufSize);

    if (!hasCpuFile) {
      return {
        ok: false,
        level: 'bad',
        text: 'Not compatible',
        badge: 'Incompatible',
      } as const;
    }

    if (!sizeGb || !ramGb) {
      return {
        ok: true,
        level: 'unknown',
        text: 'Compatible (size unknown)',
        badge: 'Compatible',
      } as const;
    }

    const ratio = sizeGb / ramGb;
    if (ratio <= 0.3) {
      return {
        ok: true,
        level: 'great',
        text: `Runs fast (requires ~${sizeGb.toFixed(1)} GB)`,
        badge: 'Runs Fast',
      } as const;
    }
    if (ratio <= 0.6) {
      return {
        ok: true,
        level: 'good',
        text: `Runs well (requires ~${sizeGb.toFixed(1)} GB)`,
        badge: 'Runs Well',
      } as const;
    }
    if (ratio <= 0.85) {
      return {
        ok: true,
        level: 'caution',
        text: `Runs slowly (requires ~${sizeGb.toFixed(1)} GB)`,
        badge: 'Runs Slowly',
      } as const;
    }
    return {
      ok: false,
      level: 'bad',
      text: `Too large (requires ~${sizeGb.toFixed(1)} GB)`,
      badge: 'Too Large',
    } as const;
  }

  async function search() {
    setLoading(true);
    const models = await window.api.ollama.catalog.search(query, 500);
    setResults(Array.isArray(models) ? models : []);
    setLoading(false);
  }

  function openModal(model: ModelEntry) {
    const el = document.activeElement as HTMLElement | null;
    setOpenerEl(el && typeof el.focus === 'function' ? el : null);
    setSelectedModel(model);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setTimeout(() => setSelectedModel(null), 200);
  }

  async function download(repoId: string) {
  }

  async function refreshInstalled() {
    try {
      const installed = await window.api.ollama.listModels();
      setInstalledModels(Array.isArray(installed) ? installed : []);
    } catch {}
  }

  const filteredResults = filterWorksOnDevice 
    ? results.filter(model => compatibilityFor(model).ok)
    : results;

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

  return (
    <>
      <div className="page" aria-label="Catalog">
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 28, margin: '0 0 8px 0', color: 'white' }}>Model Catalog</h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14, margin: 0 }}>
            Browse and download AI models from Ollama
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            aria-label="Search models"
            placeholder="Search Ollama models…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <button 
            onClick={search} 
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#7c3aed';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#8b5cf6';
              }
            }}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          {typeof totalMemBytes === 'number' && (
            <div style={{
              alignSelf: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 12,
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 8,
              padding: '6px 10px',
              background: 'rgba(15, 23, 42, 0.6)',
            }}>
              Your RAM: ~{(bytesToGb(totalMemBytes) || 0).toFixed(1)} GB
            </div>
          )}
        </div>

        <div style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14, fontWeight: 500 }}>
            Filter:
          </span>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: 8,
            background: filterWorksOnDevice ? 'rgba(139, 92, 246, 0.2)' : 'rgba(30, 41, 59, 0.6)',
            border: '1px solid ' + (filterWorksOnDevice ? 'rgba(139, 92, 246, 0.5)' : 'rgba(99, 102, 241, 0.3)'),
            transition: 'all 0.2s',
          }}>
            <input
              type="checkbox"
              checked={filterWorksOnDevice}
              onChange={(e) => setFilterWorksOnDevice(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: 'white', fontSize: 14 }}>
              Works on your device
            </span>
          </label>
          {filterWorksOnDevice && (
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13 }}>
              Showing {filteredResults.length} of {results.length} models
            </span>
          )}
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16 
        }}>
          {filteredResults.map((model) => {
            const comp = compatibilityFor(model);
            const desc = (model.description || '').replace(/\.*\s*$/, '');
            const isInstalled = installedModels.includes(model.repo_id);
            const summary = `${model.repo_id}. ${desc} ${comp.text}${isInstalled ? ' · Downloaded' : ''}`.trim();
            return (
              <div
                key={model.repo_id}
                style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 12,
                  padding: 20,
                  transition: 'all 0.2s',
                  color: 'white',
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(30, 41, 59, 1)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139, 92, 246, 0.5)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(30, 41, 59, 0.8)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99, 102, 241, 0.3)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'white',
                  }}
                >
                  <button
                    onClick={() => openModal(model)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      color: 'inherit',
                      font: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    {summary}
                  </button>
                </h3>
              </div>
            );
          })}
        </div>

        {filteredResults.length === 0 && !loading && (
          <div style={{ 
            textAlign: 'center', 
            padding: 60, 
            color: 'rgba(255, 255, 255, 0.5)' 
          }}>
            {filterWorksOnDevice && results.length > 0 
              ? 'No models match the filter. Try disabling "Works on your device".'
              : query 
              ? 'No models found. Try a different search term.' 
              : 'Loading models...'}
          </div>
        )}
      </div>

      <ModelDetailModal
        isOpen={modalOpen}
        model={selectedModel}
        compatibility={selectedModel ? compatibilityFor(selectedModel) : { ok: false, level: 'unknown', text: '' }}
        onClose={closeModal}
        onDownload={download}
        installedNames={installedModels}
        onDownloaded={async () => { await refreshInstalled(); }}
        onRemoved={async () => { await refreshInstalled(); }}
        returnFocusEl={openerEl}
      />
    </>
  );
}


