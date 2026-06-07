#!/usr/bin/env python3
"""
SVG review/validation for the CNSPK social kit. Pure-Python, no deps.

For every social/exports/**/*.svg it checks:
  1. well-formed XML
  2. root <svg> has explicit width/height (and matches the expected size for its folder)
  3. exactly one embedded logo <image> with a base64 PNG data URI
  4. the embedded logo PNG is SQUARE (square-into-square can't crop) and the
     artwork is centered (symmetric alpha margins) -> guards the "cut logo" bug
  5. no element sits off-canvas; heuristic text-overflow check (font-size * 0.6 * len)

Exit code is non-zero if any ERROR is found (WARN does not fail the run).
"""
import os, re, sys, glob, base64, struct, zlib, xml.dom.minidom

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORTS = os.path.join(HERE, "exports")

EXPECTED = {            # folder -> (w, h)
    "carousel": (1080, 1080),
    "instagram-post": None,            # mixed: post=1080x1080, portrait=1080x1350
    "instagram-story": (1080, 1920),
    "whatsapp-status": (1080, 1920),
    "landscape": None,                 # linkedin=1200x630, twitter=1200x675
}


def png_alpha_bbox(buf):
    pos, w, h, ct, idat = 8, None, None, None, b""
    while pos < len(buf):
        ln = struct.unpack(">I", buf[pos:pos + 4])[0]
        t = buf[pos + 4:pos + 8]; c = buf[pos + 8:pos + 8 + ln]; pos += 12 + ln
        if t == b"IHDR": w, h, _b, ct, _, _, _ = struct.unpack(">IIBBBBB", c)
        elif t == b"IDAT": idat += c
        elif t == b"IEND": break
    if ct != 6:
        return w, h, None
    raw = zlib.decompress(idat); ch = 4; st = w * ch
    out = bytearray(); prev = bytearray(st); i = 0
    def pae(a, b, c):
        p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        return a if pa <= pb and pa <= pc else (b if pb <= pc else c)
    for _ in range(h):
        f = raw[i]; i += 1; line = bytearray(raw[i:i + st]); i += st
        for x in range(st):
            a = line[x - ch] if x >= ch else 0; b = prev[x]; cc = prev[x - ch] if x >= ch else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif f == 4: line[x] = (line[x] + pae(a, b, cc)) & 255
        out += line; prev = line
    minx = miny = 10 ** 9; maxx = maxy = -1
    for y in range(h):
        bs = y * w * 4
        for x in range(w):
            if out[bs + x * 4 + 3] > 16:
                minx = min(minx, x); maxx = max(maxx, x); miny = min(miny, y); maxy = max(maxy, y)
    return w, h, (minx, miny, maxx, maxy)


def check(path):
    errors, warns = [], []
    raw = open(path, encoding="utf-8").read()

    # 1. well-formed XML
    try:
        xml.dom.minidom.parseString(raw)
    except Exception as e:
        return [f"XML parse failed: {e}"], []

    # 2. canvas size
    m = re.search(r'<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"', raw)
    if not m:
        errors.append("root <svg> missing width/height")
        return errors, warns
    W, H = int(m.group(1)), int(m.group(2))
    folder = os.path.basename(os.path.dirname(path))
    exp = EXPECTED.get(folder)
    if exp and (W, H) != exp:
        errors.append(f"size {W}x{H} != expected {exp[0]}x{exp[1]} for {folder}/")

    # 3 & 4. embedded logo
    uris = re.findall(r"data:image/png;base64,([A-Za-z0-9+/=]+)", raw)
    if len(uris) != 1:
        errors.append(f"expected exactly 1 embedded logo, found {len(uris)}")
    else:
        png = base64.b64decode(uris[0])
        lw, lh, bbox = png_alpha_bbox(png)
        if lw != lh:
            errors.append(f"embedded logo not square ({lw}x{lh}) -> could crop")
        if bbox:
            minx, miny, maxx, maxy = bbox
            top, bot = miny, lh - 1 - maxy
            left, right = minx, lw - 1 - maxx
            if abs(top - bot) > max(6, 0.15 * lh):
                warns.append(f"logo vertically off-center (top={top} bottom={bot})")
            if abs(left - right) > max(6, 0.15 * lw):
                warns.append(f"logo horizontally off-center (left={left} right={right})")

    # 5. off-canvas + text overflow heuristic
    for tm in re.finditer(r'<text\b[^>]*\bx="(-?\d+)"[^>]*\bfont-size="(\d+)"[^>]*>(.*?)</text>', raw):
        x = int(tm.group(1)); fs = int(tm.group(2)); txt = re.sub(r"&[a-z]+;", "X", tm.group(3))
        anchor = "end" if 'text-anchor="end"' in tm.group(0) else (
                 "middle" if 'text-anchor="middle"' in tm.group(0) else "start")
        if x < 0 or x > W:
            errors.append(f"text x={x} off-canvas (W={W}): {txt[:24]!r}")
        width = int(len(txt) * fs * 0.58)
        if anchor == "start":      left, right = x, x + width
        elif anchor == "middle":   left, right = x - width // 2, x + width // 2
        else:                      left, right = x - width, x
        if right > W + 4 or left < -4:
            warns.append(f"text may overflow edge (~[{left}..{right}] vs W={W}): {txt[:24]!r}")
    for im in re.finditer(r'<image\b[^>]*\bx="(-?\d+)"[^>]*\by="(-?\d+)"[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"', raw):
        x, y, w, h = map(int, im.groups())
        if x < 0 or y < 0 or x + w > W or y + h > H:
            errors.append(f"image box off-canvas: x{x} y{y} {w}x{h} (canvas {W}x{H})")
    return errors, warns


def main():
    files = sorted(glob.glob(os.path.join(EXPORTS, "**", "*.svg"), recursive=True))
    if not files:
        print("no SVGs found"); return 1
    total_err = 0
    for f in files:
        rel = os.path.relpath(f, HERE)
        errs, warns = check(f)
        status = "OK  " if not errs else "FAIL"
        print(f"[{status}] {rel}")
        for e in errs:
            print(f"        ERROR: {e}"); total_err += 1
        for w in warns:
            print(f"        warn:  {w}")
    print(f"\n{len(files)} files checked, {total_err} error(s)")
    return 1 if total_err else 0


if __name__ == "__main__":
    sys.exit(main())
