export const gameConfig = {
  gravity: -9.81,
  marbleRadius: 0.18,
  marbleMass: 0.08,
  channelWidth: 0.86,
  wallHeight: 0.52,
  wallThickness: 0.07,
  floorThickness: 0.08,
  /** Marble center below this has left the track and landed on the studio floor. */
  missBelow: 0.3,
} as const
