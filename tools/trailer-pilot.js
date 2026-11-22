// The pilot of tools/trailer.mjs, run in the page. It flies the real game through `game.input.auto`, as a thumb would,
// and does nothing a player could not: it reads the ground to choose where to go. `window.pilot.tick()` is called once
// a step, before the game steps. A plan is a list of moves, done in turn:
//   { fly: [dx, dy] }       fly to that cell, counted from the core, cutting whatever is in the way
//   { block: n, ahead: m }  cut a moat round an n x n block `m` cells ahead (outward from the core) and go round it until it is hauled
//   { loose: r }            go round the nearest loose piece within r cells until it is hauled
//   { key: true }           hands off while a staged last key of a slab (`?shot&key`) is cut, until the slab hangs loose
//   { wait: frames }        hands off
//   { steer: [x, y], frames }  hold the stick that way
//   { home: true }          fly back to the core
//   { lord: b, ram: true }  fly straight into lord b (0 east, 1 south, 2 west, 3 north)
//   { lord: b, ring: r, laps: n }  fly round it, r cells out, n times
//   { act: 'js' }           run a line against `game` (the shop, a purchase)
(() => {
  const N = 16384, C = 8192;
  const game = tetherbore.game, d = game.drill;
  const plan = window.__plan ?? [];
  let move = -1, legs = [], left = 0, target = null, hauls = 0, budget = 0;
  const cells = list => list.map(c => [c % N, Math.floor(c / N)]);
  const lap = (list, laps) => {
    // A ring hugging the piece: in 40 sectors about its middle, a little past its furthest cell.
    const xy = cells(list), mx = xy.reduce((a, c) => a + c[0] + 0.5, 0) / xy.length, my = xy.reduce((a, c) => a + c[1] + 0.5, 0) / xy.length, B = 40, far = new Array(B).fill(0);
    for (const [x, y] of xy) { const a = Math.atan2(y + 0.5 - my, x + 0.5 - mx), b = ((a / 6.2832 + 1) * B | 0) % B, r = Math.hypot(x + 0.5 - mx, y + 0.5 - my); for (const s of [-1, 0, 1]) far[(b + s + B) % B] = Math.max(far[(b + s + B) % B], r); }
    const ring = far.map((r, b) => { const a = (b + 0.5) / B * 6.2832; return [mx + Math.cos(a) * (r + 1.7), my + Math.sin(a) * (r + 1.7)]; });
    let first = 0, best = Infinity;
    ring.forEach(([x, y], i) => { const f = Math.hypot(x - d.x, y - d.y); if (f < best) { best = f; first = i; } });
    const way = [];
    for (let n = 0; n < Math.round(B * laps); n++) way.push(ring[(first + n) % B]);
    return way;
  };
  const near = (r, min = 2) => {
    let found = null, least = r;
    for (const list of game.pieces) {
      if (list.length < min) continue;
      let sx = 0, sy = 0;
      for (const c of list) { sx += c % N + 0.5; sy += Math.floor(c / N) + 0.5; }
      const f = Math.hypot(sx / list.length - d.x, sy / list.length - d.y);
      if (f < least) { least = f; found = list; }
    }
    return found;
  };
  const next = () => {
    move++; legs = []; budget = 0; target = null; hauls = game.S.stats.hauls;
    const m = plan[move];
    if (!m) { game.input.auto = null; return; }
    if (m.fly) legs = [[C + m.fly[0] + 0.5, C + m.fly[1] + 0.5]];
    else if (m.home) legs = [[C + 0.5, C + 0.5]];
    else if (m.wait !== undefined) left = m.wait;
    else if (m.steer) left = m.frames ?? 60;
    else if (m.lord !== undefined) {
      // At a lord: straight into it (`ram`), or round it (`ring`: that many cells out, `laps` times).
      const B = game.fauna.bosses, lx = B.x[m.lord], ly = B.y[m.lord];
      if (m.ram) legs = [[lx, ly]];
      else { const from = Math.atan2(d.y - ly, d.x - lx), n = Math.round(24 * (m.laps ?? 1.3)); for (let i = 1; i <= n; i++) { const a = from + i / 24 * 6.2832; legs.push([lx + Math.cos(a) * m.ring, ly + Math.sin(a) * m.ring]); } }
    }
    else if (m.act) { try { new Function('game', 'tb', m.act)(game, tetherbore); } catch (error) { __film.errors.push(`act: ${error}`); } next(); return; }
    else if (m.block) {
      const ox = d.x - C - 0.5, oy = d.y - C - 0.5, far = Math.hypot(ox, oy) || 1, ux = far > 2 ? ox / far : 1, uy = far > 2 ? oy / far : 0, ahead = m.ahead ?? m.block + 2;
      const cx = Math.floor(d.x + ux * ahead), cy = Math.floor(d.y + uy * ahead), h = Math.floor(m.block / 2), x0 = cx - h, y0 = cy - h, x1 = x0 + m.block - 1, y1 = y0 + m.block - 1;
      const cs = [[x0 - 1, y0 - 1], [x1 + 1, y0 - 1], [x1 + 1, y1 + 1], [x0 - 1, y1 + 1]].map(([x, y]) => [x + 0.5, y + 0.5]);
      let first = 0;
      cs.forEach(([x, y], i) => { if (Math.hypot(x - d.x, y - d.y) < Math.hypot(cs[first][0] - d.x, cs[first][1] - d.y)) first = i; });
      // (`mid`: in by the middle of the near side and round to it again, so that the loop closes with the block filling
      // half the view and not at a corner of it.)
      if (m.mid) {
        const [ax, ay] = cs[first], [bx, by] = cs[(first + 1) % 4], [zx, zy] = cs[(first + 3) % 4], nearer = Math.hypot((ax + bx) / 2 - d.x, (ay + by) / 2 - d.y) <= Math.hypot((ax + zx) / 2 - d.x, (ay + zy) / 2 - d.y);
        const start = nearer ? first : (first + 3) % 4, [px, py] = cs[start], [qx, qy] = cs[(start + 1) % 4], middle = [(px + qx) / 2, (py + qy) / 2];
        legs.push(middle);
        for (let n = 1; n <= 4; n++) legs.push(cs[(start + n) % 4]);
        legs.push(middle, cs[(start + 1) % 4], cs[(start + 2) % 4]);
      } else for (let n = 0; n < 11; n++) legs.push(cs[(first + n) % 4]);
    } else if (m.loose) {
      target = near(m.loose, m.min);
      if (target) legs = lap(target, m.laps ?? 2.4); else next();
    }
  };
  window.pilot = {
    get move() { return move; },
    get done() { return move >= plan.length; },
    tick() {
      if (move < 0) next();
      const m = plan[move];
      if (!m || d.mode === 'dead') { game.input.auto = null; return; }
      // (A staged last key: js/shot.js holds the stick into it, and lets go when it is cut. Hands off until the slab hangs.)
      if (m.key) { if (near(40, m.min ?? 40) || ++budget > 400) { game.input.auto = null; next(); return this.tick(); } return; }
      if (m.wait !== undefined) { game.input.auto = null; if (--left < 0) next(); return; }
      if (m.steer) { const f = Math.hypot(...m.steer) || 1; game.input.auto = [m.steer[0] / f, m.steer[1] / f, m.power ?? 1]; if (--left < 0) { game.input.auto = null; next(); } return; }
      // (Round a piece until that piece has gone home: a crumb the tether takes on the way is no reason to stop.)
      if (m.loose && target && !game.pieceOf.has(target[target.length >> 1])) { game.input.auto = null; next(); return this.tick(); }
      if (m.block && game.S.stats.hauls !== hauls && (game.hauled?.n ?? 0) >= m.block * m.block * 0.5) { game.input.auto = null; next(); return this.tick(); }
      if (!legs.length) { game.input.auto = null; next(); return; }
      const [x, y] = legs[0], dx = x - d.x, dy = y - d.y, far = Math.hypot(dx, dy);
      if (far < (legs.length > 1 ? 0.9 : 0.5) || ++budget > 300) { legs.shift(); budget = 0; if (!legs.length) { if (m.fly || m.home || m.lord !== undefined) next(); return; } return this.tick(); }
      game.input.auto = [dx / far, dy / far, m.power ?? Math.max(0.45, Math.min(1, far / 1.5))];
    },
  };
})();
