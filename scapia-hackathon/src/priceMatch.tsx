import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { requestPriceMatch } from './api'
import { subscribeToPriceDrops } from './priceDropSocket'
import type { PriceMatchEvent } from './types/notification'
import { getUserId } from './user'

const STORAGE_KEY = 'priceMatch:requested'
const DROPS_KEY = 'priceMatch:drops'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode — in-memory state still works for this session */
  }
}

type WatchStatus = 'ACTIVE' | 'FULFILLED'

type WatchRecord = {
  status: WatchStatus
  /** Scapia price at the moment the user opted in */
  subscribedPrice: number
  /** Scapia price once the match triggered — only set once status is FULFILLED */
  matchedPrice?: number
  /** whether we matched the cheaper price or beat it — only set once status is FULFILLED */
  result?: 'MATCHED' | 'BEATEN'
}

function isWatchRecord(value: unknown): value is WatchRecord {
  return !!value && typeof value === 'object' && 'status' in value && 'subscribedPrice' in value
}

function readStored(): Record<string, WatchRecord> {
  const parsed = read<unknown>(STORAGE_KEY, {})
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const out: Record<string, WatchRecord> = {}
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (isWatchRecord(value)) out[id] = value
  }
  return out
}

/** Drops are persisted so they survive a refresh, since the socket only pushes each once. */
function readDrops(): PriceMatchEvent[] {
  const parsed = read<unknown>(DROPS_KEY, [])
  return Array.isArray(parsed) ? (parsed as PriceMatchEvent[]) : []
}

type Ctx = {
  /** productId -> watch record, restored from localStorage on boot */
  requested: Record<string, WatchRecord>
  getWatch: (productId: string) => WatchRecord | null
  /** hits the backend, then persists locally. Throws so the caller can show an error. */
  request: (productId: string) => Promise<void>
  /** PRICE_MATCH events pushed over the socket, newest first */
  drops: PriceMatchEvent[]
  /** dismisses a single notification */
  clearDrop: (watchId: string) => void
}

const PriceMatchCtx = createContext<Ctx | null>(null)

export function PriceMatchProvider({ children }: { children: ReactNode }) {
  const [requested, setRequested] = useState<Record<string, WatchRecord>>(readStored)
  const [drops, setDrops] = useState<PriceMatchEvent[]>(readDrops)

  // persist opt-ins
  useEffect(() => write(STORAGE_KEY, requested), [requested])

  // persist drops so a refresh doesn't blank the alerts screen
  useEffect(() => write(DROPS_KEY, drops), [drops])

  // keep other tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setRequested(readStored())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // open the notifications socket once, on site load
  useEffect(() => {
    return subscribeToPriceDrops(getUserId(), (event) => {
      setDrops((prev) => [event, ...prev.filter((d) => d.productId !== event.productId)])
      // the watch has triggered — the promise is met, keep the before/after price around
      setRequested((prev) => ({
        ...prev,
        [event.productId]: {
          status: 'FULFILLED',
          subscribedPrice: prev[event.productId]?.subscribedPrice ?? event.scapiaPrice + event.savings,
          matchedPrice: event.scapiaPrice,
          result: event.result,
        },
      }))
    })
  }, [])

  const request = useCallback(async (productId: string) => {
    const watch = await requestPriceMatch(productId)
    setRequested((prev) =>
      prev[productId] ? prev : { ...prev, [productId]: { status: 'ACTIVE', subscribedPrice: watch.currentScapiaPrice } },
    )
  }, [])

  const clearDrop = useCallback(
    (watchId: string) => {
      const drop = drops.find((d) => d.watchId === watchId)
      setDrops((prev) => prev.filter((d) => d.watchId !== watchId))
      if (drop) {
        // dismissing the notification also resets the product back to its unwatched state
        setRequested((prev) => {
          const { [drop.productId]: _removed, ...rest } = prev
          return rest
        })
      }
    },
    [drops],
  )

  const value = useMemo<Ctx>(
    () => ({
      requested,
      drops,
      getWatch: (id: string) => requested[id] ?? null,
      request,
      clearDrop,
    }),
    [requested, drops, request, clearDrop],
  )

  return <PriceMatchCtx.Provider value={value}>{children}</PriceMatchCtx.Provider>
}

export function usePriceMatch() {
  const ctx = useContext(PriceMatchCtx)
  if (!ctx) throw new Error('usePriceMatch must be used inside <PriceMatchProvider>')
  return ctx
}
