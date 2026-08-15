import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useEditor } from './store/editor'
import { useAuth } from './store/auth'

// Sin StrictMode: fabric.js no tolera el doble montaje del canvas en desarrollo.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

if (import.meta.env.DEV) {
  ;(window as any).__bamba = { useEditor, useAuth }
}
