import { Matrix4, Quaternion, Vector3 } from "three"
import { gameConfig } from "../config/gameConfig"
import type { Surface } from "../physics/materials"

export type BoxPiece = {
  kind: "box"
  id: string
  position: [number, number, number]
  quaternion: [number, number, number, number]
  size: [number, number, number]
  material: Surface
}

export type CylinderPiece = {
  kind: "cylinder"
  id: string
  position: [number, number, number]
  radius: number
  height: number
  material: Surface
}

export type TrackPiece = BoxPiece | CylinderPiece

const { channelWidth: W, wallHeight: WH, wallThickness: WT, floorThickness: FT } = gameConfig

type V3 = [number, number, number]

function qOf(dir: Vector3) {
  const side = new Vector3().crossVectors(new Vector3(0, 1, 0), dir)
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0)
  side.normalize()
  const up = new Vector3().crossVectors(dir, side).normalize()
  const basis = new Matrix4().makeBasis(side, up, dir)
  const q = new Quaternion().setFromRotationMatrix(basis)
  return { q, side, up }
}

function tupleQ(q: Quaternion): [number, number, number, number] {
  return [q.x, q.y, q.z, q.w]
}

function channel(
  points: V3[],
  material: Surface,
  id: string,
  width: number = W,
  wallH: number = WH,
  opts?: { cap?: boolean; wallsOnly?: boolean },
): BoxPiece[] {
  const pieces: BoxPiece[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = new Vector3(...points[i]!)
    const b = new Vector3(...points[i + 1]!)
    const delta = b.clone().sub(a)
    const dist = delta.length()
    if (dist < 0.04) continue
    const dir = delta.multiplyScalar(1 / dist)
    const { q, side, up } = qOf(dir)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const len = dist + 0.1
    const quat = tupleQ(q)
    if (!opts?.wallsOnly) {
      pieces.push({
        kind: "box",
        id: `${id}-f-${i}`,
        position: mid.clone().addScaledVector(up, -FT / 2).toArray() as V3,
        quaternion: quat,
        size: [width, FT, len],
        material,
      })
    }
    for (const sign of [-1, 1] as const) {
      pieces.push({
        kind: "box",
        id: `${id}-w-${i}-${sign}`,
        position: mid
          .clone()
          .addScaledVector(side, sign * (width / 2 + WT / 2))
          .addScaledVector(up, wallH / 2 - 0.02)
          .toArray() as V3,
        quaternion: quat,
        size: [WT, wallH, len],
        material,
      })
    }
    if (opts?.cap) {
      pieces.push({
        kind: "box",
        id: `${id}-c-${i}`,
        position: mid.clone().addScaledVector(up, wallH + 0.01).toArray() as V3,
        quaternion: quat,
        size: [width + WT * 2, 0.045, len],
        material,
      })
    }
  }
  return pieces
}

function helix(cx: number, cz: number, y0: number, y1: number, radius: number, turns: number, steps: number, startAngle: number): V3[] {
  const pts: V3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = startAngle + t * turns * Math.PI * 2
    pts.push([cx + Math.cos(a) * radius, y0 + (y1 - y0) * t, cz + Math.sin(a) * radius])
  }
  return pts
}

