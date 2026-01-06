
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("FATAL: Root element not found");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // Register PWA Service Worker
    serviceWorkerRegistration.register();
  } catch (err) {
    console.error("FAILED TO RENDER APP:", err);
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; font-family: sans-serif;">
        <h2>Application Crash During Initialization</h2>
        <pre>${err instanceof Error ? err.message : String(err)}</pre>
      </div>
    `;
  }
}
