import React, { useState } from 'react';
import { useStore } from '../store/index.js';
import styles from './Settings.module.css';

interface SettingsProps {
  onNavigate: (screen: 'editor' | 'export' | 'settings' | 'dashboard') => void;
}

export function Settings({ onNavigate: _ }: SettingsProps) {
  const { user, logout } = useStore();
  const [apiUrl, setApiUrl] = useState(
    import.meta.env['VITE_API_URL'] as string ?? 'http://localhost:3001/api/v1',
  );

  return (
    <div className={`${styles.container} scrollable`}>
      <h2 className={styles.title}>Settings</h2>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Account</h3>
        <div className={styles.userCard}>
          <div className={styles.avatar}>{user?.email?.[0]?.toUpperCase() ?? 'U'}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name ?? user?.email}</span>
            <span className={styles.userEmail}>{user?.email}</span>
            <span className={styles.userRole}>{user?.role} Plan</span>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={logout}>
          Sign Out
        </button>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>API Configuration</h3>
        <div className={styles.field}>
          <label>API Server URL</label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:3001/api/v1"
          />
          <span className={styles.fieldHint}>Change this to point to your ShortForge API server</span>
        </div>
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
          <a href="https://shortforge.ai/changelog" target="_blank" rel="noreferrer" className={styles.link}>
            Changelog
          </a>
        </div>
      </div>
    </div>
  );
}
