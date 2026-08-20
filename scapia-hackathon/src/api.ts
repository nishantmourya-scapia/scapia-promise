import type { ProductDTO } from './types/product'
import type { WatchDTO } from './types/watch'
import { getUserId } from './user'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** GET /api/products */
export async function getProducts(): Promise<ProductDTO[]> {
  const res = await fetch('/api/products')
  if (!res.ok) throw new ApiError(`GET /api/products failed`, res.status)
  return res.json()
}

/** GET /api/products/{id} — resolves to null on 404. */
export async function getProduct(id: string): Promise<ProductDTO | null> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError(`GET /api/products/${id} failed`, res.status)
  return res.json()
}

/** POST /api/watches — tell the backend to watch this product's price for the user. */
export async function requestPriceMatch(productId: string): Promise<WatchDTO> {
  const res = await fetch('/api/watches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: getUserId(), productId }),
  })
  if (!res.ok) throw new ApiError('POST /api/watches failed', res.status)
  return res.json()
}
