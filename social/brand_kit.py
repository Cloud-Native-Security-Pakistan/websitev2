#!/usr/bin/env python3
"""
CNSPK social design system (Electric register) — shared by all format generators.

Pure-Python SVG builder, zero dependencies (sandbox is offline). Every format
imports this so the palette, fonts, shield, pill, grid texture and footer stay
identical across carousel / post / story / status / landscape.

Brand fonts (Bricolage Grotesque + JetBrains Mono) are not installed in the
sandbox, so SVGs declare them first and fall back to generic families. The HTML
build at /social/ renders with the real fonts once deployed.
"""

# ---------------------------------------------------------------- palette
CARBON   = "#0F1115"
CHARCOAL = "#1A1D24"
SLATE    = "#2A2E37"
STEEL    = "#6B7280"
BONE     = "#F4F1EA"
BONE2    = "#E8E3D6"
LIME     = "#C7FF3E"

DISP = "'Bricolage Grotesque', Arial, 'Helvetica Neue', Helvetica, sans-serif"
MONO = "'JetBrains Mono', 'Courier New', monospace"


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# Real CNSPK shield mark, embedded as a base64 data URI so each SVG is fully
# self-contained (relative/external refs don't load when an SVG is used as an
# <img>, so we inline the bytes).
#
# logo.png is a 512x512 file whose actual shield artwork only fills a small,
# off-centre region (large asymmetric transparent margins). Embedded as-is the
# shield looked tiny, "dropped" and cropped at the bottom. So at load time we
# decode the PNG, find the artwork's alpha bounding box, crop to it, and re-pad
# into a clean centred square with a small even margin. The result fills the
# logo box correctly and is vertically centred. Cached after first build.
_SHIELD_URI = None
LOGO_FILE = "logo.png"  # source mark; swap here to change the logo everywhere


def _decode_rgba(path):
    """Minimal pure-Python PNG -> (w, h, channels, rgba_bytes). 8-bit only."""
    import struct, zlib
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, w, h, colort, idat = 8, None, None, None, b""
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        pos += 12 + ln
        if typ == b"IHDR":
            w, h, _bd, colort, _c, _f, _i = struct.unpack(">IIBBBBB", chunk)
        elif typ == b"IDAT":
            idat += chunk
        elif typ == b"IEND":
            break
    raw = zlib.decompress(idat)
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colort]
    stride, bpp = w * ch, ch
    out, prev, i = bytearray(), bytearray(stride), 0

    def paeth(a, b, c):
        p = a + b - c
        pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        return a if pa <= pb and pa <= pc else (b if pb <= pc else c)

    for _y in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1:   line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif f == 4: line[x] = (line[x] + paeth(a, b, c)) & 255
        out += line; prev = line
    return w, h, ch, bytes(out)


def _encode_png(w, h, rgba):
    """Encode RGBA8 bytes to a PNG byte string (filter 0 scanlines)."""
    import struct, zlib
    def chunk(typ, payload):
        return (struct.pack(">I", len(payload)) + typ + payload +
                struct.pack(">I", zlib.crc32(typ + payload) & 0xffffffff))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgba[y * w * 4:(y + 1) * w * 4]
    idat = zlib.compress(bytes(raw), 9)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) +
            chunk(b"IDAT", idat) + chunk(b"IEND", b""))


def _shield_uri():
    global _SHIELD_URI
    if _SHIELD_URI is None:
        import base64, os
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", LOGO_FILE)
        w, h, ch, px = _decode_rgba(path)
        # find alpha bounding box of the actual artwork
        if ch == 4:
            minx = miny = 10 ** 9; maxx = maxy = -1
            for y in range(h):
                base = y * w * 4
                for x in range(w):
                    if px[base + x * 4 + 3] > 16:
                        if x < minx: minx = x
                        if x > maxx: maxx = x
                        if y < miny: miny = y
                        if y > maxy: maxy = y
        else:
            minx, miny, maxx, maxy = 0, 0, w - 1, h - 1
        cw, chh = maxx - minx + 1, maxy - miny + 1
        # square canvas with an even ~9% margin, artwork centred
        side = int(max(cw, chh) * 1.18)
        ox, oy = (side - cw) // 2, (side - chh) // 2
        canvas = bytearray(side * side * 4)  # transparent
        for y in range(chh):
            src = ((miny + y) * w + minx) * 4
            dst = ((oy + y) * side + ox) * 4
            canvas[dst:dst + cw * 4] = px[src:src + cw * 4]
        png = _encode_png(side, side, bytes(canvas))
        _SHIELD_URI = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
    return _SHIELD_URI


