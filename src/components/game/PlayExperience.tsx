import { useEffect, useState, useSyncExternalStore } from "react"
import { Link } from "@tanstack/react-router"
import { Menu, Play, RotateCcw, Trophy, Volume2, VolumeX, Wrench, X, Youtube, Images } from "lucide-react"
import { brandConfig } from "@/config/brandConfig"
import { youtubeConfig } from "@/config/youtubeConfig"
import { MARBLES, type MarbleId } from "@/data/marbleTypes"
import { ClientCanvas } from "@/components/game/ClientCanvas"
import { BootScreen } from "@/components/game/BootScreen"
import { runClock, useGame } from "@/game/state"
import { sling, subscribeSling } from "@/game/spawn"
import { SubscriberBonusService } from "@/game/SubscriberBonusService"
import { trackEvent } from "@/utils/analytics"

const LINKS = [
  { to: "/", label: "Play", icon: Play, exact: true },
  { to: "/build", label: "Build", icon: Wrench, exact: false },
  { to: "/challenge", label: "Challenge", icon: Trophy, exact: false },
  { to: "/gallery", label: "Gallery", icon: Images, exact: false },
  { to: "/videos", label: "Videos", icon: Youtube, exact: false },
] as const

export function PlayExperience() {
  const [booting, setBooting] = useState(true)
  const [cover, setCover] = useState(true)
  return (
    <div className="stage">
      <ClientCanvas />
      <div className="hud" hidden={cover}>
        <TopBar />
        <BrandCard />
        <SidePicker />
        <Dock />
        <Results />
      </div>
      {booting ? <BootScreen onReveal={() => setCover(false)} onDone={() => setBooting(false)} /> : null}
    </div>
  )
}

function TopBar() {
  const [open, setOpen] = useState(false)
  const [bonusOpen, setBonusOpen] = useState(false)
  const { sound, toggleSound } = useGame()
  const verified = useSyncExternalStore(SubscriberBonusService.subscribe, SubscriberBonusService.isVerified, () => false)

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
      <div className="relative flex shrink-0 items-center gap-2">
        <button type="button" className="icon-btn" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? "Sound off" : "Sound on"}>
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <div className="yt-anchor">
          <a className="yt-btn" href={youtubeConfig.url} target="_blank" rel="noreferrer" aria-label={youtubeConfig.channelLabel} onClick={() => trackEvent("youtube_clicked", { place: "nav" })}>
            <Youtube size={18} />
            <span className="hidden sm:inline">{youtubeConfig.channelLabel}</span>
          </a>
          <button type="button" className="yt-bubble" onClick={() => { if (!verified) setBonusOpen(true) }}>
            YouTube bonus {verified ? "2×" : "1×"}
          </button>
        </div>
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
      {bonusOpen && !verified ? <BonusPopup onClose={() => setBonusOpen(false)} /> : null}
    </header>
  )
}

function BonusPopup({ onClose }: { onClose: () => void }) {
  const [awaiting, setAwaiting] = useState(false)
  return (
    <div className="bonus-pop-back hit" onClick={onClose}>
      <div className="glass bonus-pop" role="dialog" aria-labelledby="bonus-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="sub-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <h2 id="bonus-title">YouTube bonus</h2>
        <p>Subscribe for 2× points</p>
        {awaiting ? (
          <button type="button" className="yt-btn" onClick={() => SubscriberBonusService.activatePrototypeBonus()}>
            I subscribed — activate 2×
          </button>
        ) : (
          <button
            type="button"
            className="yt-btn"
            onClick={() => {
              window.open(youtubeConfig.url, "_blank", "noopener,noreferrer")
              trackEvent("youtube_clicked", { place: "subscriber_bonus" })
              setAwaiting(true)
            }}
          >
            <Youtube size={18} />
            2× points for YouTube subscribers
          </button>
        )}
      </div>
    </div>
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
  const { phase, drop, again } = useGame()
  const aiming = useSyncExternalStore(subscribeSling, () => sling.armed, () => false)
  if (phase === "done" || phase === "missed") return null
  return (
    <div className="dock">
      {phase === "running" ? <LiveScore /> : null}
      {phase === "running" ? <LiveTime /> : null}
      {phase === "ready" ? (
        <p className="hint">
          {aiming ? "Short pull, soft shot · long pull, hard shot" : "Drag freely on the start ramp · pinch or scroll to zoom"}
        </p>
      ) : null}
      <Swatches layout="row" />
      {phase === "running" ? (
        <button type="button" className="drop-btn hit" onClick={again}>
          <RotateCcw size={20} />
          Start over
        </button>
      ) : (
        <button type="button" className="drop-btn hit" data-testid="drop-marble" onClick={drop}>
          <Play size={20} fill="currentColor" />
          Drop marble
        </button>
      )}
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

function LiveScore() {
  const { score, gems, gemTotal, combo } = useGame()
  return (
    <p className="glass live-pill score-pill">
      <span>
        {gems}/{gemTotal}
      </span>
      <strong>{score.toLocaleString("en-US")}</strong>
      {combo > 1 ? <em>x{combo}</em> : null}
    </p>
  )
}

function Results() {
  const { phase, seconds, score, gems, gemTotal, best, again, marbleId, selectMarble } = useGame()
  const verified = useSyncExternalStore(SubscriberBonusService.subscribe, SubscriberBonusService.isVerified, () => false)
  const [awaiting, setAwaiting] = useState(false)
  if (phase !== "done" && phase !== "missed") return null
  const next = MARBLES[(MARBLES.findIndex((m) => m.id === marbleId) + 1) % MARBLES.length]!
  return (
    <section className="glass results hit" aria-live="polite">
      <h2>{phase === "done" ? "Run complete" : "Missed the bowl"}</h2>
      <p>
        Score {score.toLocaleString("en-US")}
        <span> · </span>
        Gems {gems}/{gemTotal}
      </p>
      <p>
        Time {seconds == null ? "—" : `${seconds.toFixed(2)} s`}
        <span> · </span>
        Best {best.toLocaleString("en-US")}
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
      {verified ? null : awaiting ? (
        <button type="button" className="yt-btn mt-3 inline-flex" onClick={() => SubscriberBonusService.activatePrototypeBonus()}>
          I subscribed — activate 2×
        </button>
      ) : (
        <button
          type="button"
          className="yt-btn mt-3 inline-flex"
          onClick={() => {
            window.open(youtubeConfig.url, "_blank", "noopener,noreferrer")
            trackEvent("youtube_clicked", { place: "subscriber_bonus" })
            setAwaiting(true)
          }}
        >
          <Youtube size={18} />
          2× points for YouTube subscribers
        </button>
      )}
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
