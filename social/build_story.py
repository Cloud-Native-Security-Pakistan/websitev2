#!/usr/bin/env python3
"""Instagram Story — 3 vertical 1080x1920 (9:16) frames for the EU Tech Sovereignty drop.

Story safe zones: keep essential content between y=300 (top username/avatar strip)
and y=1620 (bottom reply bar / link sticker). Brandblock sits near y=320, the
footer / CTA stays above y=1600.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_kit import Post, CONTENT, save, BONE, BONE2, LIME, STEEL, SLATE, MONO, CARBON

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exports", "instagram-story")
W, H = 1080, 1920
C = CONTENT

# Story safe-zone anchors
TOP_SAFE = 320     # brandblock / pill row
BOT_SAFE = 1600    # footer / CTA must stay above this


def hook():
    """Frame 1 — headline + lede."""
    p = Post(W, H, pad=96, fade_cy=0.42)
    p.brandblock("dispatch", y=TOP_SAFE)
    p.pill(C["date"], y=TOP_SAFE)
    p.eyebrow(C["eyebrow"], 760)
    p.display(C["headline"], 900, 120, 134)
    p.body(C["lede"], 1340, size=32, lh=46, maxchars=42)
    p.footer(C["site"], C["x"], y=BOT_SAFE)
    p.text(W - 96, 1556, "01 / 03", 16, fill=STEEL, font=MONO, anchor="end")
    return p


def numbers():
    """Frame 2 — the three stats, big and stacked."""
    p = Post(W, H, pad=96, fade_cy=0.42)
    p.brandblock("the numbers", y=TOP_SAFE)
    p.pill("WHY IT MATTERS", y=TOP_SAFE)
    p.eyebrow("// EUROPE-BY-THE-NUMBERS", 720)
    y = 880
    for num, lines in C["stats"]:
        p.text(96, y, num, 140, fill=LIME, weight=800, italic=True, ls=-6)
        ty = y - 96
        for ln in lines:
            p.text(560, ty, ln, 30, fill=BONE2)
            ty += 42
        p.line(96, y + 44, W - 96, y + 44, stroke=SLATE, w=1, dash="6 6")
        y += 248
    p.text(96, 1560, C["source"], 20, fill=STEEL, font=MONO)
    p.footer(C["site"], C["x"], y=BOT_SAFE)
    p.text(W - 96, 1556, "02 / 03", 16, fill=STEEL, font=MONO, anchor="end")
    return p


def cta():
    """Frame 3 — CTA head + lede + tap-the-link stamp."""
    p = Post(W, H, pad=96, fade_cy=0.42)
    p.brandblock("why we care", y=TOP_SAFE)
    p.pill("JOIN US", y=TOP_SAFE)
    p.eyebrow("// FROM-LAHORE-TO-BRUSSELS", 760)
    p.display(C["cta_head"], 920, 100, 116)
    p.body(C["cta_lede"], 1230, size=32, lh=46, maxchars=42)
    # tap-the-link CTA near the bottom safe zone (above the link sticker line)
    p.stamp(96, 1480, C["join"])
    p.text(W - 96, 1556, C["ig"], 20, fill=STEEL, font=MONO, anchor="end")
    p.text(96, 1556, "TAP THE LINK", 20, fill=BONE, font=MONO, ls=2)
    return p


if __name__ == "__main__":
    frames = {
        "01-hook": hook(),
        "02-numbers": numbers(),
        "03-cta": cta(),
    }
    for name, post in frames.items():
        print("wrote", save(post, os.path.join(OUT, f"{name}.svg")))
