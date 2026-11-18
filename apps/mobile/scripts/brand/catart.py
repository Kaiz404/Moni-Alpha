"""Cat Pebble, locked. Standalone art module for the Moni mascot, app icon and wordmark.

Everything is drawn on a 240-unit grid and returned as inline SVG / HTML strings.
No dependencies beyond the standard library.
"""
import math

# ---------------------------------------------------------------- palette
CREAM = '#F6F2E9'      # app ground
PAPER = '#FFFDF8'      # cards, cat body on dark grounds
SAND = '#ECE5D6'
HAIRLINE = '#DDD5C5'
INK = '#17181A'        # eyes, text
INK2 = '#4A463E'
META = '#6B665C'
DEEP = '#236B47'       # Deep mint: brand tile, cat body on cream
MINTKEY = '#8ECF9D'    # Mint key: i-dot on dark grounds
PEACH = '#F5BE98'      # inner ears
LEMON = '#F7CF3A'      # the coin
DARK = '#0B0A09'       # dark-mode ground
DARK_TEXT = '#F6F3ED'

# ---------------------------------------------------------------- grounds
# tile: tile fill. body: cat. eye: eyes. cut: slot and paw keylines (always the ground colour).
GROUNDS = {
    'deep':  dict(tile=DEEP, body=PAPER, eye=INK, cut=DEEP),
    'cream': dict(tile=CREAM, body=DEEP, eye=PAPER, cut=CREAM),
    'ink':   dict(tile=INK, body=PAPER, eye=INK, cut=INK),
    'none':  dict(tile=None, body=DEEP, eye=PAPER, cut=CREAM),   # mascot on a cream/paper page
    'dark':  dict(tile=None, body=PAPER, eye=INK, cut=DARK),     # mascot on a dark page
}

# ---------------------------------------------------------------- geometry (240 grid)
BODY = 'M120 60 C 168 60 196 98 196 142 C 196 180 168 198 120 198 C 72 198 44 180 44 142 C 44 98 72 60 120 60 Z'
EAR = ((51, 112), (55, 38), (102, 68))   # base, tip, base (left ear; right ear is mirrored)
EAR_TIP_R = 11
EAR_PIVOT = (80, 92)                     # the ear tip swings around this point; the base never moves
EAR_ROOT = (92, 112)                     # extra base point buried deep in the head
SLOT = (103, 76, 34, 10)                 # x, y, w, h; radius h/2
EYE_L, EYE_R, EYE_Y = 106, 134, 131      # eyes 12 x 28 pills, raised to make room for the coin
EYE_W, EYE_H = 12, 28
COIN = dict(cx=120, cy=178, r=22)        # held at the chest, its bottom just past the body
PAW = dict(dx=21, dy=8, rx=10, ry=14)    # two paws wrap the coin's lower sides
PAW_ROT = 14                             # paws lean in toward the coin
PAW_KEY = 4                              # paw keyline in the ground colour
COIN_RIM = 2.5
FIT, LIFT = 0.94, -6                     # scale from the base centre (120, 198), then lift

TILE_RADIUS = 0.22


def _f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def _pill(cx, cy, w, h, fill, rot=0):
    t = f' transform="rotate({rot} {_f(cx)} {_f(cy)})"' if rot else ''
    return f'<rect x="{_f(cx - w / 2)}" y="{_f(cy - h / 2)}" width="{_f(w)}" height="{_f(h)}" rx="{_f(w / 2)}" fill="{fill}"{t}></rect>'


def _eyes(kind, ink, dx=0, dy=0):
    L, R, Y = EYE_L + dx, EYE_R + dx, EYE_Y + dy
    if kind == 'pill':
        return _pill(L, Y, EYE_W, EYE_H, ink) + _pill(R, Y, EYE_W, EYE_H, ink)
    if kind == 'look':
        return _pill(L, Y, EYE_W, 24, ink) + _pill(R, Y, EYE_W, 24, ink)
    if kind == 'arc':
        return ''.join(f'<path d="M{x - 9} {Y + 5} Q{x} {Y - 13} {x + 9} {Y + 5}" fill="none" stroke="{ink}" stroke-width="7" stroke-linecap="round"></path>' for x in (L, R))
    if kind == 'closed':
        return ''.join(f'<path d="M{x - 9} {Y + 2} Q{x} {Y + 9} {x + 9} {Y + 2}" fill="none" stroke="{ink}" stroke-width="6" stroke-linecap="round"></path>' for x in (L, R))
    if kind == 'worried':
        return _pill(L - 2, Y + 2, EYE_W, 22, ink, -14) + _pill(R + 2, Y + 2, EYE_W, 22, ink, 14)
    if kind == 'round':
        return f'<circle cx="{L - 2}" cy="{Y}" r="10" fill="{ink}"></circle><circle cx="{R + 2}" cy="{Y}" r="10" fill="{ink}"></circle>'
    if kind == 'squeeze':
        return ''.join(f'<path d="M{x - 8 * k} {Y - 8} L{x + 7 * k} {Y} L{x - 8 * k} {Y + 8}" fill="none" stroke="{ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"></path>' for x, k in ((L, 1), (R, -1)))
    return ''


