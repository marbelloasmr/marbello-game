import { createFileRoute } from "@tanstack/react-router"
import { SoonPage } from "@/components/game/SoonPage"

export const Route = createFileRoute("/challenge")({
  component: ChallengePage,
  head: () => ({ meta: [{ title: "Daily challenge — Marbello game" }] }),
})

function ChallengePage() {
  return (
    <SoonPage
      title="Daily challenge isn't open"
      body="Everyone will get the same pieces later. There is no leaderboard and no daily best yet — those would be made up. Play the studio run while the challenge is built."
    />
  )
}
