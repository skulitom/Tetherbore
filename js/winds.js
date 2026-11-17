// How many times the tether, closed by the straight line from the core back to the drill, winds round a point: what
// makes a loose piece lassoed (js/game.js: `reelIfRound`), a creature caught (js/fauna.js: `wound`) and a lord's
// blow in the north (js/bosses.js). `pts` is the band, drill first and the core last, each point [x, y, ...] in
// cells. Where `near` is given (an array of one, made once by its caller), the least distance from the point to the
// band itself, the closing line home not counted, is written into it in the same pass. It makes nothing.
export function winds(pts, x, y, near = null) {
  let turns = 0, least = Infinity;
  for (let n = 0; n < pts.length; n++) {
    const a = pts[n], b = pts[(n + 1) % pts.length];
    if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) turns++; }
    else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) turns--;
    if (near && n + 1 < pts.length) {
      const ex = b[0] - a[0], ey = b[1] - a[1], len2 = ex * ex + ey * ey || 1, u = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / len2));
      least = Math.min(least, Math.hypot(a[0] + ex * u - x, a[1] + ey * u - y));
    }
  }
  if (near) near[0] = least;
  return turns;
}