def wrap(text, maxchars):
    """Greedy word wrap to a max character count per line."""
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= maxchars:
            cur = (cur + " " + w).strip()
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ---------------------------------------------------------------- validated copy
# All claims verified via web search (3 June 2026 EU Tech Sovereignty Package).
CONTENT = {
    "date": "03 JUN 2026",
    "eyebrow": "// EU-TECH-SOVEREIGNTY-PACKAGE",
    "site": "cloudnativesecurity.pk",
    "join": "cloudnativesecurity.pk/join",
    "x": "@CloudSecPK",
    "ig": "@cloudnativesecuritypk",
    "headline": [("OPEN SOURCE", BONE), ("IS THE", BONE), ("STRATEGY NOW.", LIME)],
    "lede": ("Big news for open source. Europe's new Tech Sovereignty Package "
             "puts it right at the heart of the region's digital future."),
    "stats": [
        ("80%+",      ["of the EU's digital products,", "services & IP come from", "non-EU providers"]),
        ("~70%",      ["of Europe's cloud market =", "three US giants: AWS,", "Azure, Google Cloud"]),
        ("\u20ac264B", ["spent every year on US", "cloud software", "(Asteres, 2025)"]),
    ],
    "package": [
        ("EU OPEN SOURCE STRATEGY",    "Open digital assets: discover, reuse, maintain."),
        ("CLOUD & AI DEVELOPMENT ACT", "CADA - triple EU cloud capacity, stay sovereign."),
        ("CHIPS ACT 2.0",             "Boost demand for European-made semiconductors."),
        ("ENERGY + AI ROADMAP",       "Digitalisation & AI strategy for energy."),
    ],
    "statement": [("OPEN SOURCE", BONE), ("ISN'T CHARITY.", LIME), ("IT'S", BONE), ("INFRASTRUCTURE.", BONE)],
    "stamp": "kubectl apply -f sovereignty.yaml",
    "cta_head": [("READ THE CVE.", BONE), ("DRINK THE CHAI.", LIME)],
    "cta_lede": ("Sovereign, open, interoperable infrastructure is exactly what "
                 "we build and break in this chapter. The world is catching up. "
                 "Come build it with us."),
    "source": "// source: EU Commission - AFP - Asteres",
}


