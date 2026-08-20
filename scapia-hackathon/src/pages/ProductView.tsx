import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getProduct } from '../api'
import type { ProductDTO } from '../types/product'
import { inr } from '../data/products'
import { ChevronLeft, Cart, ImagePlaceholder } from '../components/icons'
import { CoinStrip } from '../components/CoinToggle'
import { useCoins } from '../coins'
import { useAnimatedNumber } from '../useAnimatedNumber'
import PriceMatchRow from '../components/PriceMatchRow'

export default function ProductView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { apply, enabled, balance } = useCoins()
  const [product, setProduct] = useState<ProductDTO | null | undefined>(undefined)
  const [error, setError] = useState(false)
  const effective = apply(product?.price ?? 0)
  const shownPrice = useAnimatedNumber(effective.price)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setProduct(undefined)
    setError(false)
    getProduct(id)
      .then((data) => {
        if (!cancelled) setProduct(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <div className="min-h-full bg-white grid place-items-center gap-4 p-8 text-center">
        <p className="text-muted">Couldn't load this product. Please try again.</p>
        <Link to="/" className="rounded-full bg-brand px-6 py-3 text-white font-semibold">
          Back to listing
        </Link>
      </div>
    )
  }

  if (product === undefined) {
    return (
      <div className="min-h-full bg-white grid place-items-center gap-4 p-8 text-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (product === null) {
    return (
      <div className="min-h-full bg-white grid place-items-center gap-4 p-8 text-center">
        <p className="text-muted">Product not found.</p>
        <Link to="/" className="rounded-full bg-brand px-6 py-3 text-white font-semibold">
          Back to listing
        </Link>
      </div>
    )
  }

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="relative">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.title} className="w-full aspect-square object-cover" />
        ) : (
          <div className="w-full aspect-square grid place-items-center bg-slate-50 text-slate-300">
            <ImagePlaceholder className="w-16 h-16" />
          </div>
        )}

        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-12 h-12 rounded-full border border-slate-200 bg-white grid place-items-center text-ink shadow-sm"
          aria-label="Back"
        >
          <ChevronLeft />
        </button>
        <button
          className="absolute top-4 right-4 w-12 h-12 rounded-full border border-slate-200 bg-white grid place-items-center text-ink shadow-sm"
          aria-label="Cart"
        >
          <Cart />
        </button>
      </div>

      <CoinStrip />

      <div className="px-5 pt-5 overflow-scroll h-[250px]">
        <h1 className="text-2xl font-semibold text-ink leading-snug">{product.title}</h1>

        <div className="mt-4">
          <PriceMatchRow productId={product.id} />
        </div>
      </div>

      <footer className="fixed bottom-0 inset-x-0 mx-auto max-w-[420px] bg-white rounded-b-[28px] overflow-hidden border-t border-slate-100">
        <div className="flex items-center gap-4 px-5 py-4 h-30">
          <div className="basis-[40%] grow-0 shrink-0 min-w-0">
            <p className="text-sm text-muted">Get at:</p>
            <p className={`text-2xl font-semibold tabular-nums whitespace-nowrap ${enabled ? 'text-brand' : 'text-ink'}`}>{inr(shownPrice)}</p>
            {/* always rendered so the price never shifts when the toggle flips */}
            <p
              className={`mt-1 block truncate rounded bg-reward px-2 py-0.5 text-xs text-rewardtext ${
                enabled && effective.coinsUsed > 0 ? '' : 'invisible'
              }`}
            >
              using {(effective.coinsUsed || balance).toLocaleString('en-IN')} coins
            </p>
          </div>
          <button className="basis-[60%] rounded-xl bg-brand py-4 text-lg font-semibold whitespace-nowrap text-white active:scale-[0.99] transition">
            Add to cart
          </button>
        </div>
      </footer>
    </div>
  )
}
