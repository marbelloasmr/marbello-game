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
  { id: "blue", name: "Blue glass", color: "#1a32f0", accent: "#5ad7ff", transmission: 0.78, roughness: 0.04, metalness: 0.04, thickness: 1.1, swirl: false, speckle: false },
  { id: "red", name: "Red glass", color: "#e21814", accent: "#ffb0a4", transmission: 0.74, roughness: 0.05, metalness: 0.03, thickness: 1.05, swirl: false, speckle: false },
  { id: "green", name: "Green glass", color: "#22c41c", accent: "#d4ff9a", transmission: 0.74, roughness: 0.05, metalness: 0.03, thickness: 1.05, swirl: false, speckle: false },
  { id: "amber", name: "Gold", color: "#f6c431", accent: "#fff3b0", transmission: 0.58, roughness: 0.06, metalness: 0.18, thickness: 1.15, swirl: false, speckle: false },
  { id: "purple", name: "Purple glass", color: "#d22ad8", accent: "#f3b0ff", transmission: 0.76, roughness: 0.05, metalness: 0.03, thickness: 1.1, swirl: false, speckle: false },
  { id: "clear", name: "Clear glass", color: "#f4fbff", accent: "#ffffff", transmission: 0.98, roughness: 0.02, metalness: 0, thickness: 1.3, swirl: false, speckle: false },
  { id: "speckle", name: "Speckled", color: "#f4f8ff", accent: "#1a32f0", transmission: 0.28, roughness: 0.2, metalness: 0.04, thickness: 0.6, swirl: false, speckle: true },
  { id: "swirl", name: "Swirl", color: "#2436f2", accent: "#ffe56a", transmission: 0.62, roughness: 0.1, metalness: 0.05, thickness: 0.85, swirl: true, speckle: false },
]

export const DEFAULT_MARBLE: MarbleId = "blue"

export function marbleById(id: string): MarbleType {
  return MARBLES.find((m) => m.id === id) ?? MARBLES[0]!
}
