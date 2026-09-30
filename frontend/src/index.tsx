import '@/polyfills';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/index.css';
import 'uplot/dist/uPlot.min.css';
import App from '@/App';
import { AppProvider } from '@/ui/store';

document.documentElement.classList.add('dark');

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
