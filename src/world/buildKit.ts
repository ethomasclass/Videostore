import * as THREE from 'three'
import { createPS1Material, type PS1MaterialOptions } from '../render/ps1Material'

/** Store footprint, in meters. A small strip-mall unit. */
export const STORE = {
  minX: -12,
  maxX: 12,
  minZ: -9,
  maxZ: 9,
  height: 3.4,
} as const

/** Shopfront glazing band. */
export const GLASS = { sillY: 0.5, headY: 2.7 } as const

/** The lot sits a step down from the shop floor, so there is a curb to read at the threshold. */
export const LOT_Y = -0.16

/** In at the left, out at the right — the one-way flow every one of these stores had. */
export const DOORS = { entranceX: -7, exitX: 7, halfWidth: 1.05 } as const

export const VHS = { width: 0.028, height: 0.19, depth: 0.11 } as const

export function box(width: number, height: number, depth: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), createPS1Material({ color }))
}

export function unlitBox(width: number, height: number, depth: number, color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    createPS1Material({ color, unlit: true }),
  )
}

export function panel(width: number, height: number, options: PS1MaterialOptions): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), createPS1Material(options))
}

/** Places a mesh by its center and returns a collider for it. */
export function place(parent: THREE.Object3D, mesh: THREE.Mesh, x: number, y: number, z: number): THREE.Box3 {
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return new THREE.Box3().setFromObject(mesh)
}

/**
 * Distance beyond a surface where the sky and other backdrops stop taking fog. Fog is tuned for
 * an 18m room; applied to something 40m out it turns the sky the same grey as everything else.
 */
export function makeFogless(material: THREE.ShaderMaterial): THREE.ShaderMaterial {
  material.uniforms.uFogNear!.value = 1e6
  material.uniforms.uFogFar!.value = 1e6 + 1
  return material
}
