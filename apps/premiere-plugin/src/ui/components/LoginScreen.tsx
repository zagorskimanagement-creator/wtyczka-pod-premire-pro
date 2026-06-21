import React, { useState } from 'react';
import { useStore } from '../store/index.js';
import { ApiError } from '../../api/client.js';
import styles from './LoginScreen.module.css';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Connection error. Check your network.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <h1>ShortForge <span>AI</span></h1>
      </div>

      <p className={styles.tagline}>Transform long videos into viral short-form content</p>

      <form className={styles.form} onSubmit={(e) => { void handleSubmit(e); }}>
        <div className={styles.field}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading ? (
            <>
              <span className={styles.spinner} />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <p className={styles.footer}>
        Don't have an account?{' '}
        <a href="https://shortforge.ai/signup" target="_blank" rel="noreferrer">
          Sign up free
        </a>
      </p>
    </div>
  );
}