def _rtri(a, t, b, r):
    def toward(p, q, d):
        dx, dy = q[0] - p[0], q[1] - p[1]
        n = (dx * dx + dy * dy) ** 0.5
        return (p[0] + dx / n * d, p[1] + dy / n * d)
    p1, p2 = toward(t, a, r), toward(t, b, r)
    return f'M{_f(a[0])} {_f(a[1])} L{_f(p1[0])} {_f(p1[1])} Q{_f(t[0])} {_f(t[1])} {_f(p2[0])} {_f(p2[1])} L{_f(b[0])} {_f(b[1])} Z'


def _ear_tip(droop):
    """Ear tip after a droop (deg, + = down and out). Only the tip moves, so the base stays buried."""
    a, t, b = EAR
    th = math.radians(-droop)
    x, y = t[0] - EAR_PIVOT[0], t[1] - EAR_PIVOT[1]
    return (EAR_PIVOT[0] + x * math.cos(th) - y * math.sin(th), EAR_PIVOT[1] + x * math.sin(th) + y * math.cos(th))


def ear_base():
    """The ear's closing chain, all inside the body outline at every droop."""
    return [EAR[0], EAR_ROOT, EAR[2]]


def _ear_path(droop):
    a, _, b = EAR
    t = _ear_tip(droop)
    d = _rtri(a, t, b, EAR_TIP_R)[:-2]          # drop the closing Z
    return d + f' L{EAR_ROOT[0]} {EAR_ROOT[1]} Z'


def _inner_ear(k=0.46, lift=0.34, r=5, droop=0):
    a, t, b = EAR[0], _ear_tip(droop), EAR[2]
    c = ((a[0] + t[0] + b[0]) / 3, (a[1] + t[1] + b[1]) / 3)
    sh = ((t[0] - c[0]) * lift, (t[1] - c[1]) * lift)
    f = lambda p: (c[0] + (p[0] - c[0]) * k + sh[0], c[1] + (p[1] - c[1]) * k + sh[1])
    return _rtri(f(a), f(t), f(b), r)


def _pair(s, droop=0):
    """s is the left-side part, already posed; adds its mirror."""
    return s + f'<g transform="translate(240 0) scale(-1 1)">{s}</g>'


def _coin(cx, cy, r):
    return (f'<circle cx="{_f(cx)}" cy="{_f(cy)}" r="{_f(r)}" fill="{LEMON}" stroke="{INK}" stroke-width="{COIN_RIM}"></circle>'
            f'<circle cx="{_f(cx)}" cy="{_f(cy)}" r="{_f(r * 0.6)}" fill="none" stroke="{INK}" stroke-width="2" opacity="0.35"></circle>')


def _paw(cx, cy, rx, ry, body, cut, rot=0):
    t = f' transform="rotate({rot} {_f(cx)} {_f(cy)})"' if rot else ''
    return f'<ellipse cx="{_f(cx)}" cy="{_f(cy)}" rx="{rx}" ry="{ry}" fill="{body}" stroke="{cut}" stroke-width="{PAW_KEY}" paint-order="stroke"{t}></ellipse>'


