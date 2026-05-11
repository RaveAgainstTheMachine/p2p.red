import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AdminApp } from './admin/AdminApp.tsx'
import './index.css'

const isAdminHost = typeof window !== 'undefined' && window.location.hostname === 'dash.example.com';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminHost ? <AdminApp /> : <App />}
  </React.StrictMode>
)
