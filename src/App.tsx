import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './shared/ui/Sidebar';
import ChatPage from './features/chat/pages/ChatPage';
import CatalogPage from './features/catalog/pages/CatalogPage';
import DownloadsPage from './features/downloads/pages/DownloadsPage';
import SettingsPage from './features/settings/pages/SettingsPage';
import OnboardingPage from './features/onboarding/pages/OnboardingPage';

type View = 'Chat' | 'Catalog' | 'Downloads' | 'Settings' | 'Onboarding';

export default function App() {
  const [view, setView] = useState<View>('Catalog');
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const s = await window.api.settings.get();
      setSettings(s);
      if (s.firstRun) setView('Onboarding');
    })();
    const off = window.api.settings.onChanged((s: any) => {
      setSettings(s);
      if (s.firstRun) setView('Onboarding');
    });
    return () => off && off();
  }, []);

  useEffect(() => {
    if (!window.api?.menu) return;
    const offNavigate = window.api.menu.onNavigate((v: 'Chat' | 'Catalog' | 'Downloads' | 'Settings') => {
      setView(v as View);
    });
    const offNewChat = window.api.menu.onNewChat(() => {
      setView('Chat');
      window.dispatchEvent(new CustomEvent('app:new-chat'));
    });
    const offOpenChat = window.api.menu.onOpenChat((id: string) => {
      setView('Chat');
      window.dispatchEvent(new CustomEvent('app:open-chat', { detail: id }));
    });
    return () => {
      offNavigate && offNavigate();
      offNewChat && offNewChat();
      offOpenChat && offOpenChat();
    };
  }, []);

  useEffect(() => {
    // Keyboard shortcuts for navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+1 through Ctrl+4 for navigation
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setView('Chat');
            break;
          case '2':
            e.preventDefault();
            setView('Catalog');
            break;
          case '3':
            e.preventDefault();
            setView('Downloads');
            break;
          case '4':
            e.preventDefault();
            setView('Settings');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const content = useMemo(() => {
    if (!settings) return <div style={{ padding: 16, color: 'white' }}>Loading…</div>;
    if (view === 'Onboarding') return <OnboardingPage onDone={() => setView('Catalog')} />;
    switch (view) {
      case 'Chat':
        return <ChatPage />;
      case 'Catalog':
        return <CatalogPage />;
      case 'Downloads':
        return <DownloadsPage />;
      case 'Settings':
        return <SettingsPage />;
      default:
        return null;
    }
  }, [view, settings]);

  return (
    <div className="app">
      <Sidebar current={view} onNavigate={(v) => setView(v as View)} />
      <div className="app-content">{content}</div>
    </div>
  );
}




