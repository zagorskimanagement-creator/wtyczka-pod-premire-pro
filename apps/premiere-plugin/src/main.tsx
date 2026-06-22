import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider, defaultTheme } from '@adobe/react-spectrum';
import App from './App.js';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Provider theme={defaultTheme} colorScheme="dark" scale="medium">
      <App />
    </Provider>
  </React.StrictMode>,
);
