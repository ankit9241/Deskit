import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/index.css';
import { isTauri } from './services/tauriApi';

if (isTauri()) {
  document.documentElement.classList.add('is-tauri');
  document.body.classList.add('is-tauri');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
