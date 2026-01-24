
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { storageService } from './services/storageService';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Immediate title update from storage to avoid flicker
const config = storageService.getConfig();
if (config.browserTitle) {
  document.title = config.browserTitle;
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
