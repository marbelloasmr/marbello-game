/**
 * Prototype subscriber bonus.
 * Replace `activatePrototypeBonus` later with Google OAuth + YouTube Data API.
 * Score code should only call `getMultiplier()`.
 */
const STORAGE_KEY = "marbello-sub-bonus-v3"

type Listener = () => void

const listeners = new Set<Listener>()

function readVerified() {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(STORAGE_KEY) === "1"
}

function emit() {
  for (const listener of listeners) listener()
}

export const SubscriberBonusService = {
  isVerified() {
    return readVerified()
  },
  activatePrototypeBonus() {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, "1")
    emit()
  },
  getMultiplier() {
    return readVerified() ? 2 : 1
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
