# Draws terrain sheets side by side as the game lays them, to judge by eye:
#
#   python tools/compare.py <out.png> <sheet>[:<items>[:<floor>[:<extras>]]] ... [--scale 4] [--items a,b,...] [--seed n]
#
# Each sheet is a field 8 blocks wide and 9 tall with the same caves cut into it, over its floor (its own
# '<sheet>-floor' unless one is named), with the ore and hazard sprites of its items sheet ('<sheet>-items' unless
# one is named) lying in the rock. The fields touch, so the border between two kinds of ground shows as well.
# The extra frames of --items lie in every field; a field's own <extras> (a+b+..., each 'frame' or 'sheet=frame')
# take their place in that field. So a cross is seen beside its host with its donor's hazard in it:
#   python tools/compare.py out.png frost x-frost-ember:frost-items:frost-floor:ember-items=hazard+ember-items=oreB
# Blocks take their frame from the mask of their neighbours as World.mask does, and a sprite sits one pixel in from
# an open east or south side as the game draws it. Nothing here is lit: the game's darkness comes on top.
import json, os, sys
from PIL import Image

A = os.path.join(os.path.dirname(__file__), '..', 'assets')
atlas = json.load(open(os.path.join(A, 'atlas.json')))
imgs = {}
T = 16

def frame(sheet, name):
    s = atlas[sheet]
    if sheet not in imgs: imgs[sheet] = Image.open(os.path.join(A, s['image'])).convert('RGBA')
    x, y, w, h, _ = s['frames'][name]
    return imgs[sheet].crop((x, y, x + w, y + h))

# One field: '#' rock, '.' open, letters a sprite in rock (d dense, a oreA, b oreB, h hazard, and 1 to 4 the
# extra frames named with --items).
FIELD = [
    '########',
    '#a##..d#',
    '##.##.##',
    '#h.b#..#',
    '##...#.#',
    '#.#1.2##',
    '#.##.3.#',
    '#d4.a#h#',
    '########',
]
SPRITE = {'d': 'dense', 'a': 'oreA', 'b': 'oreB', 'h': 'hazard'}

def hash2(x, y, n):
    v = (x * 374761393 + y * 668265263 + n * 2246822519) & 0xffffffff
    v = ((v ^ (v >> 13)) * 1274126177) & 0xffffffff
    return ((v ^ (v >> 16)) & 0xffff) / 65536

def main():
    args = sys.argv[1:]
    def option(name, default):
        if name in args:
            i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
        return default
    scale = int(option('--scale', '4'))
    extra = [n for n in option('--items', '').split(',') if n]
    seed = int(option('--seed', '1'))
    out, specs = args[0], [s.split(':') for s in args[1:]]
    W, H = len(FIELD[0]), len(FIELD)
    cells = {}
    for n, spec in enumerate(specs):
        for y, row in enumerate(FIELD):
            for x, c in enumerate(row): cells[(n * W + x, y)] = (c, spec)
    solid = lambda x, y: cells.get((x, y), ('#',))[0] != '.'
    image = Image.new('RGBA', (len(specs) * W * T, H * T), (0, 0, 0, 255))
    for (x, y), (c, spec) in cells.items():
        sheet = spec[0]
        items = spec[1] if len(spec) > 1 and spec[1] else sheet + '-items'
        floor = spec[2] if len(spec) > 2 and spec[2] else sheet + '-floor'
        n, e, s, w = solid(x, y - 1), solid(x + 1, y), solid(x, y + 1), solid(x - 1, y)
        m = (1 if n else 0) | (2 if n and e and solid(x + 1, y - 1) else 0) | (4 if e else 0) | (8 if e and s and solid(x + 1, y + 1) else 0) \
            | (16 if s else 0) | (32 if s and w and solid(x - 1, y + 1) else 0) | (64 if w else 0) | (128 if w and n and solid(x - 1, y - 1) else 0)
        px, py = x * T, y * T
        floors = [f for f in atlas[floor]['frames'] if f.startswith(floor + '-255-')]
        if c == '.' or m != 255: image.alpha_composite(frame(floor, floors[int(hash2(x, y, seed) * len(floors))]), (px, py))
        if c == '.': continue
        rocks = [f for f in atlas[sheet]['frames'] if f.startswith('%s-%d-' % (sheet, m))]
        image.alpha_composite(frame(sheet, rocks[int(hash2(x, y, seed + 2) * len(rocks))]), (px, py))
        own = [n.replace('=', ':') for n in spec[3].split('+')] if len(spec) > 3 and spec[3] else extra
        name = SPRITE.get(c) or (own[int(c) - 1] if c.isdigit() and int(c) <= len(own) else None)
        if not name: continue
        src = items
        if ':' in name: src, name = name.split(':')
        if name not in atlas[src]['frames']: continue
        image.alpha_composite(frame(src, name), (px - (0 if m & 4 else 1), py - (0 if m & 16 else 1)))
    if scale != 1: image = image.resize((image.width * scale, image.height * scale), Image.NEAREST)
    image.save(out)

main()
