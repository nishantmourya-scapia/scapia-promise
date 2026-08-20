import { useCoins } from '../coins'

const COIN_IMG =
  'https://res.cloudinary.com/scapiacards/image/upload/v1767673217/spitha_prod_uploads/2026_01/coins_1767673216936.webp'

const Coin = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <img src={COIN_IMG} alt="" className={`${className} shrink-0 object-contain`} />
)

/** Small pill used in the listing header. */
export function CoinPill() {
  const { balance, enabled, toggle } = useCoins()
  return (
    <button
      onClick={toggle}
      aria-pressed={enabled}
      className="flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-[#eef3ff] to-[#fdeee8] pl-2.5 pr-1.5 h-10"
    >
      <Coin className="w-10 h-10" />
      <span className="whitespace-nowrap text-sm font-semibold text-rewardtext">
        {balance.toLocaleString('en-IN')} coins
      </span>
      <Switch on={enabled} />
    </button>
  )
}

/** Full-width strip used on the product page. */
export function CoinStrip() {
  const { balance, enabled, toggle } = useCoins()
  return (
    <button
      onClick={toggle}
      aria-pressed={enabled}
      className="w-full flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-[#eef3ff] to-[#fdeee8]"
    >
      <Tag className="w-5 h-5 shrink-0" />
      <span className="text-sm font-semibold text-ink">Price after using your</span>
      <Coin className="w-10 h-10 shrink-0" />
      <span className="text-sm font-semibold text-rewardtext">{balance.toLocaleString('en-IN')} coins</span>
      <Switch on={enabled} className="ml-auto" />
    </button>
  )
}

function Switch({ on, className = '' }: { on: boolean; className?: string }) {
  return (
    <span
      className={`relative block h-6 w-11 shrink-0 self-center rounded-full transition-colors ${on ? 'bg-brand' : 'bg-slate-300'} ${className}`}
    >
      <span
        className={`absolute top-1/2 left-0.5 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </span>
  )
}

function Tag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#2f6fed">
      <path d="M11.6 2.6 21 12l-9 9-9.4-9.4A2 2 0 0 1 2 10.2V4a2 2 0 0 1 2-2h6.2a2 2 0 0 1 1.4.6z" />
      <circle cx="6.5" cy="6.5" r="1.6" fill="#fff" />
    </svg>
  )
}
