# Draws a pocket as the plan lays it, in the ground of one of its kins, to judge by eye whether it reads as a
# place of its own:
#
#   python tools/pockets.py <out.png> <hive|drift|ash> [--kin mire] [--rho 10] [--scale 4] [--seed 1] [--solid]
#
# The picture is 36 cells by 24. On the left the kin's ground with caves, ore and hazards in it (the field of
# tools/compare.py); on the right the pocket, a disc of radius --rho laid as docs/CONTENT-PLAN.md describes it
# (items 6 and 7): the hive's chambers, doors, nuggets and stalks; the drift's boulders in open sky; the flats'
# ash salted with tektites. The pocket's ground is 'wax', 'pumice' or 'ash' over its own floor, and its minerals
# come from the 'minerals' sheet. --solid fills the disc with the pocket's rock alone, to look for the grid.
# The shapes here are for the eye only: the game's own are in js/world.js. Nothing is lit.
import json, math, os, sys
from PIL import Image

A = os.path.join(os.path.dirname(__file__), '..', 'assets')
atlas = json.load(open(os.path.join(A, 'atlas.json')))
imgs = {}
T, W, H = 16, 36, 24
CX, CY = 23, 12

def frame(sheet, name):
    s = atlas[sheet]
    if sheet not in imgs: imgs[sheet] = Image.open(os.path.join(A, s['image'])).convert('RGBA')
    x, y, w, h, _ = s['frames'][name]
    return imgs[sheet].crop((x, y, x + w, y + h))

def hash2(x, y, n):
    v = (x * 374761393 + y * 668265263 + n * 2246822519) & 0xffffffff
    v = ((v ^ (v >> 13)) * 1274126177) & 0xffffffff
    return ((v ^ (v >> 16)) & 0xffff) / 65536

CAVES = ['########', '#a##..d#', '##.##.##', '#h.b#..#', '##...#.#', '#.#..d##', '#.##.a.#', '#d..a#h#', '########']
SPRITE = {'d': 'dense', 'a': 'oreA', 'b': 'oreB', 'h': 'hazard'}
POCKET = {'hive': ('wax', 'mire'), 'drift': ('pumice', 'frost'), 'ash': ('ash', 'ember')}

# What lies at an offset (u, v) from the pocket's centre: None for open, else the sprite over the rock ('' for none).
def hive(u, v, seed):
    row = v // 8
    uu = u + (4 if row % 2 else 0)
    col = uu // 8
    a, b = uu % 8, v % 8
    if b == 0 and a == 0: return ''
    if b == 0: return None if a == 4 and hash2(col, row, seed + 45) < 0.4 else ''
    if a == 0: return None if b == 4 and hash2(col + 99, row, seed + 45) < 0.4 else ''
    c = hash2(col, row, seed + 46)
    if c >= 0.70: return None
    if c >= 0.55: return ''
    if 3 <= a <= 5 and 3 <= b <= 5: return 'amber'
    side = int(hash2(col, row, seed + 47) * 4)
    if side == 0 and b == 4 and a < 3: return 'stalk-h'
    if side == 1 and b == 4 and a > 5: return 'stalk-h'
    if side == 2 and a == 4 and b < 3: return 'stalk-v'
    if side == 3 and a == 4 and b > 5: return 'stalk-v'
    return None

def drift(u, v, seed, rho):
    gx, gy = math.floor(u / 7), math.floor(v / 7)
    if hash2(gx, gy, seed + 48) >= 0.8: return None
    bx = gx * 7 + 3.5 + (hash2(gx, gy, seed + 49) - 0.5) * 1.6
    by = gy * 7 + 3.5 + (hash2(gy, gx, seed + 49) - 0.5) * 1.6
    r = 1.2 + 0.8 * hash2(gx, gy, seed + 50)
    if math.hypot(bx, by) + r + 2 > rho: return None
    d = math.hypot(u + 0.5 - bx, v + 0.5 - by)
    return None if d >= r else 'aerolite' if d < 0.9 else ''

def ash(u, v, seed):
    return 'tektite' if hash2(u, v, seed + 51) < 0.1 else ''

def main():
    args = sys.argv[1:]
    def option(name, default):
        if name in args:
            i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
        return default
    solid_only = '--solid' in args
    if solid_only: args.remove('--solid')
    scale, seed, rho = int(option('--scale', '4')), int(option('--seed', '1')), float(option('--rho', '10'))
    out, shape = args[0], args[1]
    rock, kin = POCKET[shape]
    kin = option('--kin', kin)
    # cells: (sheet, floor, sprite sheet, sprite or '' or None for open)
    cells = {}
    for y in range(H):
        for x in range(W):
            u, v = x - CX, y - CY
            d = math.hypot(u + 0.5, v + 0.5)
            wob = 1 if shape == 'drift' else 0.8 + 0.4 * hash2(x // 3, y // 3, seed + 44)
            if d < rho * wob:
                what = '' if solid_only else hive(u, v, seed) if shape == 'hive' else drift(u, v, seed, rho) if shape == 'drift' else ash(u, v, seed)
                cells[(x, y)] = (rock, rock + '-floor', 'minerals', what)
            else:
                c = CAVES[y - 7][x - 2] if 2 <= x < 10 and 7 <= y < 16 else '#'
                cells[(x, y)] = (kin, kin + '-floor', kin + '-items', None if c == '.' else SPRITE.get(c, ''))
    solid = lambda x, y: cells.get((x, y), (0, 0, 0, ''))[3] is not None
    image = Image.new('RGBA', (W * T, H * T), (0, 0, 0, 255))
    for (x, y), (sheet, floor, items, what) in cells.items():
        n, e, s, w = solid(x, y - 1), solid(x + 1, y), solid(x, y + 1), solid(x - 1, y)
        m = (1 if n else 0) | (2 if n and e and solid(x + 1, y - 1) else 0) | (4 if e else 0) | (8 if e and s and solid(x + 1, y + 1) else 0) \
            | (16 if s else 0) | (32 if s and w and solid(x - 1, y + 1) else 0) | (64 if w else 0) | (128 if w and n and solid(x - 1, y - 1) else 0)
        px, py = x * T, y * T
        floors = [f for f in atlas[floor]['frames'] if f.startswith(floor + '-255-')]
        if what is None or m != 255: image.alpha_composite(frame(floor, floors[int(hash2(x, y, seed) * len(floors))]), (px, py))
        if what is None: continue
        rocks = [f for f in atlas[sheet]['frames'] if f.startswith('%s-%d-' % (sheet, m))]
        image.alpha_composite(frame(sheet, rocks[int(hash2(x, y, seed + 2) * len(rocks))]), (px, py))
        if what and what in atlas[items]['frames']:
            image.alpha_composite(frame(items, what), (px - (0 if m & 4 else 1), py - (0 if m & 16 else 1)))
    if scale != 1: image = image.resize((image.width * scale, image.height * scale), Image.NEAREST)
    image.save(out)

main()
