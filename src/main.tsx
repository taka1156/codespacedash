import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { IS_STATIC_PREVIEW } from './lib/preview';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

if (!IS_STATIC_PREVIEW && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((e) => {
    console.warn('Service Worker registration failed', e);
  });
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
