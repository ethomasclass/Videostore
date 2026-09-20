/** House brand: the blue/yellow torn-ticket look, slightly sun-faded. */
export const BRAND = {
  blue: 0x1a3a8f,
  blueDark: 0x0e2054,
  yellow: 0xf5c518,
  yellowDim: 0xc79d10,
} as const

/**
 * Reference photos of real stores invert what you would guess: the *architecture* is warm
 * mustard yellow and the *fixtures* are blue. Getting that relationship backwards is what made
 * the first pass read as a generic dim warehouse instead of a video store.
 */
export const ROOM = {
  /** Blue loop carpet through the shelving. */
  carpet: 0x3d6ab0,
  /** White tile across the front of the house, where the counter is. */
  tile: 0xe2e0d6,
  /** Warm mustard walls — the single strongest brand cue in the room. */
  wall: 0xd6a93f,
  /**
   * Acoustic drop-ceiling tile, near white. Rendered unlit: it faces away from every light in
   * the room, so shading it correctly turns the whole ceiling dark even though real tile under
   * fluorescents is the brightest surface in the store.
   */
  ceiling: 0xeceae2,
  /** Fluorescent troffer panels. */
  light: 0xfff9ea,
  /**
   * Shelving is white — reference photos are unambiguous about this, and it is what keeps the
   * room bright. The blue belongs to the counter, the trim and the signage, not the gondolas.
   */
  shelfBody: 0xdedad0,
  shelfTrim: 0x2f5aa8,
  /** The counter is the blue object in the room. */
  counter: 0x2f5aa8,
  counterTop: 0x24478c,
  /** Cabinetry on the staff side of it. */
  counterCabinet: 0xc9b48f,
  /** Paper slot tags on the new release wall. */
  tag: 0xeceae0,
} as const

/** Spine colors by genre — how the shelves read at a glance. */
export const GENRE_COLOR = {
  action: 0xc1362f,
  comedy: 0xe0a51c,
  horror: 0x4a2d63,
  scifi: 0x1f6f8b,
  family: 0x3f8f4a,
  drama: 0xb5844a,
  newRelease: 0xf5c518,
} as const

/**
 * Interior haze only. The room is 18m deep, so fog that starts close crushes the whole store
 * to black — it needs to stay a soft falloff on the far wall, not a darkness the player walks into.
 */
export const FOG = { color: 0x2a3242, near: 14, far: 58 } as const