function lerp(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function lowestY(piece: TrackPiece) {
  if (piece.kind === "cylinder") return piece.position[1] - piece.height / 2
  const q = new Quaternion(...piece.quaternion)
  const hx = piece.size[0] / 2
  const hy = piece.size[1] / 2
  const hz = piece.size[2] / 2
  let min = Infinity
  for (const x of [-hx, hx]) {
    for (const y of [-hy, hy]) {
      for (const z of [-hz, hz]) {
        min = Math.min(min, new Vector3(x, y, z).applyQuaternion(q).y + piece.position[1])
      }
    }
  }
  return min
}

const acrylicPts: V3[] = [
  [-7.5, 5.85, -1.35],
  [-5.85, 5.2, -1.05],
  [-4.15, 4.55, -0.45],
]

const woodPts: V3[] = [acrylicPts[2]!, [-2.3, 3.85, 0.4], [-0.4, 3.2, 1.2]]

const metalPts: V3[] = [woodPts[2]!, [1.2, 2.72, 2.05], [2.55, 2.32, 2.85]]

const takeoffPts: V3[] = [metalPts[2]!, [3.4, 2.12, 3.5]]

const landingPts: V3[] = [
  [4.25, 1.78, 4.15],
  [5.45, 1.48, 4.55],
]

const pegPts: V3[] = [landingPts[1]!, [7.7, 0.98, 4.55]]

const pegs: CylinderPiece[] = []
const pegRows = [0.18, 0.4, 0.62, 0.84]
pegRows.forEach((t, row) => {
  const at = lerp(pegPts[0]!, pegPts[1]!, t)
  const zs = row % 2 === 0 ? [-0.4, 0.4] : [0]
  zs.forEach((z, col) => {
    pegs.push({
      kind: "cylinder",
      id: `peg-${row}-${col}`,
      position: [at[0], at[1] + 0.2, at[2] + z],
      radius: 0.065,
      height: 0.46,
      material: "metal",
    })
  })
})

const spiralCenter: V3 = [9.05, 0, 4.55]
const spiralPts = helix(spiralCenter[0], spiralCenter[2], 1.05, -1.45, 1.22, 2.05, 42, Math.PI)
const toSpiral = channel([pegPts[1]!, spiralPts[0]!], "acrylic", "to-spiral", 0.9, 0.56)

const spiral = channel(spiralPts, "acrylic", "spiral", 0.9, 0.72)

const end = spiralPts[spiralPts.length - 1]!
const endAngle = Math.PI + 2.05 * Math.PI * 2
const tx = -Math.sin(endAngle)
const tz = Math.cos(endAngle)
const tubePts: V3[] = [end]
for (let i = 1; i <= 3; i++) {
  const prev = tubePts[i - 1]!
  tubePts.push([prev[0] + tx * 1.05, prev[1] - 0.1, prev[2] + tz * 1.05])
}
const tube = channel(tubePts, "acrylic", "tube", 0.78, 0.5, { cap: true })

const mouth = tubePts[tubePts.length - 1]!
const lip = lerp(mouth, [mouth[0] + tx * 1.15, mouth[1] - 0.72, mouth[2] + tz * 1.15], 1)
const funnel = channel([mouth, lip], "glass", "funnel", 1.35, 0.72)

const bowlCenter: V3 = [lip[0] + tx * 0.2, lip[1] - 0.62, lip[2] + tz * 0.2]

function bowl(): BoxPiece[] {
  const [cx, cy, cz] = bowlCenter
  const pieces: BoxPiece[] = [
    {
      kind: "box",
      id: "bowl-floor",
      position: [cx, cy, cz],
      quaternion: [0, 0, 0, 1],
      size: [1.85, 0.1, 1.85],
      material: "wood",
    },
  ]
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -a)
    q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.42))
    pieces.push({
      kind: "box",
      id: `bowl-w-${i}`,
      position: [cx + Math.cos(a) * 0.78, cy + 0.28, cz + Math.sin(a) * 0.78],
      quaternion: tupleQ(q),
      size: [0.52, 0.62, 0.07],
      material: "wood",
    })
  }
  return pieces
}

const jumpRails = channel(takeoffPts.slice(1).concat(landingPts.slice(0, 1)) as V3[], "metal", "jump-rails", 0.72, 0.7, {
  wallsOnly: true,
})

const backstop: BoxPiece = {
  kind: "box",
  id: "backstop",
  position: [-7.72, 6.05, -1.4],
  quaternion: [0, 0, 0, 1],
  size: [0.08, 0.7, 1.05],
  material: "acrylic",
}

const rawPieces: TrackPiece[] = [
  backstop,
  ...channel(acrylicPts, "acrylic", "ramp", 0.9, 0.56),
  ...channel(woodPts, "wood", "wood", 0.92, 0.54),
  ...channel(metalPts, "metal", "metal", 0.74, 0.46),
  ...channel(takeoffPts, "metal", "takeoff", 0.74, 0.58),
  ...jumpRails,
  ...channel(landingPts, "wood", "land", 1.35, 0.7),
  ...channel(pegPts, "wood", "pegs", 1.9, 0.7),
  ...pegs,
  ...toSpiral,
  ...spiral,
  ...tube,
  ...funnel,
  ...bowl(),
]

let minBottom = Infinity
for (const piece of rawPieces) minBottom = Math.min(minBottom, lowestY(piece))
const lift = 0.42 - minBottom

function liftPiece<T extends TrackPiece>(piece: T): T {
  return { ...piece, position: [piece.position[0], piece.position[1] + lift, piece.position[2]] }
}

export const TRACK_PIECES: TrackPiece[] = rawPieces.map(liftPiece)

function raised(p: V3): V3 {
  return [p[0], p[1] + lift, p[2]]
}

const spawnFloor = new Vector3(...acrylicPts[0]!)
const spawnDir = new Vector3(...acrylicPts[1]!).sub(spawnFloor).normalize()
const { up: spawnUp } = qOf(spawnDir)
const spawn = spawnFloor
  .clone()
  .addScaledVector(spawnDir, 0.32)
  .addScaledVector(spawnUp, gameConfig.marbleRadius + 0.025)