# ---------------------------------------------------------------- moods
# body: rot (deg about base centre), sx, sy (squash), dy (hop)
# eyes: kind, ex, ey. ear: droop in degrees (+ = down/out, - = up).
# coin: (cx, cy, r) and paws: list of (cx, cy, rot) — or None for the default hug.
MOODS = ['neutral', 'happy', 'thinking', 'listening', 'worried', 'sleepy', 'celebrate', 'surprised', 'hidden']
MOOD_SPEC = {
    'neutral':   dict(rot=0, sx=1, sy=1, dy=0, e='pill', ex=0, ey=0, ear=0),
    'happy':     dict(rot=-4, sx=1.02, sy=1, dy=-4, e='arc', ex=0, ey=-2, ear=-6, coin=(120, 172, 22)),
    'thinking':  dict(rot=5, sx=1, sy=1, dy=0, e='look', ex=8, ey=-8, ear=6, coin=(120, 180, 22)),
    'listening': dict(rot=-4, sx=0.98, sy=1.02, dy=0, e='look', ex=-6, ey=-4, ear=-12,
                      coin=(174, 118, 18), paws=[(160, 134, 30), (190, 130, -20)]),
    'worried':   dict(rot=0, sx=1.06, sy=0.93, dy=0, e='worried', ex=0, ey=2, ear=20, coin=(120, 182, 20), paw_dx=15),
    'sleepy':    dict(rot=0, sx=1.1, sy=0.86, dy=0, e='closed', ex=0, ey=4, ear=10, coin=(120, 184, 22)),
    'celebrate': dict(rot=0, sx=0.96, sy=1.05, dy=-6, e='arc', ex=0, ey=-2, ear=-12,
                      coin=(120, 42, 19), paws=[(100, 50, 0), (140, 50, 0)]),
    'surprised': dict(rot=0, sx=0.94, sy=1.07, dy=0, e='round', ex=0, ey=-4, ear=-14,
                      coin=(120, 40, 18), paws=[(97, 184, -24), (143, 184, 24)]),
    'hidden':    dict(rot=0, sx=1.03, sy=0.97, dy=0, e=None, ex=0, ey=0, ear=22,
                      coin=(120, 134, 25), paws=[(93, 148, 0), (147, 148, 0)]),
}
MOOD_NOTES = {
    'neutral': 'Home. Pill eyes, ears up, paws hugging the coin at the chest.',
    'happy': 'Under budget. Arc eyes, a small tilt, coin lifted a little.',
    'thinking': 'Reading a receipt. Eyes up and right, head tilts, coin held low.',
    'listening': 'Voice capture. Coin held up to the right ear, ears perked, eyes up.',
    'worried': 'Over budget. Tilted eyes, body squashes, ears droop, paws hug the coin tighter.',
    'sleepy': 'No activity. Closed eyes, loaf squash, ears relaxed, coin resting low.',
    'celebrate': 'Debt settled. Hops up, arc eyes, coin raised over the head.',
    'surprised': 'Big spend. Round eyes, body stretches, the coin pops out of the paws and over the head.',
    'hidden': 'Amounts hidden. Ears flat, the coin held up over the eyes.',
}


def figure(mood='neutral', ground='deep', fit=None, lift=None):
    """The cat as an SVG <g> on the 240 grid (no tile)."""
    fit = FIT if fit is None else fit
    lift = LIFT if lift is None else lift
    g = GROUNDS[ground] if isinstance(ground, str) else ground
    m = MOOD_SPEC[mood]
    body, cut, eye = g['body'], g['cut'], g['eye']
    cx, cy, r = m.get('coin', (COIN['cx'], COIN['cy'], COIN['r']))
    pdx = m.get('paw_dx', PAW['dx'])
    paws = m.get('paws') or [(cx - pdx, cy + PAW['dy'], PAW_ROT), (cx + pdx, cy + PAW['dy'], -PAW_ROT)]
    tr = (f'translate(0 {m["dy"] + lift}) rotate({m["rot"]} 120 198) translate(120 198) '
          f'scale({_f(m["sx"] * fit)} {_f(m["sy"] * fit)}) translate(-120 -198)')
    s = _pair(f'<path d="{_ear_path(m["ear"])}" fill="{body}"></path>')
    s += f'<path d="{BODY}" fill="{body}"></path>'
    s += _pair(f'<path d="{_inner_ear(droop=m["ear"])}" fill="{PEACH}"></path>')
    x, y, w, h = SLOT
    s += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h / 2}" fill="{cut}"></rect>'
    if m['e']:
        s += _eyes(m['e'], eye, m['ex'], m['ey'])
    s += _coin(cx, cy, r)
    s += ''.join(_paw(px, py, PAW['rx'], PAW['ry'], body, cut, pr) for px, py, pr in paws)
    return f'<g transform="{tr}">{s}</g>'


