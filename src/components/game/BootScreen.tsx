import { useEffect, useRef, useState } from "react"

const STATUS = [
  [0.2, "Preparing marbles..."],
  [0.42, "Building the track..."],
  [0.64, "Loading ASMR sounds..."],
  [0.86, "Polishing the glass..."],
  [1, "Almost ready..."],
] as const

function statusFor(progress: number) {
  for (const [at, line] of STATUS) {
    if (progress < at) return line
  }
  return STATUS[STATUS.length - 1]![1]
}

export function BootScreen({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const [leave, setLeave] = useState(false)
  const done = useRef(onDone)
  const reveal = useRef(onReveal)
  done.current = onDone
  reveal.current = onReveal

  useEffect(() => {
    let alive = true
    let actual = 0
    let shown = 0
    const parts = { art: 0, fonts: 0, game: 0, canvas: 0 }
    const publish = () => {
      actual = parts.art * 0.12 + parts.fonts * 0.08 + parts.game * 0.62 + parts.canvas * 0.18
    }

    const art = new Image()
    const markArt = () => {
      parts.art = 1
      publish()
    }
    art.onload = markArt
    art.onerror = markArt
    art.src = "/marbello-loading.png"
    if (art.complete) markArt()

    const fonts = document.fonts?.ready.then(() => {
      parts.fonts = 1
      publish()
    })
    if (!fonts) {
      parts.fonts = 1
      publish()
    }

    void import("@/game/PlayCanvas")
      .then(() => {
        parts.game = 1
        publish()
      })
      .catch(() => {
        parts.game = 1
        publish()
      })

    const seeCanvas = () => {
      if (!document.querySelector(".stage canvas")) return false
      parts.canvas = 1
      publish()
      return true
    }
    const observer = new MutationObserver(() => {
      seeCanvas()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    seeCanvas()

    let frame = 0
    let hide = 0
    let finishing = false
    const started = performance.now()
    const tick = () => {
      if (!alive) return
      if (parts.game === 1 && performance.now() - started > 8000) {
        parts.canvas = 1
        publish()
      }
      const gap = actual - shown
      shown = gap <= 0.0015 ? actual : Math.min(actual, shown + Math.max(0.004, gap * 0.1))
      setProgress(shown)
      if (!finishing && actual >= 0.999 && shown >= 0.992) {
        finishing = true
        reveal.current()
        setLeave(true)
        hide = window.setTimeout(() => done.current(), 460)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      alive = false
      cancelAnimationFrame(frame)
      window.clearTimeout(hide)
      observer.disconnect()
    }
  }, [])

  const percent = Math.round(progress * 100)

  return (
    <div className={leave ? "boot boot-leave" : "boot"} role="status" aria-live="polite" aria-label="Loading">
      <div className="boot-sky" />
      <div className="boot-floor" />
      <div className="boot-trail boot-trail-a" />
      <div className="boot-trail boot-trail-b" />
      <div className="boot-trail boot-trail-c" />
      <i className="boot-spark s1" />
      <i className="boot-spark s2" />
      <i className="boot-spark s3" />
      <i className="boot-spark s4" />
      <i className="boot-spark s5" />
      <i className="boot-spark s6" />

      <span className="marble far m1" />
      <span className="marble far m2" />
      <span className="marble far m3" />
      <span className="marble mid m4" />
      <span className="marble mid m5" />
      <span className="marble mid m6" />
      <span className="marble near m7">
        <span className="mimi-mark">
          Mimi<span>♥</span>
        </span>
      </span>
      <span className="marble near m8" />
      <span className="marble hero" />

      <div className="boot-logo" role="img" aria-label="Marbello Game" />

      <div className="boot-ui">
        <div
          className="boot-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Loading"
        >
          <span className="boot-fill" style={{ width: `${progress * 100}%` }} />
          <span className="boot-orb" style={{ left: `${progress * 100}%` }}>
            <span className="boot-orb-glass" style={{ transform: `rotate(${progress * 720}deg)` }} />
          </span>
        </div>
        <p className="boot-percent">{percent}%</p>
        <p className="boot-label">Loading...</p>
        <p className="boot-status">{statusFor(progress)}</p>
      </div>
    </div>
  )
}

