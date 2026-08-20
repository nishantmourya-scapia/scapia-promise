export type CrawlStatus = 'OK' | 'DEGRADED' | 'FAILED'

export type DtcInfo = {
  dtcSourceId: string
  label: string
  url: string | null
  /** null until at least one crawl_run has been folded in */
  price: number | null
  /** null until at least one crawl_run has been folded in */
  confidence: number | null
  /** null until at least one crawl_run has been folded in */
  lastCrawlStatus: CrawlStatus | null
}

export type ProductDTO = {
  id: string
  title: string
  imageUrl: string | null
  buyUrl: string
  /** Scapia price */
  price: number
  /** null only if the product has no DTC source at all */
  dtc: DtcInfo | null
}
