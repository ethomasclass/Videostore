import * as THREE from 'three'
import type { Input } from '../core/Input'

const EYE_HEIGHT = 1.62
const RADIUS = 0.34
const WALK_SPEED = 2.9
const RUN_SPEED = 4.6
const ACCEL = 14
const LOOK_SENSITIVITY = 0.0022
const PITCH_LIMIT = Math.PI / 2 - 0.05
/** A retail employee's shoes on commercial carpet: a short, flat-footed bob. */
const BOB_RATE = 9.5
const BOB_HEIGHT = 0.035

export class Player {
  readonly camera: THREE.PerspectiveCamera
  readonly position = new THREE.Vector3(-7, EYE_HEIGHT, 7.2)

  /** Clocked in at the door, facing down the aisles toward the New Release wall. */
  private yaw = 0
  private pitch = 0
  private readonly velocity = new THREE.Vector3()
  private bobPhase = 0

  constructor(aspect: number) {
    // A narrow-ish FOV keeps the affine warp from tearing at the screen edges. The far plane
    // has to clear the sky backdrop and its corners, which sit well beyond the parking lot.
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.08, 220)
    this.camera.position.copy(this.position)
  }

  update(dt: number, input: Input, colliders: readonly THREE.Box3[]): void {
    const look = input.takeLook()
    this.yaw += look.yaw * LOOK_SENSITIVITY
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.pitch * LOOK_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT)

    const { forward, strafe } = input.movement

    const wish = new THREE.Vector3(
      Math.sin(this.yaw) * -forward + Math.cos(this.yaw) * strafe,
      0,
      Math.cos(this.yaw) * -forward - Math.sin(this.yaw) * strafe,
    )
    // A thumbstick gives partial deflection, so clamp rather than normalize — pushing the stick
    // halfway should walk at half speed instead of snapping to full.
    if (wish.lengthSq() > 1) wish.normalize()

    const speed = input.isRunning ? RUN_SPEED : WALK_SPEED
    this.velocity.lerp(wish.multiplyScalar(speed), Math.min(1, ACCEL * dt))

    this.moveAxis('x', this.velocity.x * dt, colliders)
    this.moveAxis('z', this.velocity.z * dt, colliders)

    const moving = this.velocity.lengthSq() > 0.05
    this.bobPhase = moving ? this.bobPhase + dt * BOB_RATE : 0
    const bob = moving ? Math.sin(this.bobPhase) * BOB_HEIGHT : 0

    this.camera.position.set(this.position.x, this.position.y + bob, this.position.z)
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }

  /** Axis-separated sweep, so sliding along a shelf front feels right instead of sticking. */
  private moveAxis(axis: 'x' | 'z', delta: number, colliders: readonly THREE.Box3[]): void {
    if (delta === 0) return
    const previous = this.position[axis]
    this.position[axis] = previous + delta

    for (const collider of colliders) {
      if (this.intersects(collider)) {
        this.position[axis] = previous
        this.velocity[axis] = 0
        return
      }
    }
  }

  private intersects(box: THREE.Box3): boolean {
    const closestX = THREE.MathUtils.clamp(this.position.x, box.min.x, box.max.x)
    const closestZ = THREE.MathUtils.clamp(this.position.z, box.min.z, box.max.z)
    const dx = this.position.x - closestX
    const dz = this.position.z - closestZ
    return dx * dx + dz * dz < RADIUS * RADIUS
  }
}
