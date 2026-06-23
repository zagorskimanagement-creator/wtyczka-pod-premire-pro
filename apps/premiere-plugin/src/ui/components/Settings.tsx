import { useState } from 'react';
import { useStore } from '../store/index.js';
import styles from './Settings.module.css';

interface SettingsProps {
  onNavigate: (screen: 'editor' | 'export' | 'settings' | 'dashboard') => void;
}

export function Settings({ onNavigate: _ }: SettingsProps) {
  const { anthropicApiKey, setAnthropicApiKey } = useStore();
  const [keyInput, setKeyInput] = useState(anthropicApiKey ?? '');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setAnthropicApiKey(keyInput.trim() || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={`${styles.container} scrollable`}>
      <h2 className={styles.title}>Settings</h2>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>AI Configuration</h3>
        <div className={styles.field}>
          <label>Anthropic API Key</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              style={{ flex: 1 }}
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              style={{ padding: '0 10px', background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--sf-text-2)' }}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <span className={styles.fieldHint}>
            Get your key at console.anthropic.com — used for local AI analysis, never sent to our servers.
          </span>
        </div>
        <button
          className={styles.logoutBtn}
          style={{ background: saved ? 'var(--sf-success)' : undefined, marginTop: 8 }}
          onClick={handleSave}
        >
          {saved ? 'Saved!' : 'Save API Key'}
        </button>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>About</h3>
        <div className={styles.aboutInfo}>
          <div className={styles.aboutRow}>
            <span>Version</span>
            <span>1.0.0</span>
          </div>
          <div className={styles.aboutRow}>
            <span>Plugin ID</span>
            <span>com.shortforge.ai</span>
          </div>
          <div className={styles.aboutRow}>
            <span>Supported</span>
            <span>Premiere Pro 23.0+</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Support</h3>
        <div className={styles.linkList}>
          <a href="https://shortforge.ai/docs" target="_blank" rel="noreferrer" className={styles.link}>
            Documentation
          </a>
          <a href="https://shortforge.ai/support" target="_blank" rel="noreferrer" className={styles.link}>
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
