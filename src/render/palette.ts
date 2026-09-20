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
  /** Flecked commercial carpet, dark blue-grey. Reads more 90s than the later tile stores. */
  carpet: 0x44566e,
  /** Warm mustard walls — the single strongest brand cue in the room. */
  wall: 0xd6a93f,
  /**
   * Acoustic drop-ceiling tile. Rendered unlit: it faces away from every light in the room, so
   * shading it correctly turns the whole ceiling black even though real tile under fluorescents
   * is one of the brightest surfaces in the store.
   */
  ceiling: 0xa8aca4,
  /** Fluorescent troffer panels. */
  light: 0xfff6e0,
  /** Gondola bodies and wire racks are blue, not wood. */
  shelfBody: 0x2f5aa8,
  shelfTrim: 0x1b3163,
  /** Putty-grey laminate, not the wood tone of the first pass. */
  counter: 0x9aa0a4,
  counterTop: 0xc2beb2,
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
export const FOG = { color: 0x2a3242, near: 14, far: 42 } as const
