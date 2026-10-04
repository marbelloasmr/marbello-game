import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { DEFAULT_MARBLE, type MarbleId } from "@/data/marbleTypes"
import { getAudio } from "@/audio/AudioEngine"
import { clearSpawn, focusStartZone, aimedStart, launchVelocity, spawn, startPower } from "@/game/spawn"
import { SubscriberBonusService } from "@/game/SubscriberBonusService"
import { recordRun } from "@/game/leaderboard"
import { gameConfig } from "@/config/gameConfig"
import { MARBLE_GEMS } from "@/game/trackLayout"
import { trackEvent } from "@/utils/analytics"

export type Phase = "ready" | "running" | "done" | "missed"

export const runClock = { t0: 0 }

type GameContextValue = {
  phase: Phase
  marbleId: MarbleId
  runId: number
  impacts: number
  score: number
  gems: number
  gemTotal: number
  combo: number
  best: number
  seconds: number | null
  sound: boolean
  selectMarble: (id: MarbleId) => void
  drop: () => void
  throwMarble: (x: number, y: number, z: number, vx: number, vy: number, vz: number) => void
  again: () => void
  finish: () => void
  miss: () => void
  registerImpact: (speed: number) => void
  award: (base: number, kind: "gem" | "glass" | "bonus") => number
  toggleSound: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

const BEST_KEY = "marbello-best"
const GEM_TOTAL = MARBLE_GEMS.length
const COMBO_MS = 2500

export function GameProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("ready")
  const [marbleId, setMarbleId] = useState<MarbleId>(DEFAULT_MARBLE)
  const [runId, setRunId] = useState(0)
  const [impacts, setImpacts] = useState(0)
  const [score, setScore] = useState(0)
  const [gems, setGems] = useState(0)
  const [combo, setCombo] = useState(1)
  const [best, setBest] = useState(0)
  const [seconds, setSeconds] = useState<number | null>(null)
  const [sound, setSound] = useState(true)
  const started = useRef<number | null>(null)
  const impactsRef = useRef(0)
  const scoreRef = useRef(0)
  const gemsRef = useRef(0)
  const comboRef = useRef(1)
  const comboUntil = useRef(0)
  const comboTimer = useRef(0)
  const phaseRef = useRef<Phase>("ready")
  const marbleRef = useRef<MarbleId>(DEFAULT_MARBLE)
  phaseRef.current = phase
  marbleRef.current = marbleId

  useEffect(() => {
    setSound(getAudio().isEnabled)
    const stored = Number(window.localStorage.getItem(BEST_KEY) || 0)
    if (Number.isFinite(stored) && stored > 0) setBest(stored)
  }, [])

  useEffect(() => {
    if (phase === "ready") focusStartZone()
  }, [phase])

  const clearScore = useCallback(() => {
    window.clearTimeout(comboTimer.current)
    scoreRef.current = 0
    gemsRef.current = 0
    comboRef.current = 1
    comboUntil.current = 0
    setScore(0)
    setGems(0)
    setCombo(1)
  }, [])

  const resetGate = useCallback(() => {
    started.current = null
    impactsRef.current = 0
    clearSpawn()
    setImpacts(0)
    clearScore()
    setSeconds(null)
    setPhase("ready")
    setRunId((n) => n + 1)
  }, [clearScore])

  const selectMarble = useCallback(
    (id: MarbleId) => {
      if (phaseRef.current === "running") return
      if (phaseRef.current !== "ready") resetGate()
      setMarbleId(id)
      focusStartZone()
      trackEvent("marble_changed", { marble: id })
    },
    [resetGate],
  )

  const beginRun = useCallback(() => {
    void getAudio().unlock()
    impactsRef.current = 0
    setImpacts(0)
    clearScore()
    setSeconds(null)
    started.current = performance.now()
    runClock.t0 = started.current
    setPhase("running")
  }, [clearScore])

  const rememberBest = useCallback((value: number) => {
    setBest((current) => {
      const next = Math.max(current, value)
      if (next > current) window.localStorage.setItem(BEST_KEY, String(next))
      return next
    })
  }, [])

  const award = useCallback((base: number, kind: "gem" | "glass" | "bonus") => {
    if (phaseRef.current !== "running") return 0
    const now = performance.now()
    const mult = now < comboUntil.current ? Math.min(5, comboRef.current + 1) : 1
    comboRef.current = mult
    comboUntil.current = now + COMBO_MS
    window.clearTimeout(comboTimer.current)
    comboTimer.current = window.setTimeout(() => {
      comboRef.current = 1
      comboUntil.current = 0
      setCombo(1)
    }, COMBO_MS)
    const gained = base * mult * SubscriberBonusService.getMultiplier()
    scoreRef.current += gained
    if (kind === "gem") {
      gemsRef.current += 1
      setGems(gemsRef.current)
    }
    setScore(scoreRef.current)
    setCombo(mult)
    return gained
  }, [])

  const drop = useCallback(() => {
    if (phaseRef.current === "running") return
    const at = aimedStart()
    const shot = launchVelocity()
    startPower.last = startPower.value
    spawn.custom = true
    spawn.x = at.x
    spawn.y = at.y
    spawn.z = at.z
    spawn.vx = shot.vx
    spawn.vy = shot.vy
    spawn.vz = shot.vz
    beginRun()
    trackEvent("marble_dropped", { marble: marbleRef.current, placed: true })
  }, [beginRun])

  const throwMarble = useCallback(
    (x: number, y: number, z: number, vx: number, vy: number, vz: number) => {
      if (phaseRef.current === "running") return
      spawn.custom = true
      spawn.x = x
      spawn.y = y
      spawn.z = z
      spawn.vx = vx
      spawn.vy = vy
      spawn.vz = vz
      beginRun()
      trackEvent("marble_thrown", { marble: marbleRef.current })
    },
    [beginRun],
  )

  const again = useCallback(() => {
    resetGate()
    trackEvent("replay_clicked")
  }, [resetGate])

  const finish = useCallback(() => {
    if (phaseRef.current !== "running" || started.current == null) return
    const elapsed = (performance.now() - started.current) / 1000
    if (gemsRef.current >= GEM_TOTAL && GEM_TOTAL > 0) {
      scoreRef.current += gameConfig.perfectRunBonus
      setScore(scoreRef.current)
    }
    setImpacts(impactsRef.current)
    setSeconds(elapsed)
    setPhase("done")
    getAudio().playJar()
    rememberBest(scoreRef.current)
    recordRun({ score: scoreRef.current, seconds: elapsed, marble: marbleRef.current, at: Date.now() })
    trackEvent("run_completed", { seconds: Math.round(elapsed * 100) / 100, impacts: impactsRef.current, score: scoreRef.current })
  }, [rememberBest])

  const miss = useCallback(() => {
    if (phaseRef.current !== "running" || started.current == null) return
    const elapsed = (performance.now() - started.current) / 1000
    setImpacts(impactsRef.current)
    setSeconds(elapsed)
    setPhase("missed")
    rememberBest(scoreRef.current)
    recordRun({ score: scoreRef.current, seconds: elapsed, marble: marbleRef.current, at: Date.now() })
  }, [rememberBest])

  const registerImpact = useCallback((speed: number) => {
    if (phaseRef.current !== "running" || speed < 0.45) return
    impactsRef.current += 1
  }, [])

  const toggleSound = useCallback(() => {
    setSound((on) => {
      const next = !on
      getAudio().setEnabled(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      phase,
      marbleId,
      runId,
      impacts,
      score,
      gems,
      gemTotal: GEM_TOTAL,
      combo,
      best,
      seconds,
      sound,
      selectMarble,
      drop,
      throwMarble,
      again,
      finish,
      miss,
      registerImpact,
      award,
      toggleSound,
    }),
    [phase, marbleId, runId, impacts, score, gems, combo, best, seconds, sound, selectMarble, drop, throwMarble, again, finish, miss, registerImpact, award, toggleSound],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error("useGame outside provider")
  return ctx
}
