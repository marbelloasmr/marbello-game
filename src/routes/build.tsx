import { createFileRoute } from "@tanstack/react-router"
import { SoonPage } from "@/components/game/SoonPage"

export const Route = createFileRoute("/build")({
  component: BuildPage,
  head: () => ({ meta: [{ title: "Build a track — MARBELLO ASMR" }] }),
})

function BuildPage() {
  return (
    <SoonPage
      title="Track builder is next"
      body="Dragging ramps, spirals and funnels comes after this studio run feels right. There is no editor to test yet — drop the marble on the main run instead."
    />
  )
}
