#!/usr/bin/env python3
"""
Verification helper: pull the ACTUAL embedded shield out of a generated SVG,
decode it, and composite it onto the carbon background at the real post scale.
Writes a PNG you can open on GitHub to confirm the logo is complete (not cut).
Pure-Python, no deps.
"""
import os, sys, re, base64, struct, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HERE = os.path.dirname(os.path.abspath(__file__))
CARBON = (0x0F, 0x11, 0x15)


def decode(buf):
    assert buf[:8] == b"\x89PNG\r\n\x1a\n"
    pos, w, h, ct, idat = 8, None, None, None, b""
    while pos < len(buf):
        ln = struct.unpack(">I", buf[pos:pos + 4])[0]
        t = buf[pos + 4:pos + 8]; c = buf[pos + 8:pos + 8 + ln]; pos += 12 + ln
        if t == b"IHDR": w, h, _b, ct, _, _, _ = struct.unpack(">IIBBBBB", c)
        elif t == b"IDAT": idat += c
        elif t == b"IEND": break
    raw = zlib.decompress(idat); ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    st = w * ch; out = bytearray(); prev = bytearray(st); i = 0
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
    return w, h, ch, bytes(out)


def encode(w, h, rgba):
    def ck(t, p): return struct.pack(">I", len(p)) + t + p + struct.pack(">I", zlib.crc32(t + p) & 0xffffffff)
    raw = bytearray()
    for y in range(h):
        raw.append(0); raw += rgba[y * w * 4:(y + 1) * w * 4]
    return (b"\x89PNG\r\n\x1a\n" + ck(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) +
            ck(b"IDAT", zlib.compress(bytes(raw), 9)) + ck(b"IEND", b""))


def nn_resize(w, h, ch, px, nw, nh):
    out = bytearray(nw * nh * 4)
    for y in range(nh):
        sy = min(h - 1, y * h // nh)
        for x in range(nw):
            sx = min(w - 1, x * w // nw)
            s = (sy * w + sx) * ch; d = (y * nw + x) * 4
            if ch == 4: out[d:d + 4] = px[s:s + 4]
            else:
                out[d:d + 3] = px[s:s + 3]; out[d + 3] = 255
    return bytes(out)


def main():
    svg_path = os.path.join(HERE, "exports", "carousel", "01-cover.svg")
    svg = open(svg_path).read()
    uri = re.search(r"data:image/png;base64,([A-Za-z0-9+/=]+)", svg).group(1)
    w, h, ch, px = decode(base64.b64decode(uri))

    # Render onto a 400x400 carbon tile, shield drawn at ~78% (as on the post)
    tile = 400
    sw = int(tile * 0.78)
    shield = nn_resize(w, h, ch, px, sw, sw)
    canvas = bytearray()
    for _ in range(tile * tile):
        canvas += bytes((*CARBON, 255))
    off = (tile - sw) // 2
    for y in range(sw):
        for x in range(sw):
            s = (y * sw + x) * 4; a = shield[s + 3]
            if a == 0: continue
            dx, dy = off + x, off + y; d = (dy * tile + dx) * 4
            for k in range(3):
                canvas[d + k] = (shield[s + k] * a + canvas[d + k] * (255 - a)) // 255
            canvas[d + 3] = 255
    out = os.path.join(HERE, "_preview", "logo-on-carbon.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "wb").write(encode(tile, tile, bytes(canvas)))
    print("embedded shield:", w, "x", h, "-> wrote", out)


if __name__ == "__main__":
    main()
