#!/usr/bin/env python3
"""Landscape — wide share cards for the EU Tech Sovereignty story.

  linkedin.svg -> 1200x630  (LinkedIn / Facebook / OpenGraph share card)
  twitter.svg  -> 1200x675  (X/Twitter 16:9 card)

The canvas is wide and short, so we use a LEFT-aligned text column (the text
never runs the full width), a smaller display size / line-height than the square
formats, and reduced eyebrow + footer offsets so nothing overflows the height.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_kit import Post, CONTENT, save, BONE, BONE2, LIME, STEEL, SLATE, MONO, CARBON

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exports", "landscape")
C = CONTENT

# Short, one-line lede (derived from the validated CONTENT copy) that fits the
# narrow left column on a short canvas without wrapping.
LEDE = "Big news for open source - Europe just made it the plan."


def landscape(h):
    """Build a 1200 x h landscape share card."""
    p = Post(1200, h, pad=72)

    # top row: brandblock left, pill right
    p.brandblock("dispatch").pill(C["date"])

    # eyebrow + headline, left column, mid-canvas
    p.eyebrow(C["eyebrow"], 210)
    p.display(C["headline"], 290, 76, 82)   # 3 lines: baselines 290 / 372 / 454

    # one-line lede under the headline (kept in the left column)
    p.body(LEDE, h - 130, size=24, lh=34, color=BONE2, maxchars=80)

    # footer pinned near the bottom (reduced offset for the short canvas)
    p.footer(C["site"], C["x"])
    return p


if __name__ == "__main__":
    cards = {
        "linkedin": landscape(630),
        "twitter": landscape(675),
    }
    for name, post in cards.items():
        print("wrote", save(post, os.path.join(OUT, f"{name}.svg")))
