import React from 'react';

type Props = {
  current: string;
  onNavigate: (view: string) => void;
};

const items = ['Chat', 'Catalog', 'Downloads', 'Settings'];

export default function Sidebar({ current, onNavigate }: Props) {
  const shortcutFor = (label: string) => {
    switch (label) {
      case 'Chat':
        return 'Ctrl+1';
      case 'Catalog':
        return 'Ctrl+2';
      case 'Downloads':
        return 'Ctrl+3';
      case 'Settings':
        return 'Ctrl+4';
      default:
        return undefined;
    }
  };

  return (
    <nav aria-label="Navigation" style={{ 
      width: 180, 
      borderRight: '1px solid rgba(99, 102, 241, 0.2)', 
      padding: 8,
      background: 'rgba(15, 23, 42, 0.5)'
    }}>
      <h1 style={{ fontSize: 16, margin: '8px 8px 12px', color: 'white' }}>Perspective Studio</h1>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((label) => (
          <li key={label}>
            <button
              aria-current={current === label ? 'page' : undefined}
              aria-label={label}
              onClick={() => onNavigate(label)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: current === label ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                border: current === label ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                padding: '8px 10px',
                margin: '4px 6px',
                cursor: 'pointer',
                color: 'white',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
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
              {shortcutFor(label) && (
                <span
                  aria-hidden="true"
                  title={`Shortcut: ${shortcutFor(label)}`}
                  style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: 11,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    marginLeft: 8,
                  }}
                >
                  {shortcutFor(label)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}


