/** Lackluster house brand: the blue/yellow torn-ticket look, slightly sun-faded. */
export const BRAND = {
  blue: 0x1a3a8f,
  blueDark: 0x0e2054,
  yellow: 0xf5c518,
  yellowDim: 0xc79d10,
} as const

export const ROOM = {
  /** Flecked commercial carpet. */
  carpet: 0x2b3d52,
  wall: 0xb9b2a0,
  ceiling: 0xd8d4c6,
  /** Fluorescent troffer panels. */
  light: 0xfff6e0,
  shelfBody: 0x4a3f33,
  shelfTrim: 0x2a2a2e,
  counter: 0x7a6247,
  linoleum: 0xa89e88,
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