export const START_POSITION: V3 = [spawn.x, spawn.y + lift, spawn.z]

/** First ramp only. Placement and the slingshot pull stay inside this chute. */
export const START_ZONE = {
  points: acrylicPts.map((p) => [p[0], p[1] + lift, p[2]] as V3),
  halfWidth: 0.26,
  minClear: gameConfig.marbleRadius + 0.03,
  maxRise: 1.65,
}

const bowlLifted = raised(bowlCenter)
export const FINISH_POSITION: V3 = [bowlLifted[0], bowlLifted[1] + 0.36, bowlLifted[2]]

const spiralMid = spiralPts[Math.floor(spiralPts.length / 2)]!
const funnelMid = lerp(mouth, lip, 0.5)
export const ZONES = {
  spiral: raised([spiralCenter[0], spiralMid[1], spiralCenter[2]]),
  funnel: raised(funnelMid),
  bowl: bowlLifted,
}

const GEM_COLORS = ["#3ec6ff", "#1a32f0", "#ff4fa3", "#d22ad8", "#ff9a1a", "#22c41c"]

export type GemSpot = { id: string; position: V3; color: string; golden?: boolean }
export type GlassSpot = { id: string; position: V3; quaternion: [number, number, number, number]; color: string }

function spotsOn(points: V3[], id: string, marks: number[], hover = 0.22): GemSpot[] {
  return marks.map((t, index) => {
    const scaled = t * (points.length - 1)
    const i = Math.min(points.length - 2, Math.floor(scaled))
    const f = scaled - i
    const a = new Vector3(...points[i]!)
    const b = new Vector3(...points[i + 1]!)
    const dir = b.clone().sub(a)
    const len = dir.length() || 1
    dir.multiplyScalar(1 / len)
    const { up } = qOf(dir)
    const p = a.clone().lerp(b, f).addScaledVector(up, hover)
    return {
      id: `${id}-${index}`,
      position: raised([p.x, p.y, p.z]),
      color: GEM_COLORS[(index + id.length) % GEM_COLORS.length]!,
    }
  })
}

function plateOn(points: V3[], id: string, t: number, color: string): GlassSpot {
  const scaled = t * (points.length - 1)
  const i = Math.min(points.length - 2, Math.floor(scaled))
  const f = scaled - i
  const a = new Vector3(...points[i]!)
  const b = new Vector3(...points[i + 1]!)
  const dir = b.clone().sub(a)
  dir.normalize()
  const { q, up } = qOf(dir)
  const p = a.clone().lerp(b, f).addScaledVector(up, 0.28)
  return { id, position: raised([p.x, p.y, p.z]), quaternion: tupleQ(q), color }
}

const goldenAt = (() => {
  const spot = spotsOn(spiralPts, "gold", [0.62], 0.28)[0]!
  return { ...spot, id: "golden", color: "#f6c431", golden: true as const }
})()

export const MARBLE_GEMS: GemSpot[] = [
  ...spotsOn(acrylicPts, "acrylic", [0.55, 0.82]),
  ...spotsOn(woodPts, "wood", [0.35, 0.72]),
  ...spotsOn(metalPts, "metal", [0.28, 0.62]),
  ...spotsOn(landingPts, "land", [0.4, 0.78]),
  ...spotsOn(pegPts, "pegs", [0.22, 0.48, 0.74]),
  ...spotsOn(spiralPts, "spiral", [0.16, 0.34, 0.52, 0.78]),
  ...spotsOn(tubePts, "tube", [0.4, 0.75]),
  ...spotsOn([mouth, lip], "funnel", [0.42]),
  goldenAt,
]

export const GLASS_TARGETS: GlassSpot[] = [
  plateOn(woodPts, "glass-wood", 0.82, "#ff4fa3"),
  plateOn(metalPts, "glass-metal", 0.58, "#3ec6ff"),
  plateOn(landingPts, "glass-land", 0.7, "#d22ad8"),
  plateOn(pegPts, "glass-pegs", 0.4, "#ffb020"),
  plateOn(tubePts, "glass-tube", 0.55, "#1a32f0"),
  plateOn([mouth, lip], "glass-funnel", 0.38, "#7af0ff"),
]

export const CAMERA_HOME = {
  position: [1.5, 8.4, 20.8] as V3,
  target: [1.7, 4.4, 2.1] as V3,
}

export const STUDIO_FLOOR_Y = 0
