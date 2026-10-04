export type MarbleId =
  | "blue"
  | "red"
  | "green"
  | "amber"
  | "purple"
  | "clear"
  | "speckle"
  | "swirl"

export type MarblePattern = "solid" | "swirl" | "flower" | "speckle" | "stripe"

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
  pattern: MarblePattern
}

export const MARBLES: MarbleType[] = [
  { id: "blue", name: "Blue glass", color: "#1a32f0", accent: "#5ad7ff", transmission: 0.78, roughness: 0.04, metalness: 0.04, thickness: 1.1, swirl: false, speckle: false, pattern: "solid" },
  { id: "red", name: "Red glass", color: "#e21814", accent: "#ffb0a4", transmission: 0.74, roughness: 0.05, metalness: 0.03, thickness: 1.05, swirl: false, speckle: false, pattern: "solid" },
  { id: "green", name: "Green glass", color: "#22c41c", accent: "#d4ff9a", transmission: 0.74, roughness: 0.05, metalness: 0.03, thickness: 1.05, swirl: false, speckle: false, pattern: "solid" },
  { id: "amber", name: "Gold", color: "#f6c431", accent: "#fff3b0", transmission: 0.58, roughness: 0.06, metalness: 0.18, thickness: 1.15, swirl: false, speckle: false, pattern: "solid" },
  { id: "purple", name: "Purple swirl", color: "#d22ad8", accent: "#f3b0ff", transmission: 0.42, roughness: 0.08, metalness: 0.04, thickness: 0.9, swirl: true, speckle: false, pattern: "swirl" },
  { id: "clear", name: "Flower", color: "#f7fbff", accent: "#ff4fa3", transmission: 0.38, roughness: 0.08, metalness: 0.02, thickness: 0.7, swirl: false, speckle: false, pattern: "flower" },
  { id: "speckle", name: "Speckled", color: "#f4f8ff", accent: "#1a32f0", transmission: 0.28, roughness: 0.16, metalness: 0.04, thickness: 0.55, swirl: false, speckle: true, pattern: "speckle" },
  { id: "swirl", name: "Candy swirl", color: "#2436f2", accent: "#ffe56a", transmission: 0.4, roughness: 0.08, metalness: 0.05, thickness: 0.75, swirl: true, speckle: false, pattern: "stripe" },
]

export const DEFAULT_MARBLE: MarbleId = "blue"

export function marbleById(id: string): MarbleType {
  return MARBLES.find((m) => m.id === id) ?? MARBLES[0]!
}

/** Picker face. Patterned marbles show the cane, not a flat tint. */
export function swatchBackground(marble: MarbleType): string {
  const shine = "radial-gradient(circle at 30% 26%, rgb(255 255 255 / 0.95) 0 5%, rgb(255 255 255 / 0) 20%)"
  if (marble.pattern === "swirl") {
    return `${shine}, conic-gradient(from 18deg, ${marble.color} 0 14%, #fff 14% 24%, ${marble.accent} 24% 40%, ${marble.color} 40% 54%, #fff 54% 64%, ${marble.accent} 64% 80%, ${marble.color} 80% 100%)`
  }
  if (marble.pattern === "stripe") {
    return `${shine}, repeating-linear-gradient(128deg, ${marble.color} 0 8px, ${marble.accent} 8px 14px, #7af0ff 14px 19px)`
  }
  if (marble.pattern === "speckle") {
    return `${shine}, radial-gradient(circle at 28% 34%, #1a32f0 0 4px, transparent 4.5px), radial-gradient(circle at 62% 28%, #5ad7ff 0 3.5px, transparent 4px), radial-gradient(circle at 74% 60%, #2436f2 0 4.5px, transparent 5px), radial-gradient(circle at 40% 70%, #1a32f0 0 3.5px, transparent 4px), radial-gradient(circle at 50% 46%, #2436f2 0 3px, transparent 3.5px), radial-gradient(circle at 18% 62%, #5ad7ff 0 3px, transparent 3.5px), #f4f8ff`
  }
  if (marble.pattern === "flower") {
    return `${shine}, radial-gradient(circle at 50% 50%, #ffe56a 0 5px, #fff 5px 7px, transparent 8px), radial-gradient(circle at 32% 36%, #ff4fa3 0 9px, transparent 10px), radial-gradient(circle at 68% 34%, #1a32f0 0 9px, transparent 10px), radial-gradient(circle at 30% 68%, #22c41c 0 8px, transparent 9px), radial-gradient(circle at 70% 68%, #5ad7ff 0 8px, transparent 9px), #f7fbff`
  }
  return `radial-gradient(circle at 32% 30%, white, ${marble.color} 42%, ${marble.accent})`
}
