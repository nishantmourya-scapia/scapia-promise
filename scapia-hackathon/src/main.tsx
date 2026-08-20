import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { CoinsProvider } from './coins'
import { PriceMatchProvider } from './priceMatch'
import { getUserId } from './user'
import './index.css'

getUserId()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CoinsProvider>
        <PriceMatchProvider>
          <App />
        </PriceMatchProvider>
      </CoinsProvider>
    </BrowserRouter>
  </StrictMode>,
)
