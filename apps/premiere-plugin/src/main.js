import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider, defaultTheme } from '@adobe/react-spectrum';
import App from './App.js';
import './styles/global.css';
const rootElement = document.getElementById('root');
if (!rootElement)
    throw new Error('Root element not found');
ReactDOM.createRoot(rootElement).render(_jsx(React.StrictMode, { children: _jsx(Provider, { theme: defaultTheme, colorScheme: "dark", scale: "medium", children: _jsx(App, {}) }) }));
