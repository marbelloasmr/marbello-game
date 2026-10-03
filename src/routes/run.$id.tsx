import { createFileRoute, Link } from "@tanstack/react-router"
import { brandConfig } from "@/config/brandConfig"

export const Route = createFileRoute("/run/$id")({
  component: SharedRunPage,
  head: () => ({ meta: [{ title: "Shared run — Marbello game" }] }),
})

function SharedRunPage() {
  const { id } = Route.useParams()
  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="logo-link" aria-label={brandConfig.name}>
          <img src={brandConfig.logo} alt="" className="logo-mark" />
          <span className="logo-name">{brandConfig.name}</span>
        </Link>
      </header>
      <main className="glass page-main">
        <p className="text-sm font-semibold tracking-wide text-magenta uppercase">Link saved for later</p>
        <h1 className="mt-2">This run can't load yet</h1>
        <p>
          Shared layouts are not stored yet, so <span className="font-semibold text-ink">{id}</span> is not a track.
          Nothing here is a preview of someone else's build.
        </p>
        <Link to="/" className="solid-btn mt-2 inline-flex">
          Play the studio run
        </Link>
      </main>
    </div>
  )
}
