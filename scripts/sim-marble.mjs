import RAPIER from "@dimforge/rapier3d-compat"
import { TRACK_PIECES, START_POSITION, FINISH_POSITION } from "../src/game/trackLayout.ts"
import { SURFACE_PHYSICS } from "../src/physics/materials.ts"
import { gameConfig } from "../src/config/gameConfig.ts"

await RAPIER.init()

function run(seed) {
  const world = new RAPIER.World({ x: 0, y: gameConfig.gravity, z: 0 })
  world.numSolverIterations = 8
  world.maxCcdSubsteps = 4
  for (const piece of TRACK_PIECES) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...piece.position))
    const phys = SURFACE_PHYSICS[piece.material]
    if (piece.kind === "box") {
      const [hx, hy, hz] = piece.size.map((v) => v / 2)
      const col = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setFriction(phys.friction)
        .setRestitution(phys.restitution)
        .setRotation({ x: piece.quaternion[0], y: piece.quaternion[1], z: piece.quaternion[2], w: piece.quaternion[3] })
      world.createCollider(col, body)
    } else {
      const col = RAPIER.ColliderDesc.cylinder(piece.height / 2, piece.radius)
        .setFriction(phys.friction)
        .setRestitution(phys.restitution)
      world.createCollider(col, body)
    }
  }
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(4, -0.2, 4))
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.15, 18).setFriction(0.6).setRestitution(0.02), floor)

  const marble = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(START_POSITION[0], START_POSITION[1], START_POSITION[2])
      .setLinvel(seed * 0.02, 0, -seed * 0.01)
      .setLinearDamping(0.08)
      .setAngularDamping(0.08)
      .setCcdEnabled(true)
      .setAdditionalMass(gameConfig.marbleMass),
  )
  world.createCollider(
    RAPIER.ColliderDesc.ball(gameConfig.marbleRadius).setFriction(0.03).setRestitution(0.22).setDensity(2),
    marble,
  )

  const dt = 1 / 60
  let finished = false
  let missed = false
  let finishAt = 0
  const samples = []
  let still = 0
  for (let i = 0; i < 60 * 50; i++) {
    world.step()
    const t = marble.translation()
    const v = marble.linvel()
    const speed = Math.hypot(v.x, v.y, v.z)
    if (i % 30 === 0) samples.push([+(t.x).toFixed(2), +(t.y).toFixed(2), +(t.z).toFixed(2), +speed.toFixed(2)])
    const dx = t.x - FINISH_POSITION[0]
    const dy = t.y - FINISH_POSITION[1]
    const dz = t.z - FINISH_POSITION[2]
    if (!finished && Math.hypot(dx, dz) < 0.55 && Math.abs(dy) < 0.55 && t.y > gameConfig.missBelow) {
      finished = true
      finishAt = i * dt
    }
    if (t.y < gameConfig.missBelow) {
      missed = true
      break
    }
    if (speed < 0.05) still += 1
    else still = 0
    if (still > 240 && !finished) break
  }
  const end = marble.translation()
  return {
    seed,
    finished,
    missed,
    finishAt: +finishAt.toFixed(2),
    end: [+end.x.toFixed(2), +end.y.toFixed(2), +end.z.toFixed(2)],
    samples,
  }
}

const results = []
for (const seed of [0, 1, -1, 2, -2]) results.push(run(seed))
console.log(JSON.stringify(results.map(({ samples, ...r }) => ({ ...r, path: r.finished ? undefined : samples.filter((_, i) => i % 2 === 0) })), null, 2))
