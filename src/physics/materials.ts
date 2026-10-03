export type Surface = "wood" | "metal" | "glass" | "acrylic"

export const SURFACE_PHYSICS: Record<Surface, { friction: number; restitution: number }> = {
  wood: { friction: 0.16, restitution: 0.08 },
  metal: { friction: 0.04, restitution: 0.34 },
  glass: { friction: 0.03, restitution: 0.26 },
  acrylic: { friction: 0.028, restitution: 0.14 },
}
