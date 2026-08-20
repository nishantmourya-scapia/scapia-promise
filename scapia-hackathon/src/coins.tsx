import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export const COINS_PER_RUPEE = 5

type CoinsCtx = {
  balance: number
  enabled: boolean
  toggle: () => void
  /** rupee value of the full coin balance */
  coinValue: number
  /** coins actually usable on this price, and the resulting price */
  apply: (price: number) => { price: number; coinsUsed: number; saved: number }
}

const Ctx = createContext<CoinsCtx | null>(null)

export function CoinsProvider({ children, initialBalance = 5790 }: { children: ReactNode; initialBalance?: number }) {
  const [balance] = useState(initialBalance)
  const [enabled, setEnabled] = useState(false)

  const value = useMemo<CoinsCtx>(() => {
    const coinValue = Math.floor(balance / COINS_PER_RUPEE)
    return {
      balance,
      enabled,
      coinValue,
      toggle: () => setEnabled((v) => !v),
      apply: (price: number) => {
        if (!enabled) return { price, coinsUsed: 0, saved: 0 }
        const saved = Math.min(coinValue, price)
        return { price: price - saved, coinsUsed: saved * COINS_PER_RUPEE, saved }
      },
    }
  }, [balance, enabled])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCoins() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCoins must be used inside <CoinsProvider>')
  return ctx
}
