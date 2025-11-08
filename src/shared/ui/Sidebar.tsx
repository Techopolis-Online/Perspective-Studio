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
    <nav aria-label="Navigation" className="sidebar">
      <h1 className="sidebar-title">Perspective Studio</h1>
      <ul className="sidebar-list">
        {items.map((label) => (
          <li key={label}>
            <button
              aria-current={current === label ? 'page' : undefined}
              aria-label={label}
              onClick={() => onNavigate(label)}
              className="sidebar-button"
            >
              <span>{label}</span>
              {shortcutFor(label) && (
                <span
                  aria-hidden="true"
                  title={`Shortcut: ${shortcutFor(label)}`}
                  className="kbd"
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


