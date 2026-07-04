import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App';
import reportWebVitals from './reportWebVitals';
import ContextProvider from './context';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Disable StrictMode in development to prevent WalletConnect Core duplication
const isDevelopment = process.env.NODE_ENV === 'development';

root.render(
  isDevelopment ? (
    <ContextProvider>
      <App />
      <Analytics />
      <SpeedInsights />
    </ContextProvider>
  ) : (
    <React.StrictMode>
      <ContextProvider>
        <App />
      </ContextProvider>
    </React.StrictMode>
  )
);

reportWebVitals(); 