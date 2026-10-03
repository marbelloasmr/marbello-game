export type MarbleId =
  | "blue"
  | "red"
  | "green"
  | "amber"
  | "purple"
  | "clear"
  | "speckle"
  | "swirl"

export type MarbleType = {
  id: MarbleId
  name: string
  color: string
  accent: string
  transmission: number
  roughness: number
  metalness: number
  thickness: number
  swirl: boolean
  speckle: boolean
}

export const MARBLES: MarbleType[] = [
  { id: "blue", name: "Blue glass", color: "#2f78ff", accent: "#9fd0ff", transmission: 0.95, roughness: 0.04, metalness: 0.02, thickness: 1.1, swirl: false, speckle: false },
  { id: "red", name: "Red glass", color: "#e2183a", accent: "#ffb0be", transmission: 0.9, roughness: 0.05, metalness: 0.02, thickness: 1.05, swirl: false, speckle: false },
  { id: "green", name: "Green glass", color: "#14b85a", accent: "#c8ffd8", transmission: 0.9, roughness: 0.05, metalness: 0.02, thickness: 1.05, swirl: false, speckle: false },
  { id: "amber", name: "Amber", color: "#ff9a1a", accent: "#ffe1a8", transmission: 0.72, roughness: 0.08, metalness: 0.04, thickness: 1.2, swirl: false, speckle: false },
  { id: "purple", name: "Purple glass", color: "#8b3dff", accent: "#e4c8ff", transmission: 0.92, roughness: 0.05, metalness: 0.02, thickness: 1.1, swirl: false, speckle: false },
  { id: "clear", name: "Clear glass", color: "#f4fbff", accent: "#ffffff", transmission: 0.98, roughness: 0.02, metalness: 0, thickness: 1.3, swirl: false, speckle: false },
  { id: "speckle", name: "Speckled", color: "#f7fbff", accent: "#2f78ff", transmission: 0.25, roughness: 0.22, metalness: 0.05, thickness: 0.6, swirl: false, speckle: true },
  { id: "swirl", name: "Swirl", color: "#ff4fa3", accent: "#ffe14a", transmission: 0.55, roughness: 0.12, metalness: 0.04, thickness: 0.8, swirl: true, speckle: false },
]

export const DEFAULT_MARBLE: MarbleId = "blue"

export function marbleById(id: string): MarbleType {
  return MARBLES.find((m) => m.id === id) ?? MARBLES[0]!
}
