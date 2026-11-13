import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../shared/index.css'
import App from '../shared/App.tsx'
import '../config/firebase.ts'
import ApiLoadingIndicator from '../shared/components/ApiLoadingIndicator.tsx'
import { installApiLoading } from '../shared/funtion/apiLoading.ts'
import LegalCenter from '../shared/components/LegalCenter.tsx'

installApiLoading()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <ApiLoadingIndicator />
      <LegalCenter />
    </BrowserRouter>
  </StrictMode>,
)
