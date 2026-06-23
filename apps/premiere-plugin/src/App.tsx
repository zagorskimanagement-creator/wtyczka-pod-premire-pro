import { useState, useEffect } from 'react';
import { Dashboard } from './ui/components/Dashboard.js';
import { Editor } from './ui/components/Editor.js';
import { ExportPanel } from './ui/components/ExportPanel.js';
import { Settings } from './ui/components/Settings.js';
import { useStore } from './ui/store/index.js';
import styles from './App.module.css';

type Screen = 'dashboard' | 'editor' | 'export' | 'settings';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('dashboard');
  const { isInitialized, initialize } = useStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!isInitialized) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <span>Loading ShortForge AI...</span>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span>ShortForge <strong>AI</strong></span>
        </div>
        <nav className={styles.nav}>
          <button
            className={`${styles.navBtn} ${activeScreen === 'dashboard' ? styles.active : ''}`}
            onClick={() => setActiveScreen('dashboard')}
            title="Dashboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            className={`${styles.navBtn} ${activeScreen === 'editor' ? styles.active : ''}`}
            onClick={() => setActiveScreen('editor')}
            title="Editor"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            className={`${styles.navBtn} ${activeScreen === 'export' ? styles.active : ''}`}
            onClick={() => setActiveScreen('export')}
            title="Export"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            className={`${styles.navBtn} ${activeScreen === 'settings' ? styles.active : ''}`}
            onClick={() => setActiveScreen('settings')}
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </nav>
      </header>

      <main className={styles.main}>
        {activeScreen === 'dashboard' && <Dashboard onNavigate={setActiveScreen} />}
        {activeScreen === 'editor' && <Editor onNavigate={setActiveScreen} />}
        {activeScreen === 'export' && <ExportPanel onNavigate={setActiveScreen} />}
        {activeScreen === 'settings' && <Settings onNavigate={setActiveScreen} />}
      </main>
    </div>
  );
}
