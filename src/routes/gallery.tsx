import { createFileRoute } from "@tanstack/react-router"
import { SoonPage } from "@/components/game/SoonPage"

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  head: () => ({ meta: [{ title: "Gallery — Marbello game" }] }),
})

function GalleryPage() {
  return (
    <SoonPage
      title="No shared tracks yet"
      body="Community layouts will show up here once runs can be saved. This page is empty on purpose — there are no sample creators, times, or play counts."
    />
  )
}
