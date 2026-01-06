import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import './index.css'
import App from './App.tsx'
import { initDatadog } from './utils/datadog';
import { Toaster } from './components/ui/toaster';

import { DatadogErrorBoundary } from './components/DatadogErrorBoundary';

// Initialize Datadog RUM
initDatadog();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DatadogErrorBoundary>
      <App />
      <Toaster />
    </DatadogErrorBoundary>
  </StrictMode>,
)
