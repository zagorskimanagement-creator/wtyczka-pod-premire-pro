import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useStore } from '../store/index.js';
import { ApiError } from '../../api/client.js';
import styles from './LoginScreen.module.css';
export function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const login = useStore((s) => s.login);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(email, password);
        }
        catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            }
            else {
                setError('Connection error. Check your network.');
            }
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsxs("div", { className: styles.container, children: [_jsxs("div", { className: styles.logo, children: [_jsx("svg", { width: "40", height: "40", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" }) }), _jsxs("h1", { children: ["ShortForge ", _jsx("span", { children: "AI" })] })] }), _jsx("p", { className: styles.tagline, children: "Transform long videos into viral short-form content" }), _jsxs("form", { className: styles.form, onSubmit: (e) => { void handleSubmit(e); }, children: [_jsxs("div", { className: styles.field, children: [_jsx("label", { children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com", required: true, autoComplete: "email" })] }), _jsxs("div", { className: styles.field, children: [_jsx("label", { children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", required: true, autoComplete: "current-password" })] }), error && _jsx("p", { className: styles.error, children: error }), _jsx("button", { type: "submit", className: styles.submitBtn, disabled: isLoading, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx("span", { className: styles.spinner }), "Signing in..."] })) : ('Sign In') })] }), _jsxs("p", { className: styles.footer, children: ["Don't have an account?", ' ', _jsx("a", { href: "https://shortforge.ai/signup", target: "_blank", rel: "noreferrer", children: "Sign up free" })] })] }));
}
