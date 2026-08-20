export type WatchDTO = {
  id: string
  userId: string
  productId: string
  status: string
  lastResult: string | null
  currentScapiaPrice: number
  currentDtcPrice: number
  triggeredScapiaPrice: number | null
  triggeredDtcPrice: number | null
  createdAt: string
  triggeredAt: string | null
}
