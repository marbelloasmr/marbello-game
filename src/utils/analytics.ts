export type AnalyticsPayload = Record<string, string | number | boolean | null>

type DataLayerWindow = Window & { dataLayer?: AnalyticsPayload[] }

/** Provider-agnostic hook. Connect GA or another sink by reading `window.dataLayer`. */
export function trackEvent(name: string, data: AnalyticsPayload = {}) {
  if (typeof window === "undefined") return
  const host = window as DataLayerWindow
  host.dataLayer = host.dataLayer ?? []
  host.dataLayer.push({ event: name, ...data })
}
