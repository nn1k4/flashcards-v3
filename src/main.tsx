import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';

// Глобальная обработка ошибок
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
