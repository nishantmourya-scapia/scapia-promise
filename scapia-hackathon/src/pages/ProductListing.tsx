import { useEffect, useMemo, useState } from 'react'
import { getProducts } from '../api'
import type { ProductDTO } from '../types/product'
import { usePriceMatch } from '../priceMatch'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { BellOutline, Search, SortArrow } from '../components/icons'
import { CoinPill } from '../components/CoinToggle'

type Sort = 'relevance' | 'low' | 'high'

const SORTS: { key: Sort; label: string }[] = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'low', label: 'Price: low to high' },
  { key: 'high', label: 'Price: high to low' },
]

export default function ProductListing() {
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('relevance')
  const [sortOpen, setSortOpen] = useState(false)
  const { drops } = usePriceMatch()
  const alertCount = drops.length

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    getProducts()
      .then((data) => {
        if (!cancelled) setProducts(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = products.filter((p) => !q || p.title.toLowerCase().includes(q))
    if (sort === 'low') out = [...out].sort((a, b) => a.price - b.price)
    if (sort === 'high') out = [...out].sort((a, b) => b.price - a.price)
    return out
  }, [products, query, sort])

  return (
    <div className="h-full bg-white flex flex-col">
      <header className="sticky top-0 z-20 bg-[#f2f1ec] px-4 py-3 flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-2xl bg-white px-4 h-12">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 min-w-0 outline-none text-ink placeholder:text-muted"
          />
          <Search className="w-5 h-5 text-slate-500 shrink-0" />
        </div>
        <Link
          to="/alerts"
          className="relative shrink-0 w-12 h-12 rounded-full border border-slate-300 bg-white grid place-items-center text-ink"
          aria-label="Price drop alerts"
        >
          <BellOutline className="w-6 h-6" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-brand text-[11px] font-semibold text-white">
              {alertCount}
            </span>
          )}
        </Link>
      </header>

      <div className="px-4 pt-4 pb-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <CoinPill />
        <button
          onClick={() => setSortOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-slate-300 px-4 h-11 shrink-0 text-ink"
        >
          Sort <SortArrow />
        </button>
      </div>

      {sortOpen && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setSort(s.key)
                setSortOpen(false)
              }}
              className={`rounded-full px-3 py-1.5 text-sm border ${sort === s.key ? 'bg-brand text-white border-brand' : 'border-slate-300 text-ink'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <main className="h-7/8 px-4 pb-10 grid grid-cols-2 gap-x-4 gap-y-8 overflow-scroll">
        {loading && <p className="col-span-2 py-16 text-center text-muted">Loading products…</p>}
        {!loading && error && (
          <p className="col-span-2 py-16 text-center text-muted">Couldn't load products. Please try again.</p>
        )}
        {!loading &&
          !error &&
          list.map((p) => <ProductCard key={p.id} product={p} />)}
        {!loading && !error && list.length === 0 && (
          <p className="col-span-2 py-16 text-center text-muted">No products found</p>
        )}
      </main>
    </div>
  )
}