def cat_svg(mood='neutral', size=180, ground='deep', tile=True, id_prefix='x', label=None):
    """Inline <svg>. tile=True draws the app-icon tile (radius 22 %). tile=False gives a transparent
    mascot cropped to the figure; then use ground='none' on light pages or 'dark' on dark pages.
    id_prefix is kept for API stability; the art uses no ids today."""
    lab = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    g = GROUNDS[ground]
    if tile:
        fill = g['tile'] or DEEP
        return (f'<svg width="{size}" height="{size}" viewBox="0 0 240 240" {lab} data-id="{id_prefix}" style="display: block; flex: none">'
                f'<rect width="240" height="240" rx="{_f(240 * TILE_RADIUS)}" fill="{fill}"></rect>{figure(mood, ground)}</svg>')
    vb = (24, 10, 192, 198) if mood in ('celebrate', 'surprised') else (24, 22, 192, 186)   # room for drooped ears   # ears, body and coin at fit 1
    w = size * vb[2] / vb[3]
    return (f'<svg width="{_f(w)}" height="{size}" viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" {lab} data-id="{id_prefix}" style="display: block; flex: none; overflow: visible">'
            f'{figure(mood, ground, fit=1.0, lift=0)}</svg>')


# ---------------------------------------------------------------- wordmark and lockups
FONT_LINK = '<link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&amp;display=swap" rel="stylesheet">'


def wordmark_html(size, color=INK, dot=True, dot_color=None):
    """'moni' in Funnel Display Bold, lowercase, tracking -3.5 %. dot=True swaps the i's dot for a round
    dot in Deep mint (light grounds) or dot_color; dot=False keeps a plain i in the word colour."""
    if not dot:
        tail = '<span>i</span>'
    else:
        dc = dot_color or DEEP
        d = size * 0.17
        tail = (f'<span style="position: relative; display: inline-block">ı<span style="position: absolute; left: 50%; top: {_f(size * 0.13)}px; '
                f'width: {_f(d)}px; height: {_f(d)}px; margin-left: {_f(-d / 2)}px; border-radius: 50%; background: {dc}"></span></span>')
    return (f'<div style="display: inline-flex; align-items: baseline; font-family: \'Funnel Display\', system-ui, sans-serif; font-size: {_f(size)}px; line-height: 1; font-weight: 700; letter-spacing: -0.035em; color: {color}; flex: none">'
            f'<span>mon</span>{tail}</div>')


LOCKUP = dict(h_word=0.84, h_gap=0.30, h_nudge=-0.06, s_word=0.44, s_gap=0.16, clear=0.25, min_tile=24)


def lockup_html(kind='horizontal', size=80, ground='cream', dot=True):
    """size = tile height H. ground = the page behind the lockup: 'cream' (light) or 'dark'.
    The icon tile is always Deep mint."""
    light = ground != 'dark'
    col = INK if light else DARK_TEXT
    dc = DEEP if light else MINTKEY
    icon = cat_svg('neutral', size, 'deep', True, label='Moni')
    if kind == 'horizontal':
        return (f'<div style="display: inline-flex; align-items: center; gap: {_f(size * LOCKUP["h_gap"])}px">{icon}'
                f'<div style="transform: translateY({_f(size * LOCKUP["h_nudge"])}px)">{wordmark_html(size * LOCKUP["h_word"], col, dot, dc)}</div></div>')
    return (f'<div style="display: inline-flex; flex-direction: column; align-items: center; gap: {_f(size * LOCKUP["s_gap"])}px">{icon}'
            f'{wordmark_html(size * LOCKUP["s_word"], col, dot, dc)}</div>')


# ---------------------------------------------------------------- one-colour (mono) mark
# One fill, true transparent knock-outs drawn as an SVG mask, so the cut-outs show whatever sits behind.
# Silhouette = body + ears. Cut: slot, eyes, a gap around the coin, a ring inside the coin, a gap around each paw.
MONO = dict(coin_gap=7, ring=0.48, ring_w=8, paw_gap=7, paws='behind')   # 240-grid units; paws: 'behind' | 'front' | 'none'
MONO_VB = {'tall': (21, 10, 198, 198), 'std': (24, 19, 192, 192)}   # square crops for tile=False
MONO_TILE = ('#D3E4D4', '#2B3A30')                                   # default tile: light for a dark cat, dark for a light cat
_mono_ids = [0]


