import { Link, useNavigate } from 'react-router-dom'
import { inr } from '../data/products'
import { ChevronLeft, BellOutline, Close } from '../components/icons'
import { usePriceMatch } from '../priceMatch'

export default function PriceDropAlerts() {
  const navigate = useNavigate()
  // Only products the socket has pushed a drop for. Opting in alone shows nothing here —
  // in the real app the drop itself arrives as a push notification / email.
  const { drops, clearDrop } = usePriceMatch()

  return (
    <div className="min-h-full bg-white flex flex-col">
      <header className="sticky top-0 z-20 bg-[#f2f1ec] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="shrink-0 w-12 h-12 rounded-full border border-slate-300 bg-white grid place-items-center text-ink"
          aria-label="Back"
        >
          <ChevronLeft />
        </button>
        <h1 className="text-lg font-semibold text-ink">Price drops</h1>
      </header>

      {drops.length === 0 ? (
        <div className="flex-1 grid place-items-center px-10 text-center">
          <div>
            <BellOutline className="mx-auto w-10 h-10 text-slate-300" />
            <p className="mt-3 font-semibold text-ink">No price drops yet</p>
            <p className="mt-1 text-sm text-muted">
              Products you've opted into show up here the moment we drop the price.
            </p>
            <Link to="/" className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white">
              Browse products
            </Link>
          </div>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-slate-100 px-4">
          {drops.map((drop) => (
            <li key={drop.watchId} className="flex items-center gap-3 py-3">
              <Link to={`/product/${drop.productId}`} className="min-w-0 flex-1 flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{drop.productName}</span>
                  <span className="block truncate text-sm text-muted">
                    {drop.result === 'BEATEN' ? 'We beat the price' : 'Price matched'}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="text-sm font-semibold text-emerald-700">{inr(drop.scapiaPrice)}</span>
                    <span className="text-sm text-muted line-through">{inr(drop.dtcPrice)}</span>
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  ↓ {inr(drop.savings)}
                </span>
              </Link>
              <button
                onClick={() => clearDrop(drop.watchId)}
                aria-label="Clear notification"
                className="shrink-0 w-8 h-8 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <Close />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
