import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Health check endpoint for load balancer
if (window.location.pathname === '/health') {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <div>healthy</div>
  )
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