def _is_dark(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.299 * r + 0.587 * g + 0.114 * b < 140


def mono_figure(mood='neutral', color=INK, mask_id='mono', fit=None, lift=None, spec=None):
    """The one-colour cat as SVG on the 240 grid: a <mask> plus one filled rect. mask_id must be unique on the page."""
    fit = FIT if fit is None else fit
    lift = LIFT if lift is None else lift
    k = dict(MONO, **(spec or {}))
    m = MOOD_SPEC[mood]
    W, B = '#FFFFFF', '#000000'
    cx, cy, r = m.get('coin', (COIN['cx'], COIN['cy'], COIN['r']))
    pdx = m.get('paw_dx', PAW['dx'])
    paws = m.get('paws') or [(cx - pdx, cy + PAW['dy'], PAW_ROT), (cx + pdx, cy + PAW['dy'], -PAW_ROT)]
    tr = (f'translate(0 {m["dy"] + lift}) rotate({m["rot"]} 120 198) translate(120 198) '
          f'scale({_f(m["sx"] * fit)} {_f(m["sy"] * fit)}) translate(-120 -198)')
    s = _pair(f'<path d="{_ear_path(m["ear"])}" fill="{W}"></path>') + f'<path d="{BODY}" fill="{W}"></path>'
    x, y, w, h = SLOT
    s += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h / 2}" fill="{B}"></rect>'
    if m['e']:
        s += _eyes(m['e'], B, m['ex'], m['ey'])
    coin = (f'<circle cx="{_f(cx)}" cy="{_f(cy)}" r="{_f(r + k["coin_gap"])}" fill="{B}"></circle>'
            f'<circle cx="{_f(cx)}" cy="{_f(cy)}" r="{_f(r)}" fill="{W}"></circle>')
    if k['ring']:
        coin += f'<circle cx="{_f(cx)}" cy="{_f(cy)}" r="{_f(r * k["ring"])}" fill="none" stroke="{B}" stroke-width="{_f(k["ring_w"])}"></circle>'
    pw = ''
    for px, py, pr in ([] if k.get('paws') == 'none' else paws):
        t = f' transform="rotate({pr} {_f(px)} {_f(py)})"' if pr else ''
        if k['paw_gap']:
            pw += f'<ellipse cx="{_f(px)}" cy="{_f(py)}" rx="{PAW["rx"]}" ry="{PAW["ry"]}" fill="{B}" stroke="{B}" stroke-width="{_f(2 * k["paw_gap"])}"{t}></ellipse>'
        pw += f'<ellipse cx="{_f(px)}" cy="{_f(py)}" rx="{PAW["rx"]}" ry="{PAW["ry"]}" fill="{W}"{t}></ellipse>'
    s += pw + coin if k.get('paws') == 'behind' else coin + pw
    return (f'<g transform="{tr}"><mask id="{mask_id}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="320" height="320">{s}</mask>'
            f'<rect x="-40" y="-40" width="320" height="320" fill="{color}" mask="url(#{mask_id})"></rect></g>')


def cat_mono_svg(size=96, color=INK, mood='neutral', id_prefix='m', label=None, tile=False, tile_color=None, spec=None):
    """The official one-colour cat. spec overrides MONO for construction studies only; boards never pass it. One fill (color); every cut-out is transparent.
    tile=False: square, cropped to the cat, for small icons, stamps and print.
    tile=True (rounded square, 22 %) or tile='round' (circle): a themed-icon tile in tile_color behind it."""
    lab = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    _mono_ids[0] += 1
    mid = f'{id_prefix}-mono{_mono_ids[0]}'
    if tile:
        tc = tile_color or MONO_TILE[0 if _is_dark(color) else 1]
        back = (f'<circle cx="120" cy="120" r="120" fill="{tc}"></circle>' if tile == 'round'
                else f'<rect width="240" height="240" rx="{_f(240 * TILE_RADIUS)}" fill="{tc}"></rect>')
        return (f'<svg width="{size}" height="{size}" viewBox="0 0 240 240" {lab} data-id="{id_prefix}" style="display: block; flex: none">'
                f'{back}{mono_figure(mood, color, mid, spec=spec)}</svg>')
    vb = MONO_VB['tall' if mood in ('celebrate', 'surprised') else 'std']
    return (f'<svg width="{size}" height="{size}" viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" {lab} data-id="{id_prefix}" style="display: block; flex: none; overflow: visible">'
            f'{mono_figure(mood, color, mid, fit=1.0, lift=0, spec=spec)}</svg>')
