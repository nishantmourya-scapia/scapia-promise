import { Navigate, Route, Routes } from 'react-router-dom'
import ProductListing from './pages/ProductListing'
import ProductView from './pages/ProductView'
import PriceDropAlerts from './pages/PriceDropAlerts'

export default function App() {
  return (
    <div className="flex justify-center"
    style={{
      height: '100dvh',
    }}>
      <div className="w-full max-w-[420px] min-h-screen bg-white shadow-xl rounded-[28px] overflow-hidden relative">
        <Routes>
          <Route path="/" element={<ProductListing />} />
          <Route path="/product/:id" element={<ProductView />} />
          <Route path="/alerts" element={<PriceDropAlerts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}
