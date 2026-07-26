import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RootErrorBoundary } from './app/RootErrorBoundary.tsx'
import { installGlobalFailureCollector } from './app/globalCollector.ts'

installGlobalFailureCollector() // FR-019: handler/timer/callback/promessa rejeitada nunca ficam mudos

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
