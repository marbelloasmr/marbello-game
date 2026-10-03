import { Link } from "@tanstack/react-router"
import { brandConfig } from "@/config/brandConfig"
import { youtubeConfig } from "@/config/youtubeConfig"
import { trackEvent } from "@/utils/analytics"

export function SoonPage({
  title,
  body,
  youtube = false,
}: {
  title: string
  body: string
  youtube?: boolean
}) {
  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="logo-link" aria-label={brandConfig.name}>
          <img src={brandConfig.logo} alt="" className="logo-mark" />
        </Link>
        <Link to="/" className="ghost-btn hit">
          Back to play
        </Link>
      </header>
      <main className="glass page-main">
        <p className="text-sm font-semibold tracking-wide text-magenta uppercase">Not in this version</p>
        <h1 className="mt-2">{title}</h1>
        <p>{body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/" className="solid-btn">
            Drop a marble
          </Link>
          {youtube ? (
            <a
              className="yt-btn"
              href={youtubeConfig.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent("youtube_clicked", { place: "videos" })}
            >
              {youtubeConfig.channelLabel}
            </a>
          ) : null}
        </div>
      </main>
    </div>
  )
}
