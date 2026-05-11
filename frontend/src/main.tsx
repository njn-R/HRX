import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Configure Monaco to use local bundle (no CDN requests - HIPAA compliant)
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
loader.config({ monaco })

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
