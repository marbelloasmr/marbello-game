import { createFileRoute } from "@tanstack/react-router"
import { SoonPage } from "@/components/game/SoonPage"

export const Route = createFileRoute("/videos")({
  component: VideosPage,
  head: () => ({ meta: [{ title: "Videos — Marbello game" }] }),
})

function VideosPage() {
  return (
    <SoonPage
      title="Watch a real marble run"
      body="The site sends you to the Marbello game videos from one setting. It does not invent view counts or a video library."
      youtube
    />
  )
}
