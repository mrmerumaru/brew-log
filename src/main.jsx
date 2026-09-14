import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Production only: in dev the worker would serve cached assets over Vite's
// hot-reloaded ones, which is a confusing way to lose an afternoon.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // A failed registration just means no offline shell — never block the app.
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
