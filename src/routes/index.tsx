import { createFileRoute } from "@tanstack/react-router"
import { PlayExperience } from "@/components/game/PlayExperience"
import { brandConfig } from "@/config/brandConfig"
import { GameProvider } from "@/game/state"

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: brandConfig.title },
      { name: "description", content: brandConfig.description },
    ],
    links: [{ rel: "canonical", href: "https://marbello-game.vercel.app/" }],
  }),
})

function Home() {
  return (
    <GameProvider>
      <PlayExperience />
    </GameProvider>
  )
}
