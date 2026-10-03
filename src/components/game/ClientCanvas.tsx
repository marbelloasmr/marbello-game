import { useEffect, useState } from "react"

type PlayCanvasComponent = (typeof import("@/game/PlayCanvas"))["PlayCanvas"]

export function ClientCanvas() {
  const [Play, setPlay] = useState<PlayCanvasComponent | null>(null)

  useEffect(() => {
    let alive = true
    void import("@/game/PlayCanvas").then((mod) => {
      if (alive) setPlay(() => mod.PlayCanvas)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!Play) {
    return (
      <div className="grid h-full place-items-center text-ink-soft">
        <p>Warming the studio…</p>
      </div>
    )
  }

  return <Play />
}
