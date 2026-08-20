import { Link } from 'react-router-dom'
import type { ProductDTO } from '../types/product'
import { inr } from '../data/products'
import { ImagePlaceholder, Delivery } from './icons'
import { useCoins } from '../coins'
import { useAnimatedNumber } from '../useAnimatedNumber'

export default function ProductCard({ product }: { product: ProductDTO }) {
  const { apply, enabled } = useCoins()
  const { price, saved } = apply(product.price)
  const shown = useAnimatedNumber(price)

  return (
    <div className="flex flex-col gap-2">
      <Link
        to={`/product/${product.id}`}
        className="relative block rounded-2xl border border-slate-200 bg-white overflow-hidden aspect-square"
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center bg-slate-50 text-slate-300">
            <ImagePlaceholder className="w-10 h-10" />
          </div>
        )}
      </Link>

      <Link to={`/product/${product.id}`} className="block">
        <h3 className="text-lg font-semibold text-ink leading-tight line-clamp-2">{product.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`font-semibold tabular-nums transition-colors ${enabled ? 'text-brand' : 'text-ink'}`}>
            {inr(shown)}
          </span>
          {enabled && saved > 0 && (
            <span className="rounded-md bg-brand px-1.5 py-0.5 text-xs font-semibold text-white">
              {Math.round((saved / product.price) * 100)}% off
            </span>
          )}
        </div>
      </Link>

      <p className="flex items-center gap-1.5 text-emerald-600 font-medium">
        <Delivery className="w-5 h-5" />
        Free delivery
      </p>
    </div>
  )
}