class Post:
    """A single SVG canvas. Compose with the helper methods, then .render()."""

    def __init__(self, w, h, pad=84, fade_cy=0.34, grid=72):
        self.w, self.h, self.pad = w, h, pad
        self.fade_cy = fade_cy
        self.grid = grid
        self.parts = []

    def add(self, frag):
        self.parts.append(frag)
        return self

    # ---- primitives ----
    def rect(self, x, y, w, h, fill, rx=0, **kw):
        extra = "".join(f' {k.replace("_","-")}="{v}"' for k, v in kw.items())
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{extra}/>')
        return self

    def line(self, x1, y1, x2, y2, stroke=SLATE, w=1, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{w}"{d}/>')
        return self

    def text(self, x, y, s, size, fill=BONE, font=None, weight=None, italic=False,
             ls=None, anchor="start"):
        font = font or DISP
        attrs = [f'x="{x}"', f'y="{y}"', f'font-size="{size}"', f'font-family="{font}"', f'fill="{fill}"']
        if weight:  attrs.append(f'font-weight="{weight}"')
        if italic:  attrs.append('font-style="italic"')
        if ls is not None: attrs.append(f'letter-spacing="{ls}"')
        if anchor != "start": attrs.append(f'text-anchor="{anchor}"')
        self.parts.append(f'<text {" ".join(attrs)}>{esc(s)}</text>')
        return self

    # ---- brand furniture ----
    def shield(self, x=None, y=None, s=1.0, box=None):
        x = self.pad if x is None else x
        y = self.pad if y is None else y
        box = int(64 * s) if box is None else box
        self.parts.append(
            f'<image x="{x}" y="{y}" width="{box}" height="{box}" '
            f'preserveAspectRatio="xMidYMid meet" href="{_shield_uri()}"/>')
        return self

    def brandblock(self, sub, x=None, y=None, scale=1.0):
        x = self.pad if x is None else x
        y = self.pad if y is None else y
        box = int(60 * scale)
        # text baselines
        cnspk_baseline = y + int(34 * scale)
        sub_baseline = y + int(56 * scale)
        # vertically center the shield against the two-line wordmark block
        text_center = y + int(33 * scale)
        shield_y = text_center - box // 2
        self.shield(x, shield_y, box=box)
        nx = x + box + int(20 * scale)
        self.text(nx, cnspk_baseline, "CNSPK", int(34 * scale), fill=BONE,
                  weight=800, italic=True, ls=-1)
        self.text(nx + 2, sub_baseline, sub.upper(), int(14 * scale), fill=STEEL,
                  font=MONO, ls=3)
        return self

    def pill(self, label, x=None, y=None):
        tw = len(label) * 11 + 70
        x = (self.w - self.pad - tw) if x is None else x
        y = (self.pad + 4) if y is None else y
        self.rect(x, y, tw, 46, LIME, rx=23, fill_opacity="0.10", stroke=LIME,
                  stroke_opacity="0.30", stroke_width="1.5")
        self.parts.append(f'<circle cx="{x+26}" cy="{y+23}" r="7" fill="{LIME}"/>')
        self.text(x + 44, y + 29, label, 17, fill=LIME, font=MONO, ls=1)
        return self

    def eyebrow(self, label, y, x=None):
        x = self.pad if x is None else x
        self.line(x, y - 7, x + 36, y - 7, stroke=LIME, w=2)
        self.text(x + 50, y, label, 20, fill=LIME, font=MONO, ls=2)
        return self

    def display(self, lines, y, size, lh, x=None):
        x = self.pad if x is None else x
        cy = y
        for txt, col in lines:
            self.text(x, cy, txt, size, fill=col, weight=800, italic=True,
                      ls=-max(2, int(size * 0.03)))
            cy += lh
        return self

    def body(self, text, y, size=27, lh=40, color=BONE2, x=None, maxchars=58):
        x = self.pad if x is None else x
        for i, ln in enumerate(wrap(text, maxchars)):
            self.text(x, y + i * lh, ln, size, fill=color)
        return self

    def stamp(self, x, y, text, scale=1.0):
        wpx = int((len(text) * 15 + 48) * scale)
        hpx = int(58 * scale)
        fs = int(26 * scale)
        self.parts.append(
            f'<g transform="translate({x},{y}) rotate(-1.2)">'
            f'<rect x="-6" y="-6" width="{wpx+12}" height="{hpx+12}" fill="{CARBON}"/>'
            f'<rect width="{wpx}" height="{hpx}" fill="{LIME}" stroke="{CARBON}" stroke-width="3"/>'
            f'<text x="{int(24*scale)}" y="{int(39*scale)}" font-family="{MONO}" '
            f'font-size="{fs}" font-weight="700" fill="{CARBON}">{esc(text)}</text></g>')
        return self

    def footer(self, left, right, y=None):
        y = (self.h - self.pad - 4) if y is None else y
        self.line(self.pad, y - 34, self.w - self.pad, y - 34, stroke=SLATE, w=1)
        self.text(self.pad, y, left, 20, fill=BONE, font=MONO)
        self.text(self.w - self.pad, y, right, 17, fill=STEEL, font=MONO, anchor="end")
        return self

    # ---- output ----
    def render(self):
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
            f'viewBox="0 0 {self.w} {self.h}" font-family="{DISP}">\n<defs>\n'
            f'  <pattern id="grid" width="{self.grid}" height="{self.grid}" patternUnits="userSpaceOnUse">\n'
            f'    <path d="M{self.grid} 0H0V{self.grid}" fill="none" stroke="{LIME}" '
            f'stroke-width="1" stroke-opacity="0.05"/>\n  </pattern>\n'
            f'  <radialGradient id="fade" cx="50%" cy="{int(self.fade_cy*100)}%" r="78%">\n'
            f'    <stop offset="0%" stop-color="#fff" stop-opacity="1"/>\n'
            f'    <stop offset="100%" stop-color="#fff" stop-opacity="0"/>\n  </radialGradient>\n'
            f'  <mask id="fademask"><rect width="{self.w}" height="{self.h}" fill="url(#fade)"/></mask>\n'
            f'</defs>\n'
            f'<rect width="{self.w}" height="{self.h}" fill="{CARBON}"/>\n'
            f'<rect width="{self.w}" height="{self.h}" fill="url(#grid)" mask="url(#fademask)"/>\n'
            + "\n".join(self.parts) + "\n</svg>\n")


def save(post, path):
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(post.render())
    return path
