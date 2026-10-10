/**
 * Punto de entrada de la app incrustada en Shopify.
 *
 * Separado del de Mikro a proposito: aqui no hay AuthProvider ni rutas, porque
 * a quien entra lo identifica Shopify. Lo unico que comparte es el CSS.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ShopifyApp from './pages/ShopifyApp'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ShopifyApp />
    </BrowserRouter>
  </React.StrictMode>,
)
