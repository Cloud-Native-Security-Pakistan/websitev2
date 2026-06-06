#!/usr/bin/env python3
"""
Generate CNSPK 'EU Tech Sovereignty' social posts as standalone 1080x1080 SVGs.
No external dependencies (sandbox is offline). GitHub renders SVGs inline, so the
posts are viewable directly in the repo file view.

Note: brand fonts (Bricolage Grotesque / JetBrains Mono) aren't installed here, so
SVGs use generic fallbacks (bold-italic sans for display, monospace for labels).
The HTML version at /social/ renders with the real brand fonts once deployed.
"""
import os

# ---- palette ----
CARBON, CHARCOAL, SLATE, STEEL = "#0F1115", "#1A1D24", "#2A2E37", "#6B7280"
BONE, BONE2, LIME = "#F4F1EA", "#E8E3D6", "#C7FF3E"

DISP = "Arial, 'Helvetica Neue', Helvetica, sans-serif"   # condensed-grotesque stand-in
MONO = "'JetBrains Mono', 'Courier New', monospace"

W = H = 1080
PAD = 84

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def header(defs_extra=""):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{DISP}">
<defs>
  <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse">
    <path d="M72 0H0V72" fill="none" stroke="{LIME}" stroke-width="1" stroke-opacity="0.05"/>
  </pattern>
  <radialGradient id="fade" cx="50%" cy="34%" r="75%">
    <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
    <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <mask id="fademask"><rect width="{W}" height="{H}" fill="url(#fade)"/></mask>
  {defs_extra}
</defs>
<rect width="{W}" height="{H}" fill="{CARBON}"/>
<rect width="{W}" height="{H}" fill="url(#grid)" mask="url(#fademask)"/>'''

def shield(x, y, s=1.0):
    # simple vector shield + lime dot, scaled
    return f'''<g transform="translate({x},{y}) scale({s})">
  <path d="M4 8 L31 0 L58 8 L53 40 Q31 62 31 62 Q9 40 9 40 Z" fill="none" stroke="{LIME}" stroke-width="3.5"/>
  <circle cx="31" cy="30" r="7" fill="{LIME}"/>
