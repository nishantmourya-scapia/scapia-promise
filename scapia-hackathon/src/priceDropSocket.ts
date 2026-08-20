import type { PriceMatchEvent } from './types/notification'

type Handler = (event: PriceMatchEvent) => void

/**
 * Opens WS /ws/notifications?userId={userId} and forwards PRICE_MATCH pushes.
 * Returns a function that closes the connection.
 */
export function subscribeToPriceDrops(userId: string, onEvent: Handler) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/ws/notifications?userId=${encodeURIComponent(userId)}`)

  ws.onmessage = (e) => {
    let data: unknown
    try {
      data = JSON.parse(e.data)
    } catch {
      return
    }
    if ((data as { type?: string })?.type === 'PRICE_MATCH') onEvent(data as PriceMatchEvent)
  }

  return () => ws.close()
}
