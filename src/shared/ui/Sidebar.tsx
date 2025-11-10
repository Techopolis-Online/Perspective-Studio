import React from 'react';

type Props = {
  current: string;
  onNavigate: (view: string) => void;
};

const items = ['Chat', 'Catalog', 'Downloads', 'Settings'];

const itemToShortcut: Record<string, string> = {
  Chat: 'Ctrl+1',
  Catalog: 'Ctrl+2',
  Downloads: 'Ctrl+3',
  Settings: 'Ctrl+4',
};

export default function Sidebar({ current, onNavigate }: Props) {
  return (
    <nav aria-label="Navigation" style={{ 
      width: 180, 
      borderRight: '1px solid rgba(99, 102, 241, 0.2)', 
      padding: 8,
      background: 'rgba(15, 23, 42, 0.5)'
    }}>
      <h2 style={{ fontSize: 16, margin: '8px 8px 12px', color: 'white' }}>Perspective Studio</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((label) => (
          <li key={label}>
            <button
              aria-current={current === label ? 'page' : undefined}
              onClick={() => onNavigate(label)}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: current === label ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                border: current === label ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                padding: '8px 10px',
                margin: '4px 6px',
                cursor: 'pointer',
                color: 'white',
                transition: 'all 0.2s'
              }}
              aria-keyshortcuts={`Control+${itemToShortcut[label]?.split('+')[1] || ''}`}
              title={itemToShortcut[label] ? `Shortcut: ${itemToShortcut[label]}` : undefined}
              onMouseOver={(e) => {
                if (current !== label) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
              }}
              onMouseOut={(e) => {
                if (current !== label) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }
              }}
            >
              <span>{label}</span>
              <span style={{ 
                color: 'rgba(255, 255, 255, 0.6)', 
                fontSize: 11, 
                marginLeft: 8, 
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
              }}>
                {itemToShortcut[label]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}