</g>'''

def brandblock(sub):
    return (shield(PAD, PAD, 1.0) +
        f'<text x="{PAD+82}" y="{PAD+34}" font-size="34" font-weight="800" font-style="italic" '
        f'letter-spacing="-1" fill="{BONE}">CNSPK</text>'
        f'<text x="{PAD+84}" y="{PAD+58}" font-family="{MONO}" font-size="14" letter-spacing="3" '
        f'fill="{STEEL}">{esc(sub.upper())}</text>')

def pill(text):
    tw = len(text) * 11 + 70
    x = W - PAD - tw
    return (f'<rect x="{x}" y="{PAD+4}" width="{tw}" height="46" rx="23" fill="{LIME}" fill-opacity="0.10" '
        f'stroke="{LIME}" stroke-opacity="0.30" stroke-width="1.5"/>'
        f'<circle cx="{x+26}" cy="{PAD+27}" r="7" fill="{LIME}"/>'
        f'<text x="{x+44}" y="{PAD+33}" font-family="{MONO}" font-size="17" letter-spacing="1" '
        f'fill="{LIME}">{esc(text)}</text>')

def eyebrow(text, y):
    return (f'<line x1="{PAD}" y1="{y-7}" x2="{PAD+36}" y2="{y-7}" stroke="{LIME}" stroke-width="2"/>'
        f'<text x="{PAD+50}" y="{y}" font-family="{MONO}" font-size="20" letter-spacing="2" '
        f'fill="{LIME}">{esc(text)}</text>')

def disp_lines(lines, y, size, lh, x=PAD):
    # lines: list of (text, color)
    out = []
    cy = y
    for txt, col in lines:
        out.append(f'<text x="{x}" y="{cy}" font-size="{size}" font-weight="800" font-style="italic" '
                   f'letter-spacing="-{max(2,int(size*0.03))}" fill="{col}">{esc(txt)}</text>')
        cy += lh
    return "".join(out)

def wrap(text, maxchars):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= maxchars:
            cur = (cur + " " + w).strip()
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def lede(text, y, size=27, lh=40, color=BONE2, x=PAD, maxchars=58):
    out = []
    for i, ln in enumerate(wrap(text, maxchars)):
        out.append(f'<text x="{x}" y="{y+i*lh}" font-size="{size}" fill="{color}">{esc(ln)}</text>')
    return "".join(out)

def footer(left, right, y=992):
    return (f'<line x1="{PAD}" y1="{y-34}" x2="{W-PAD}" y2="{y-34}" stroke="{SLATE}" stroke-width="1"/>'
        f'<text x="{PAD}" y="{y}" font-family="{MONO}" font-size="20" fill="{BONE}">{esc(left)}</text>'
        f'<text x="{W-PAD}" y="{y}" font-family="{MONO}" font-size="17" text-anchor="end" '
        f'fill="{STEEL}">{esc(right)}</text>')

def close():
    return "</svg>"

POSTS = {}

# ---- POST 1: announcement ----
POSTS["01-headline"] = (
    header() + brandblock("dispatch") + pill("03 JUN 2026") +
    eyebrow("// EU-TECH-SOVEREIGNTY-PACKAGE", 392) +
    disp_lines([("OPEN SOURCE", BONE), ("IS THE", BONE), ("STRATEGY NOW.", LIME)], 500, 108, 110) +
    lede("Europe just made open source critical infrastructure - not a "
         "nice-to-have. The EU's Tech Sovereignty Package puts it at the "
         "center of the bloc's digital future.", 858) +
    footer("cloudnativesecurity.pk", "@CloudSecPK") + close())

# ---- POST 2: the numbers ----
def stat(num, lines, y):
    out = [f'<text x="{PAD}" y="{y}" font-size="96" font-weight="800" font-style="italic" '
           f'letter-spacing="-4" fill="{LIME}">{esc(num)}</text>']
    ty = y - 58
    for ln in lines:
        out.append(f'<text x="{PAD+360}" y="{ty}" font-size="26" fill="{BONE2}">{esc(ln)}</text>')
        ty += 36
    out.append(f'<line x1="{PAD}" y1="{y+28}" x2="{W-PAD}" y2="{y+28}" stroke="{SLATE}" '
               f'stroke-width="1" stroke-dasharray="6 6"/>')
    return "".join(out)

POSTS["02-numbers"] = (
    header() + brandblock("the numbers") + pill("WHY IT MATTERS") +
    eyebrow("// EUROPE-BY-THE-NUMBERS", 360) +
    stat("80%+", ["of the EU's digital products, services", "& IP come from non-EU providers"], 470) +
    stat("~70%", ["of Europe's cloud market = three US", "giants: AWS, Azure, Google Cloud"], 640) +
    stat("\u20ac264B", ["spent every year on US cloud", "software (Asteres, 2025)"], 810) +
    footer("cloudnativesecurity.pk", "// source: EU Commission - AFP") + close())

# ---- POST 3: what's in the package ----
def item(tick_y, title, desc):
    return (f'<text x="{PAD}" y="{tick_y}" font-family="{MONO}" font-size="36" font-weight="700" '
            f'fill="{LIME}">+</text>'
            f'<text x="{PAD+58}" y="{tick_y-4}" font-size="40" font-weight="800" font-style="italic" '
            f'letter-spacing="-1" fill="{BONE}">{esc(title)}</text>'
            f'<text x="{PAD+58}" y="{tick_y+32}" font-size="21" fill="{STEEL}">{esc(desc)}</text>')

POSTS["03-package"] = (
    header() + brandblock("breakdown") + pill("THE PACKAGE") +
    eyebrow("// WHATS-IN-THE-BOX", 360) +
    item(452, "EU OPEN SOURCE STRATEGY", "Open digital assets: easier to discover, reuse, maintain.") +
    item(580, "CLOUD & AI DEVELOPMENT ACT", "CADA - triple EU cloud capacity, keep sectors sovereign.") +
    item(708, "CHIPS ACT 2.0", "Boost demand for European-made semiconductors.") +
    item(836, "ENERGY + AI ROADMAP", "Digitalisation and AI strategy for the energy sector.") +
    footer("cloudnativesecurity.pk", "@CloudSecPK") + close())

# ---- POST 4: the statement / quote ----
POSTS["04-statement"] = (
    header() + brandblock("the take") + pill("// THE-TAKE") +
    disp_lines([("OPEN SOURCE", BONE), ("ISN'T CHARITY.", LIME), ("IT'S", BONE),
                ("INFRASTRUCTURE.", BONE)], 430, 118, 120) +
    # kubectl stamp
    f'<g transform="translate({PAD},905) rotate(-1.2)">'
    f'<rect x="-6" y="-6" width="612" height="64" fill="{CARBON}"/>'
    f'<rect width="600" height="58" fill="{LIME}" stroke="{CARBON}" stroke-width="3"/>'
    f'<text x="24" y="39" font-family="{MONO}" font-size="26" font-weight="700" '
    f'fill="{CARBON}">kubectl apply -f sovereignty.yaml</text></g>'
    f'<text x="{W-PAD}" y="952" font-family="{MONO}" font-size="17" text-anchor="end" '
    f'fill="{STEEL}">cloudnativesecurity.pk</text>' + close())

# ---- POST 5: CTA ----
POSTS["05-join"] = (
    header() + brandblock("why we care") + pill("JOIN US") +
    eyebrow("// FROM-LAHORE-TO-BRUSSELS", 392) +
    disp_lines([("READ THE CVE.", BONE), ("DRINK THE CHAI.", LIME)], 500, 96, 100) +
    lede("Sovereign, open, interoperable infrastructure is exactly what we "
         "build and break in this chapter. The world is catching up. "
         "Come build it with us.", 770) +
    footer("cloudnativesecurity.pk/join", "@cloudnativesecuritypk") + close())

if __name__ == "__main__":
    outdir = os.path.join(os.path.dirname(__file__), "exports")
    os.makedirs(outdir, exist_ok=True)
    for name, svg in POSTS.items():
        path = os.path.join(outdir, f"{name}.svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        print("wrote", path)
