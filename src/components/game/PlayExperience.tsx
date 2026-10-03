import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Headphones, Menu, Play, RotateCcw, Trophy, Volume2, VolumeX, Wrench, X, Youtube, Images } from "lucide-react"
import { brandConfig } from "@/config/brandConfig"
import { youtubeConfig } from "@/config/youtubeConfig"
import { MARBLES, type MarbleId } from "@/data/marbleTypes"
import { ClientCanvas } from "@/components/game/ClientCanvas"
import { runClock, useGame } from "@/game/state"
import { trackEvent } from "@/utils/analytics"

const LINKS = [
  { to: "/", label: "Play", icon: Play, exact: true },
  { to: "/build", label: "Build", icon: Wrench, exact: false },
  { to: "/challenge", label: "Challenge", icon: Trophy, exact: false },
  { to: "/gallery", label: "Gallery", icon: Images, exact: false },
  { to: "/videos", label: "Videos", icon: Youtube, exact: false },
] as const

export function PlayExperience() {
  return (
    <div className="stage">
      <ClientCanvas />
      <div className="hud">
        <TopBar />
        <BrandCard />
        <SidePicker />
        <Dock />
        <Results />
      </div>
    </div>
  )
}

function TopBar() {
  const [open, setOpen] = useState(false)
  const { sound, toggleSound } = useGame()

  return (
    <header className="topbar">
      <Link to="/" className="logo-link" aria-label={brandConfig.name}>
        <img src={brandConfig.logo} alt="" className="logo-mark" />
        <span className="logo-name">{brandConfig.name}</span>
      </Link>
      <nav className="glass desk-nav hit" aria-label="Primary">
        {LINKS.map((item) => (
          <NavLink key={item.to} {...item} />
        ))}
      </nav>
      <div className="relative flex items-center gap-2">
        <button type="button" className="icon-btn" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? "Sound off" : "Sound on"}>
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <a className="yt-btn" href={youtubeConfig.url} target="_blank" rel="noreferrer" aria-label={youtubeConfig.channelLabel} onClick={() => trackEvent("youtube_clicked", { place: "nav" })}>
          <Youtube size={18} />
          <span className="hidden sm:inline">{youtubeConfig.channelLabel}</span>
        </a>
        <button type="button" className="menu-btn" aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
        {open ? (
          <nav className="glass menu-sheet hit" aria-label="Mobile">
            {LINKS.map((item) => (
              <NavLink key={item.to} {...item} onPick={() => setOpen(false)} />
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  )
}

function NavLink({
  to,
  label,
  icon: Icon,
  exact,
  onPick,
}: {
  to: "/" | "/build" | "/challenge" | "/gallery" | "/videos"
  label: string
  icon: typeof Play
  exact: boolean
  onPick?: () => void
}) {
  return (
    <Link to={to} className="nav-link" activeOptions={{ exact }} activeProps={{ className: "nav-link is-active" }} onClick={onPick}>
      <Icon size={16} />
      {label}
    </Link>
  )
}

function Swatches({ layout }: { layout: "row" | "col" }) {
  const { marbleId, phase, selectMarble } = useGame()
  const locked = phase === "running"
  return (
    <div className={layout === "row" ? "glass swatches hit" : "glass side-picker hit"} role="listbox" aria-label="Choose a marble">
      {MARBLES.map((marble) => (
        <button
          key={marble.id}
          type="button"
          className={marble.id === marbleId ? "swatch is-selected" : "swatch"}
          style={{ background: `radial-gradient(circle at 32% 30%, white, ${marble.color} 42%, ${marble.accent})` }}
          aria-label={marble.name}
          aria-selected={marble.id === marbleId}
          disabled={locked}
          onClick={() => selectMarble(marble.id as MarbleId)}
        />
      ))}
    </div>
  )
}

function SidePicker() {
  return <Swatches layout="col" />
}

function BrandCard() {
  const { phase } = useGame()
  if (phase !== "ready") return null
  return (
    <aside className="glass brand-card">
      <h1>
        Create.
        <br />
        Drop.
        <br />
        <span>Relax.</span>
      </h1>
      <p>Interactive marble runs with satisfying physics and ASMR sounds.</p>
    </aside>
  )
}
function Dock() {
  const { phase, drop } = useGame()
  if (phase === "done" || phase === "missed") return null
  return (
    <div className="dock">
      {phase === "running" ? <LiveTime /> : null}
      {phase === "ready" ? (
        <p className="hint">
          <Headphones size={16} />
          Headphones recommended
        </p>
      ) : null}
      <Swatches layout="row" />
      <button type="button" className="drop-btn hit" data-testid="drop-marble" onClick={drop} disabled={phase === "running"}>
        <Play size={20} fill="currentColor" />
        {phase === "running" ? "Rolling" : "Drop marble"}
      </button>
    </div>
  )
}

function LiveTime() {
  const [label, setLabel] = useState("0.00")
  useEffect(() => {
    let frame = 0
    const tick = () => {
      setLabel(((performance.now() - runClock.t0) / 1000).toFixed(2))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <p className="glass live-pill hit">{label}s</p>
}

function Results() {
  const { phase, seconds, impacts, again, marbleId, selectMarble } = useGame()
  if (phase !== "done" && phase !== "missed") return null
  const next = MARBLES[(MARBLES.findIndex((m) => m.id === marbleId) + 1) % MARBLES.length]!
  return (
    <section className="glass results hit" aria-live="polite">
      <h2>{phase === "done" ? "Run complete" : "Missed the bowl"}</h2>
      <p>
        Time {seconds == null ? "—" : `${seconds.toFixed(2)} s`}
        <span> · </span>
        Impacts {impacts}
      </p>
      <div className="result-actions">
        <button type="button" className="solid-btn" onClick={again}>
          <RotateCcw size={16} className="mr-1 inline" />
          Again
        </button>
        <button type="button" className="ghost-btn" onClick={() => selectMarble(next.id)}>
          Change marble
        </button>
        <Link to="/build" className="ghost-btn">
          Build your own
        </Link>
      </div>
      <div className="yt-note">
        <p className="font-display text-ink">{youtubeConfig.afterRunTitle}</p>
        <p>{youtubeConfig.afterRunBody}</p>
        <a
          className="yt-btn mt-3 inline-flex"
          href={youtubeConfig.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackEvent("youtube_clicked", { place: "results" })}
        >
          <Youtube size={18} />
          {youtubeConfig.channelLabel}
        </a>
      </div>
    </section>
  )
}
