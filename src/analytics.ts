type AnalyticsParams = Record<string, string | number | boolean>

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: AnalyticsParams) => void
  }
}

export function track(eventName: string, params?: AnalyticsParams): void {
  if (typeof window === 'undefined') return
  window.gtag?.('event', eventName, params)
}
