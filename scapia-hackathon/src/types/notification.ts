export type PriceMatchEvent = {
  type: 'PRICE_MATCH'
  watchId: string
  productId: string
  productName: string
  scapiaPrice: number
  dtcPrice: number
  result: 'MATCHED' | 'BEATEN'
  savings: number
  buyUrl: string
  triggeredAt: string
}
