import "reflect-metadata";

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error("Error caught by an error boundary:", error, errorInfo.componentStack);
  },
  onUncaughtError: (error, errorInfo) => {
    console.error("Uncaught React error:", error, errorInfo.componentStack);
  },
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
