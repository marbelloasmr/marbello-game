import type { Surface } from "@/physics/materials"

const STORAGE_KEY = "marbello-sound"

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambient: GainNode | null = null
  private enabled = true
  private volume = 0.85
  private lastHit = new Map<string, number>()

  constructor() {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "0") this.enabled = false
  }

  get isEnabled() {
    return this.enabled
  }

  async unlock() {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state === "suspended") await ctx.resume()
    this.applyGain()
    this.ensureAmbient()
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0")
    }
    this.applyGain()
    if (on) void this.unlock()
  }

  playImpact(material: Surface, speed: number, x: number) {
    if (!this.enabled || speed < 0.35) return
    const ctx = this.ensure()
    if (!ctx || ctx.state !== "running") return
    const key = `${material}:${Math.round(x * 4)}`
    const nowMs = performance.now()
    const previous = this.lastHit.get(key) ?? 0
    if (nowMs - previous < 46) return
    this.lastHit.set(key, nowMs)

    const t = ctx.currentTime
    const gain = ctx.createGain()
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.max(-0.85, Math.min(0.85, x / 9))
    gain.connect(pan)
    pan.connect(this.master!)

    const loud = Math.max(0.04, Math.min(0.62, speed / 7.5))
    const pitchJitter = 0.9 + Math.random() * 0.2
    gain.gain.setValueAtTime(0.0001, t)

    if (material === "metal") {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      const f = (1680 + Math.random() * 900) * pitchJitter
      osc.frequency.setValueAtTime(f, t)
      osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.18)
      const filter = ctx.createBiquadFilter()
      filter.type = "highpass"
      filter.frequency.value = 700
      osc.connect(filter)
      filter.connect(gain)
      gain.gain.exponentialRampToValueAtTime(loud * 0.55, t + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      osc.start(t)
      osc.stop(t + 0.24)
    } else if (material === "glass") {
      const osc = ctx.createOscillator()
      osc.type = "triangle"
      const f = (2100 + Math.random() * 700) * pitchJitter
      osc.frequency.value = f
      osc.connect(gain)
      gain.gain.exponentialRampToValueAtTime(loud * 0.28, t + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
      osc.start(t)
      osc.stop(t + 0.1)
      this.noiseBurst(ctx, gain, t, 0.03, 2400, loud * 0.18)
    } else if (material === "acrylic") {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = (980 + Math.random() * 240) * pitchJitter
      osc.connect(gain)
      gain.gain.exponentialRampToValueAtTime(loud * 0.32, t + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
      osc.start(t)
      osc.stop(t + 0.12)
    } else {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = (160 + Math.random() * 70) * pitchJitter
      osc.connect(gain)
      gain.gain.exponentialRampToValueAtTime(loud * 0.7, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      osc.start(t)
      osc.stop(t + 0.18)
      this.noiseBurst(ctx, gain, t, 0.07, 480, loud * 0.35)
    }

    if (speed > 2.8 && typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(8)
      } catch {
        /* unsupported */
      }
    }
  }

  private noiseBurst(ctx: AudioContext, destination: AudioNode, t: number, dur: number, freq: number, loud: number) {
    const length = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = freq
    filter.Q.value = 0.7
    const gain = ctx.createGain()
    gain.gain.value = loud
    src.connect(filter)
    filter.connect(gain)
    gain.connect(destination)
    src.start(t)
    src.stop(t + dur)
  }

  private ensure() {
    if (typeof window === "undefined") return null
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      this.applyGain()
    }
    return this.ctx
  }

  private ensureAmbient() {
    if (!this.ctx || !this.master || this.ambient) return
    const ctx = this.ctx
    const length = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let seed = 0.2
    for (let i = 0; i < length; i++) {
      seed = (seed * 16807) % 2147483647
      data[i] = (seed / 2147483647) * 2 - 1
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = 320
    this.ambient = ctx.createGain()
    this.ambient.gain.value = 0.012
    src.connect(filter)
    filter.connect(this.ambient)
    this.ambient.connect(this.master)
    src.start()
  }

  private applyGain() {
    if (!this.master || !this.ctx) return
    const target = this.enabled ? this.volume : 0
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03)
  }
}

let singleton: AudioEngine | null = null

export function getAudio() {
  if (!singleton) singleton = new AudioEngine()
  return singleton
}
