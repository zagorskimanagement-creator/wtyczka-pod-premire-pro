import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useStore } from '../store/index.js';
import styles from './Settings.module.css';
export function Settings({ onNavigate: _ }) {
    const { anthropicApiKey, setAnthropicApiKey } = useStore();
    const [keyInput, setKeyInput] = useState(anthropicApiKey ?? '');
    const [showKey, setShowKey] = useState(false);
    const [saved, setSaved] = useState(false);
    const handleSave = () => {
        setAnthropicApiKey(keyInput.trim() || null);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };
    return (_jsxs("div", { className: `${styles.container} scrollable`, children: [_jsx("h2", { className: styles.title, children: "Settings" }), _jsxs("div", { className: styles.section, children: [_jsx("h3", { className: styles.sectionTitle, children: "AI Configuration" }), _jsxs("div", { className: styles.field, children: [_jsx("label", { children: "Anthropic API Key" }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("input", { type: showKey ? 'text' : 'password', value: keyInput, onChange: (e) => setKeyInput(e.target.value), placeholder: "sk-ant-...", style: { flex: 1 } }), _jsx("button", { onClick: () => setShowKey((v) => !v), style: { padding: '0 10px', background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--sf-text-2)' }, children: showKey ? 'Hide' : 'Show' })] }), _jsx("span", { className: styles.fieldHint, children: "Get your key at console.anthropic.com \u2014 used for local AI analysis, never sent to our servers." })] }), _jsx("button", { className: styles.logoutBtn, style: { background: saved ? 'var(--sf-success)' : undefined, marginTop: 8 }, onClick: handleSave, children: saved ? 'Saved!' : 'Save API Key' })] }), _jsxs("div", { className: styles.section, children: [_jsx("h3", { className: styles.sectionTitle, children: "About" }), _jsxs("div", { className: styles.aboutInfo, children: [_jsxs("div", { className: styles.aboutRow, children: [_jsx("span", { children: "Version" }), _jsx("span", { children: "1.0.0" })] }), _jsxs("div", { className: styles.aboutRow, children: [_jsx("span", { children: "Plugin ID" }), _jsx("span", { children: "com.shortforge.ai" })] }), _jsxs("div", { className: styles.aboutRow, children: [_jsx("span", { children: "Supported" }), _jsx("span", { children: "Premiere Pro 23.0+" })] })] })] }), _jsxs("div", { className: styles.section, children: [_jsx("h3", { className: styles.sectionTitle, children: "Support" }), _jsxs("div", { className: styles.linkList, children: [_jsx("a", { href: "https://shortforge.ai/docs", target: "_blank", rel: "noreferrer", className: styles.link, children: "Documentation" }), _jsx("a", { href: "https://shortforge.ai/support", target: "_blank", rel: "noreferrer", className: styles.link, children: "Contact Support" })] })] })] }));
}
