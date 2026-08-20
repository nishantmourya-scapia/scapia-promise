import { useState } from 'react'
import { usePriceMatch } from '../priceMatch'
import { inr } from '../data/products'

export default function PriceMatchRow({ productId }: { productId: string }) {
  const { getWatch, request } = usePriceMatch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const watch = getWatch(productId)
  const subscribed = watch?.status === 'ACTIVE'
  const fulfilled = watch?.status === 'FULFILLED'
  const settled = subscribed || fulfilled

  const subscribe = async () => {
    if (settled || loading) return
    setLoading(true)
    setError(false)
    try {
      await request(productId)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={subscribe}
        disabled={settled || loading}
        aria-pressed={settled}
        aria-busy={loading}
        className="relative isolate w-full flex flex-col gap-1.5 overflow-hidden disabled:cursor-default bg-gradient-to-r from-[#fdeae4] via-[#fdeee4] to-[#fdf1e0] px-4 py-3 text-left"
      >
        {/* green wash wipes in from the left once opted in */}
        <span
          aria-hidden
          className={`absolute inset-0 -z-10 origin-left bg-gradient-to-r from-[#dff5e3] via-[#e6f7e8] to-[#f0faee] transition-transform duration-500 ease-out ${settled ? 'scale-x-100' : 'scale-x-0'
            }`}
        />

        <span className="flex items-center gap-1.5">
          <img
            src="https://res.cloudinary.com/scapiacards/image/upload/v1658482712/scapia_bcnzcq.png"
            alt="Scapia"
            className="h-3.5 w-auto"
          />
          <span className="font-serif italic text-ink text-sm leading-none">promise</span>
        </span>

        <span aria-hidden className="h-px w-full bg-ink/10" />

        <span className="flex items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 min-h-16">
            <span className={`text-sm font-bold transition-colors duration-500 ${settled ? 'text-emerald-700' : 'text-brand'}`}>
              {fulfilled ? (
                watch?.result === 'BEATEN' ? 'Promise kept — we beat it!' : 'Promise kept — we matched it!'
              ) : subscribed ? (
                'Price match is on for this product'
              ) : (
                <>
                  Seen it cheaper elsewhere?
                  <br />
                  We'll match it
                </>
              )}
            </span>
            {fulfilled && watch ? (
              <span className="flex items-center gap-2">
                <span className="text-sm text-emerald-700/70 line-through">{inr(watch.subscribedPrice)}</span>
                <span className="text-sm font-semibold text-emerald-700">{inr(watch.matchedPrice ?? watch.subscribedPrice)}</span>
              </span>
            ) : (
              <span className={`text-xs font-medium transition-colors duration-500 ${settled ? 'text-emerald-700/70' : 'text-brand/65'}`}>
                {error
                  ? "Couldn't set that up — tap to try again"
                  : loading
                    ? 'Setting up your price match…'
                    : subscribed
                      ? "We'll notify you the moment we drop the price"
                      : 'Opt in to get notified when we drop the price'}
              </span>
            )}
          </span>

          <span className="relative grid h-12 w-12 shrink-0 place-items-center">
            {/* bell + sound waves: quick idle rattle, spins out on subscribe */}
            <span
              className={`absolute grid h-11 w-11 place-items-center transition-all duration-200 ${settled || loading ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
                }`}
            >
              <Waves className={`absolute h-11 w-11 text-[#ffb800] ${settled ? '' : 'animate-bell-waves'}`} />
              <Bell className={`h-8 w-8 text-[#ffb800] ${settled ? '' : 'animate-bell-shake'}`} />
            </span>

            {/* in-flight spinner */}
            <Spinner
              className={`absolute h-8 w-8 text-[#ffb800] transition-opacity duration-200 ${loading ? 'opacity-100' : 'opacity-0'
                }`}
            />

            {/* tick: springs in, stroke draws itself — confirms the opt-in */}
            <Tick
              drawn={subscribed && !fulfilled}
              className={`absolute h-8 w-8 text-emerald-600 transition-all duration-300 ${subscribed && !fulfilled ? 'scale-100 rotate-0 opacity-100 animate-tick-pop' : 'scale-0 -rotate-90 opacity-0'
                }`}
            />

            {/* trending-down: replaces the tick once the price has actually dropped */}
            <TrendingDown
              className={`absolute h-8 w-8 text-emerald-600 transition-opacity duration-200 ${fulfilled ? 'opacity-100' : 'opacity-0'
                }`}
            />
          </span>
        </span>
      </button>
    </div>
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function Bell({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8.5a6 6 0 1 0-12 0c0 4.2-1.2 5.9-2 6.7-.4.4-.1 1.1.5 1.1h15c.6 0 .9-.7.5-1.1-.8-.8-2-2.5-2-6.7z" />
      <path d="M9.6 19a2.5 2.5 0 0 0 4.8 0z" />
    </svg>
  )
}

/** Ringing arcs either side of the bell, pulsing outward. */
function Waves({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeLinecap="round">
      <g strokeWidth="1.7">
        <path className="wave wave-1" d="M12 15.5a8 8 0 0 0 0 9" />
        <path className="wave wave-1" d="M32 15.5a8 8 0 0 1 0 9" />
      </g>
      <g strokeWidth="1.5">
        <path className="wave wave-2" d="M7.5 12.5a13.5 13.5 0 0 0 0 15" />
        <path className="wave wave-2" d="M36.5 12.5a13.5 13.5 0 0 1 0 15" />
      </g>
    </svg>
  )
}

function TrendingDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 7l7 7 4-4 7 7M16 17h5v-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Tick({ drawn, className }: { drawn: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M7.3 12.4l3.2 3.1 6.2-6.6"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={drawn ? 0 : 1}
        className="transition-[stroke-dashoffset] duration-500 delay-150 ease-out"
      />
    </svg>
  )
}
