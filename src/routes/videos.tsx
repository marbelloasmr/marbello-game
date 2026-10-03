import { createFileRoute } from "@tanstack/react-router"
import { SoonPage } from "@/components/game/SoonPage"

export const Route = createFileRoute("/videos")({
  component: VideosPage,
  head: () => ({ meta: [{ title: "Videos — MARBELLO ASMR" }] }),
})

function VideosPage() {
  return (
    <SoonPage
      title="Watch a real marble run"
      body="The site sends you to the MARBELLO ASMR videos from one setting. It does not invent view counts or a video library."
      youtube
    />
  )
}
