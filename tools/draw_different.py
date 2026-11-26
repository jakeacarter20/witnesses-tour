"""Engraving-style line drawings inside the Parley Street arch, for the three
"What makes this tour different" panels. Writes assets/different/*.svg."""
import math, random

INK = "#33391F"
SUN = "#B4592B"
PAPER = "#F7F3E9"
W, H = 240, 320
HORIZON = 200
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "different") + os.sep


def f(n):
    return f"{n:.1f}".rstrip("0").rstrip(".")


class Svg:
    def __init__(self, seed, title):
        self.r = random.Random(seed)
        self.parts = []
        self.title = title

    def add(self, s):
        self.parts.append(s)

    def line(self, pts, w=0.7, op=1, color=INK):
        d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts)
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}"' + (f' opacity="{op}"' if op != 1 else "") + "/>")

    def wobbly(self, x1, y1, x2, y2, amp=0.6, step=6, w=0.6, op=1):
        n = max(2, int(math.hypot(x2 - x1, y2 - y1) / step))
        pts = []
        for i in range(n + 1):
            t = i / n
            pts.append((x1 + (x2 - x1) * t + self.r.uniform(-amp, amp) * 0.3, y1 + (y2 - y1) * t + (self.r.uniform(-amp, amp) if 0 < i < n else 0)))
        self.line(pts, w, op)

    def poly(self, pts, fill=PAPER, w=1.0):
        d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts) + " Z"
        self.add(f'<path d="{d}" fill="{fill}" stroke="{INK}" stroke-width="{w}" stroke-linejoin="round"/>')

    def hatch_rect(self, x1, y1, x2, y2, gap=1.8, w=0.45, vertical=True, op=1):
        if vertical:
            x = x1 + gap / 2
            while x < x2:
                self.wobbly(x, y1, x, y2, amp=0.25, step=8, w=w, op=op)
                x += gap
        else:
            y = y1 + gap / 2
            while y < y2:
                self.wobbly(x1, y, x2, y, amp=0.3, step=8, w=w, op=op)
                y += gap

    # --- scenery ---------------------------------------------------------------
    def sky(self):
        # sparse engraved horizontal lines low in the sky
        y = 150
        while y < HORIZON - 2:
            density = (y - 150) / (HORIZON - 150)
            x = 18 + self.r.uniform(0, 30)
            while x < 222:
                seg = self.r.uniform(8, 34)
                if self.r.random() < 0.35 + density * 0.4:
                    self.wobbly(x, y, min(222, x + seg), y, amp=0.2, step=10, w=0.35, op=0.55)
                x += seg + self.r.uniform(4, 16)
            y += 3.2

    def sun(self, cx, r):
        self.add(f'<path d="M{f(cx - r)} {HORIZON} A{r} {r} 0 0 1 {f(cx + r)} {HORIZON} Z" fill="{SUN}"/>')

    def treeline(self, x1, x2, base=HORIZON, height=10):
        # distant woods: a scribbled bumpy band
        x = x1
        pts = [(x1, base)]
        while x < x2:
            x += self.r.uniform(2, 5)
            pts.append((min(x, x2), base - self.r.uniform(height * 0.4, height)))
        pts.append((x2, base))
        self.poly(pts, fill=PAPER, w=0.5)
        for i in range(int((x2 - x1) / 2.2)):
            xx = x1 + i * 2.2 + self.r.uniform(-0.4, 0.4)
            top = base - self.r.uniform(height * 0.2, height * 0.7)
            self.wobbly(xx, top, xx + 0.6, base, amp=0.2, step=4, w=0.35, op=0.8)

    def ground(self, top=HORIZON):
        self.line([(18, top), (222, top)], w=0.8)
        y = top + 3
        while y < 304:
            depth = (y - top) / (304 - top)
            gap_chance = 0.55 - depth * 0.35
            x = 18 + self.r.uniform(0, 10)
            while x < 222:
                seg = self.r.uniform(6, 26)
                if self.r.random() > gap_chance:
                    self.wobbly(x, y, min(222, x + seg), y + self.r.uniform(-0.3, 0.3), amp=0.35, step=7, w=0.4 + depth * 0.25, op=0.75)
                x += seg + self.r.uniform(2, 10)
            y += 3.6 - depth * 1.2

    def grass(self, n, y1, y2, x1=20, x2=220):
        for _ in range(n):
            x = self.r.uniform(x1, x2)
            y = self.r.uniform(y1, y2)
            s = 2 + (y - y1) / max(1, y2 - y1) * 3
            for k in range(self.r.randint(2, 4)):
                dx = self.r.uniform(-s * 0.8, s * 0.8)
                self.line([(x + k * 0.8, y), (x + k * 0.8 + dx, y - s * self.r.uniform(0.9, 1.6))], w=0.45)

    def path(self, x_top, y_top, sx=0.42, y_bottom=304):
        """The winding path traced from the Parley Street logo, scaled so its tip
        ends at (x_top, y_top) and its wide end sits on the bottom of the arch."""
        logo = ("M930 920 C935 872 1030 842 1032 792 C1033 766 1012 750 998 737 "
                "L1010 737 C1040 754 1086 776 1086 822 C1086 862 1068 886 1070 920 Z")
        sy = (y_bottom - y_top) / (920 - 737)
        tx = x_top - 1004 * sx
        ty = y_bottom - 920 * sy
        self.add(f'<path d="{logo}" fill="{INK}" transform="matrix({sx:.4f} 0 0 {sy:.4f} {tx:.2f} {ty:.2f})"/>')

    def clouds(self, bands):
        # light engraved cloud streaks high in the sky
        for (cx, cy, wid, rows) in bands:
            for r in range(rows):
                y = cy + r * 2.6
                half = wid / 2 * (1 - abs(r - rows / 2) / rows)
                x = cx - half + self.r.uniform(-4, 4)
                while x < cx + half:
                    seg = self.r.uniform(6, 18)
                    self.wobbly(x, y, min(cx + half, x + seg), y, amp=0.2, step=9, w=0.35, op=0.6)
                    x += seg + self.r.uniform(2, 7)

    def branch(self, x, y, ang, length, width, depth, leafy=False):
        ex = x + length * math.sin(math.radians(ang))
        ey = y - length * math.cos(math.radians(ang))
        mx = (x + ex) / 2 + self.r.uniform(-length, length) * 0.08
        my = (y + ey) / 2 + self.r.uniform(-length, length) * 0.05
        self.add(f'<path d="M{f(x)} {f(y)} Q{f(mx)} {f(my)} {f(ex)} {f(ey)}" fill="none" stroke="{INK}" stroke-width="{f(width)}" stroke-linecap="round"/>')
        if depth == 0 or length < 4:
            if leafy:
                self.leaves(ex, ey, 7 + self.r.uniform(0, 4))
            else:
                for _ in range(self.r.randint(1, 3)):
                    a = ang + self.r.uniform(-50, 50)
                    l = length * self.r.uniform(0.4, 0.9)
                    self.line([(ex, ey), (ex + l * math.sin(math.radians(a)), ey - l * math.cos(math.radians(a)))], w=0.35)
            return
        kids = self.r.choice([2, 2, 3])
        for k in range(kids):
            spread = self.r.uniform(16, 36)
            a = ang + (-spread if k == 0 else spread if k == 1 else self.r.uniform(-8, 8))
            self.branch(ex, ey, a, length * self.r.uniform(0.66, 0.8), max(0.35, width * 0.66), depth - 1, leafy)

    def leaves(self, cx, cy, rad):
        # engraved foliage: clumps of short, jagged zigzag marks
        for _ in range(int(rad * 1.1)):
            x = cx + self.r.uniform(-rad, rad)
            y = cy + self.r.uniform(-rad * 0.7, rad * 0.55)
            pts = [(x, y)]
            for k in range(self.r.randint(3, 5)):
                x += self.r.uniform(1.2, 2.2)
                y += (-1.3 if k % 2 == 0 else 1.3) * self.r.uniform(0.6, 1.1)
                pts.append((x, y))
            self.line(pts, w=0.42, op=0.95)

    def trunk(self, x, base, top, w0, w1):
        self.poly([(x - w0, base), (x - w1, top), (x + w1, top), (x + w0, base)], fill=PAPER, w=0.8)
        # bark: vertical hatch on the shaded right side
        n = 4
        for i in range(n):
            t = (i + 1) / (n + 1)
            xb = x + w0 * (t * 0.9)
            xt = x + w1 * (t * 0.9)
            self.wobbly(xb, base - 1, xt, top + 2, amp=0.5, step=5, w=0.4)

    def headstone(self, x, y, w, h):
        r = w / 2
        self.add(f'<path d="M{f(x)} {f(y)} V{f(y - h + r)} A{f(r)} {f(r)} 0 0 1 {f(x + w)} {f(y - h + r)} V{f(y)} Z" fill="{PAPER}" stroke="{INK}" stroke-width="0.7"/>')
        self.hatch_rect(x + w * 0.6, y - h + r * 0.8, x + w - 0.6, y - 0.5, gap=1.2, w=0.35)

    # --- frame and output -------------------------------------------------------
    def save(self, name):
        inner = "M18 304 L18 120 A102 102 0 0 1 222 120 L222 304 Z"
        outer = "M8 312 L8 120 A112 112 0 0 1 232 120 L232 312 Z"
        body = "\n".join(self.parts)
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t">
<title id="t">{self.title}</title>
<defs><clipPath id="arch"><path d="{inner}"/></clipPath></defs>
<path d="{inner}" fill="{PAPER}"/>
<g clip-path="url(#arch)" stroke-linecap="round" stroke-linejoin="round">
{body}
</g>
<path d="{inner}" fill="none" stroke="{INK}" stroke-width="2.6"/>
<path d="{outer}" fill="none" stroke="{INK}" stroke-width="1"/>
</svg>
'''
        open(OUT + name, "w").write(svg)
        print(name, len(svg))


# 1. Their witness: David Whitmer's monument in the Richmond cemetery
s = Svg(11, "Line drawing of David Whitmer's monument under a bare winter tree, with the sun on the horizon")
s.sky()
s.clouds([(70, 92, 80, 4), (176, 128, 70, 3)])
s.sun(70, 24)
s.treeline(18, 104, height=9)
s.treeline(160, 222, height=12)
s.ground()
s.grass(60, 206, 300)
s.headstone(34, 222, 9, 14)
s.headstone(196, 226, 10, 15)
s.headstone(178, 214, 6, 9)
# bare tree, right
s.trunk(196, 238, 168, 5, 2.6)
s.r.seed(5)
s.branch(196, 170, -14, 30, 2.6, 5)
s.branch(197, 172, 30, 30, 2.4, 5)
s.branch(195, 190, -52, 26, 1.8, 4)
s.branch(197, 200, 64, 18, 1.4, 3)
# bench, left
s.poly([(36, 250), (84, 246), (86, 251), (38, 255)], w=0.8)
s.poly([(42, 255), (48, 254.6), (48, 266), (42, 266)], w=0.7)
s.poly([(74, 252), (80, 251.6), (80, 263), (74, 263)], w=0.7)
s.hatch_rect(37, 252, 85, 255, gap=1.1, w=0.3, vertical=False)
# monument: front faces plus a hatched side face for depth
cx = 122
def block(x1, x2, y1, y2, side=7, top_slant=3, taper=0):
    s.poly([(x1 + taper, y1), (x2 - taper, y1), (x2, y2), (x1, y2)])
    s.poly([(x2 - taper, y1), (x2 - taper + side, y1 - top_slant), (x2 + side, y2 - top_slant), (x2, y2)])
    # shade the side face
    n = int(side / 1.3)
    for i in range(1, n):
        t = i / n
        s.wobbly(x2 - taper + side * t, y1 - top_slant * t + 0.5, x2 + side * t, y2 - top_slant * t - 0.5, amp=0.2, step=8, w=0.4)
    s.line([(x1 + taper, y1), (x1 + taper + side, y1 - top_slant), (x2 - taper + side, y1 - top_slant)], w=0.8)
block(cx - 27, cx + 27, 238, 264, side=9, top_slant=4)
block(cx - 21, cx + 21, 222, 238, side=8, top_slant=3.5)
block(cx - 16, cx + 16, 112, 222, side=7, top_slant=3, taper=2)
block(cx - 15, cx + 15, 104, 112, side=7, top_slant=3, taper=1)
block(cx - 11, cx + 11, 98, 104, side=5, top_slant=2.5, taper=1)
block(cx - 7, cx + 7, 93, 98, side=4, top_slant=2, taper=1)
# carved inscription, suggested by short lines on the front face
yy = 124
for row in range(9):
    width = s.r.uniform(14, 22) if row != 4 else 10
    s.line([(cx - width / 2, yy), (cx + width / 2, yy)], w=0.55)
    yy += 4.6 if row != 3 else 7
s.line([(cx - 14, 252), (cx + 14, 252)], w=0.9)  # WHITMER on the base
s.grass(14, 262, 268, cx - 34, cx + 40)
# winding path up to the monument
s.path(122, 265)
s.save("their-witness.svg")

# 2. Your questions: benches under a shade tree, a place to sit and talk
s = Svg(23, "Line drawing of two stone benches facing each other under a large shade tree, with the sun on the horizon")
s.sky()
s.clouds([(186, 96, 60, 3), (50, 70, 50, 3)])
s.sun(176, 26)
s.treeline(18, 70, height=8)
s.treeline(196, 222, height=10)
s.ground()
s.grass(70, 206, 300)
s.trunk(110, 254, 186, 8, 4.4)
s.r.seed(9)
s.branch(108, 190, -42, 30, 3.6, 4, leafy=True)
s.branch(112, 190, 40, 32, 3.6, 4, leafy=True)
s.branch(110, 188, -8, 34, 3.4, 4, leafy=True)
s.branch(107, 200, -70, 26, 2.6, 3, leafy=True)
s.branch(113, 202, 72, 26, 2.6, 3, leafy=True)
# shadow under the tree
for i in range(8):
    y = 254 + i * 1.6
    s.wobbly(58 + i * 2, y, 156 - i * 2, y, amp=0.3, step=7, w=0.45)
# two benches angled toward each other
def bench(x, y, w, lean):
    s.poly([(x, y), (x + w, y + lean), (x + w + 1, y + lean + 5), (x + 1, y + 5)], w=0.8)
    s.hatch_rect(x + 1, y + 2 + max(0, lean), x + w, y + 4.6 + max(0, lean), gap=1.1, w=0.3, vertical=False)
    s.poly([(x + 4, y + 5), (x + 10, y + 5 + lean * 0.2), (x + 10, y + 17), (x + 4, y + 17)], w=0.7)
    s.poly([(x + w - 9, y + 5 + lean * 0.8), (x + w - 3, y + 5 + lean), (x + w - 3, y + 17 + lean), (x + w - 9, y + 17 + lean)], w=0.7)
bench(50, 262, 44, 4)
bench(132, 266, 44, -4)
s.path(116, 268)
s.grass(10, 280, 292, 40, 190)
s.save("your-questions.svg")

# 3. Your witness: Carthage Jail behind its iron fence
s = Svg(37, "Line drawing of Carthage Jail behind an iron fence, with the sun on the horizon")
s.sky()
s.clouds([(120, 74, 90, 4)])
s.r.seed(41)
s.trunk(22, 214, 150, 4, 2.4)
s.branch(22, 152, 22, 32, 2.6, 4, leafy=True)
s.branch(22, 160, -10, 26, 2.2, 3, leafy=True)
s.trunk(212, 210, 140, 4, 2.4)
s.branch(212, 142, -22, 32, 2.6, 4, leafy=True)
s.branch(212, 156, 20, 22, 2, 3, leafy=True)
s.sun(46, 20)
s.treeline(18, 60, height=9)
s.ground()
s.grass(40, 270, 300)
x1, x2, top, base = 62, 198, 168, 266
# chimney and roof
s.poly([(150, 128), (162, 128), (162, 150), (150, 150)], w=0.8)
s.hatch_rect(150, 130, 162, 150, gap=2.4, w=0.35, vertical=False)
s.poly([(x1 - 6, top), (x2 + 6, top), (x2 - 16, 142), (x1 + 16, 142)], w=0.9)
for i in range(1, 9):
    y = 142 + i * 2.9
    s.wobbly(x1 + 16 - i * 2.4, y, x2 - 16 + i * 2.4, y, amp=0.2, step=9, w=0.4)
# stone wall with block courses
s.poly([(x1, top), (x2, top), (x2, base), (x1, base)], w=1)
y = top + 6
row = 0
while y < base:
    s.wobbly(x1 + 0.5, y, x2 - 0.5, y, amp=0.25, step=9, w=0.4, op=0.85)
    x = x1 + (row % 2) * 7 + s.r.uniform(2, 8)
    while x < x2 - 3:
        s.line([(x, y - 5.6), (x, y)], w=0.35, op=0.8)
        x += s.r.uniform(10, 18)
    y += 6
    row += 1
# right end shaded
s.hatch_rect(x2 - 12, top + 1, x2 - 0.5, base - 0.5, gap=1.4, w=0.35)
# windows: two storeys
def window(x, y, w=15, h=22):
    s.poly([(x - 1.5, y - 1.5), (x + w + 1.5, y - 1.5), (x + w + 1.5, y + h + 2.5), (x - 1.5, y + h + 2.5)], fill=PAPER, w=0.8)
    s.poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], fill=PAPER, w=0.7)
    for k in (1, 2):
        s.line([(x + w * k / 3, y), (x + w * k / 3, y + h)], w=0.45)
    for k in (1, 2, 3):
        s.line([(x, y + h * k / 4), (x + w, y + h * k / 4)], w=0.45)
    s.hatch_rect(x + 0.6, y + 0.6, x + w / 3, y + h / 2, gap=1.3, w=0.3)
for wx in (74, 100, 152, 176):
    window(wx, 178)
for wx in (74, 100, 176):
    window(wx, 222, h=20)
# door
s.poly([(124, 216), (142, 216), (142, base), (124, base)], fill=PAPER, w=0.9)
s.poly([(127, 222), (139, 222), (139, base), (127, base)], fill=PAPER, w=0.7)
s.hatch_rect(127.5, 222.5, 138.5, base - 0.5, gap=1.5, w=0.35)
s.line([(133, 222), (133, base)], w=0.6)
# stars on the wall, like the real building
for sx, sy in ((114, 206), (168, 172), (150, 214)):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = 2.6 if i % 2 == 0 else 1.1
        pts.append((sx + rr * math.cos(a), sy + rr * math.sin(a)))
    s.poly(pts, fill=INK, w=0.3)
# path to the door, through a gap in the fence
s.path(133, 266, sx=0.5)
# iron fence across the front, open at the gate
def fence(xa, xb):
    s.line([(xa, 272), (xb, 272)], w=0.7)
    s.line([(xa, 290), (xb, 290)], w=0.7)
    x = xa
    while x <= xb:
        s.line([(x, 268), (x, 296)], w=0.55)
        s.poly([(x - 1.1, 268.5), (x, 265.5), (x + 1.1, 268.5)], fill=INK, w=0.3)
        x += 4.4
    # little rings between the rails
    x = xa + 2.2
    while x < xb:
        s.add(f'<circle cx="{f(x)}" cy="281" r="1.6" fill="none" stroke="{INK}" stroke-width="0.4"/>')
        x += 4.4
for xa, xb in ((18, 110), (156, 222)):
    fence(xa, xb)
for px in (110, 156):
    s.poly([(px - 2, 264), (px + 2, 264), (px + 2, 298), (px - 2, 298)], fill=INK, w=0.4)
s.save("your-witness.svg")

# 3b. Firesides: evenings around a campfire under the stars. At night the fire, not the sun,
#     is the one rust bright spot.
s = Svg(61, "Line drawing of a campfire between two log benches under a night sky with a crescent moon")
# night sky: dense engraved lines, thinning toward the horizon
y = 16
while y < HORIZON - 1:
    depth = (y - 16) / (HORIZON - 16)
    x = 18 + s.r.uniform(0, 8)
    while x < 222:
        seg = s.r.uniform(10, 40)
        if s.r.random() < 0.92 - depth * 0.5:
            s.wobbly(x, y, min(222, x + seg), y, amp=0.2, step=10, w=0.4, op=0.7)
        x += seg + s.r.uniform(1.5, 5)
    y += 2.3
# crescent moon
s.add(f'<path d="M70 64 A18 18 0 1 0 88 92 A14 14 0 1 1 70 64 Z" fill="{PAPER}" stroke="{INK}" stroke-width="0.8"/>')
# stars: little cleared crosses in the hatching
for _ in range(26):
    sx, sy = s.r.uniform(26, 214), s.r.uniform(30, 160)
    if math.hypot(sx - 74, sy - 80) < 26:
        continue
    r = s.r.choice([1.4, 1.8, 2.4])
    s.add(f'<circle cx="{f(sx)}" cy="{f(sy)}" r="{f(r + 0.8)}" fill="{PAPER}"/>')
    s.line([(sx - r, sy), (sx + r, sy)], w=0.45)
    s.line([(sx, sy - r), (sx, sy + r)], w=0.45)
# pines in silhouette at both edges
def pine(x, base, h, w):
    tiers = 6
    pts = [(x, base - h)]
    for i in range(1, tiers + 1):
        t = i / tiers
        yy = base - h + h * 0.86 * t
        ww = w * t
        pts.append((x + ww, yy))
        if i < tiers:
            pts.append((x + ww * 0.45, yy - 1))
    rev = [(2 * x - px, py) for px, py in reversed(pts[1:])]
    s.poly(pts + rev, fill=INK, w=0.5)
    s.poly([(x - 1.6, base - h * 0.15), (x + 1.6, base - h * 0.15), (x + 1.8, base), (x - 1.8, base)], fill=INK, w=0.3)
pine(30, 204, 70, 16)
pine(50, 202, 50, 12)
pine(212, 206, 82, 18)
pine(190, 202, 52, 12)
s.treeline(60, 176, height=7)
s.ground()
s.grass(40, 210, 300)
# log benches either side of the fire
def log(x, y, w, h):
    s.poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], fill=PAPER, w=0.8)
    s.hatch_rect(x + 1, y + h * 0.55, x + w - 1, y + h - 0.5, gap=1.1, w=0.35, vertical=False)
    for k in range(3):
        xx = x + s.r.uniform(6, w - 6)
        s.line([(xx, y + 1.5), (xx + s.r.uniform(4, 9), y + 1.8)], w=0.35)
    s.add(f'<ellipse cx="{f(x + w)}" cy="{f(y + h / 2)}" rx="{f(h * 0.32)}" ry="{f(h / 2)}" fill="{PAPER}" stroke="{INK}" stroke-width="0.8"/>')
    s.add(f'<ellipse cx="{f(x + w)}" cy="{f(y + h / 2)}" rx="{f(h * 0.16)}" ry="{f(h / 4)}" fill="none" stroke="{INK}" stroke-width="0.4"/>')
log(28, 248, 50, 9)
log(162, 252, 46, 9)
# ground glow: lines thin out near the fire
s.add(f'<ellipse cx="120" cy="262" rx="30" ry="7" fill="{PAPER}"/>')
# ring of stones
for i in range(11):
    a = math.pi * 2 * i / 11
    sx, sy = 120 + 20 * math.cos(a), 262 + 6 * math.sin(a)
    s.add(f'<ellipse cx="{f(sx)}" cy="{f(sy)}" rx="3.4" ry="2.3" fill="{PAPER}" stroke="{INK}" stroke-width="0.6"/>')
# flames
s.add(f'<path d="M120 216 C124 230 136 236 133 252 C131 260 109 261 107 252 C104 240 115 236 113 226 C118 232 119 228 120 216 Z" fill="{SUN}"/>')
s.add(f'<path d="M106 238 C110 244 112 248 110 256 L104 256 C101 250 103 244 106 238 Z" fill="{SUN}"/>')
s.add(f'<path d="M135 236 C138 242 140 248 137 256 L131 256 C131 249 134 244 135 236 Z" fill="{SUN}"/>')
s.add(f'<path d="M120 236 C123 243 127 247 124 255 L116 255 C114 249 118 244 120 236 Z" fill="{PAPER}"/>')
for _ in range(9):
    s.add(f'<circle cx="{f(s.r.uniform(108, 134))}" cy="{f(s.r.uniform(186, 212))}" r="{f(s.r.uniform(0.7, 1.3))}" fill="{SUN}"/>')
# crossed logs in the fire
s.poly([(102, 260), (106, 256), (138, 263), (135, 267)], fill=PAPER, w=0.7)
s.poly([(104, 265), (134, 255), (138, 259), (107, 269)], fill=PAPER, w=0.7)
s.path(120, 272)
s.save("firesides.svg")
