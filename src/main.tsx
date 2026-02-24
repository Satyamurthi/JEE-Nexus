import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("FATAL: Root element not found");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <App />
    );
    
    // Register PWA Service Worker for performance gains on weak networks
    serviceWorkerRegistration.register();
    
    // Clean up initial loader after a small delay to ensure React has painted
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 400);
        }
        if ((window as any)._bootTimer) clearTimeout((window as any)._bootTimer);
    }, 100);
    
  } catch (err) {
    console.error("FAILED TO RENDER APP:", err);
    rootElement.innerHTML = `
      <div style="padding: 40px; color: #1e293b; font-family: sans-serif; text-align: center; background: #f8fafc; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div style="background: #fee2e2; padding: 20px; border-radius: 20px; border: 1px solid #fecaca; max-width: 400px;">
            <h2 style="color: #991b1b; margin-top: 0;">Boot Error</h2>
            <p style="font-size: 14px; color: #7f1d1d; line-height: 1.5;">The application could not initialize. This is usually caused by a critical script failing to load on a weak network.</p>
            <button onclick="window.location.reload()" style="background: #991b1b; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; margin-top: 10px;">RETRY CONNECTION</button>
            <pre style="margin-top: 20px; font-size: 10px; text-align: left; background: rgba(0,0,0,0.05); padding: 10px; overflow-x: auto; border-radius: 8px;">${err instanceof Error ? err.stack : String(err)}</pre>
        </div>
      </div>
    `;
  }
}