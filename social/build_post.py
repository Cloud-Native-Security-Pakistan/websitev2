#!/usr/bin/env python3
"""One-pager — a self-contained single Instagram feed post.

Unlike the carousel, this format has no neighbouring slides for context, so it
folds the whole EU Tech Sovereignty announcement onto one canvas: headline +
short lede + a compact strip of the three key stats. Produced in two sizes:

  exports/instagram-post/post.svg      1080x1080 (square feed)
  exports/instagram-post/portrait.svg  1080x1350 (portrait feed)

Pure-Python SVG via the shared brand_kit (Electric register). No deps.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_kit import Post, CONTENT, save, BONE, BONE2, LIME, STEEL, SLATE, MONO, CARBON

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exports", "instagram-post")
C = CONTENT
PAD = 84


def stat_strip(p, y, num_size, label_size, label_lh):
    """Render CONTENT['stats'] compactly: big lime number + a one-line label,
    laid out in three columns across the canvas width."""
    usable = p.w - 2 * PAD
    colw = usable / len(C["stats"])
    # caption + divider above the strip
    p.text(PAD, y - 16, "// THE-NUMBERS", 15, fill=STEEL, font=MONO, ls=2)
    p.line(PAD, y, p.w - PAD, y, stroke=SLATE, w=1)
    num_y = y + num_size + 8
    for i, (num, lines) in enumerate(C["stats"]):
        cx = PAD + int(i * colw)
        # subtle column separators between stats
        if i > 0:
            p.line(cx - 24, y + 22, cx - 24, num_y + label_lh * len(lines), stroke=SLATE, w=1)
        p.text(cx, num_y, num, num_size, fill=LIME, weight=800, italic=True, ls=-3)
        ly = num_y + label_size + 14
        for ln in lines:
            p.text(cx, ly, ln, label_size, fill=BONE2, font=MONO, ls=0)
            ly += label_lh
    return p


def square():
    """1080x1080 — square feed one-pager."""
    p = Post(1080, 1080)
    p.brandblock("dispatch").pill(C["date"])
    p.eyebrow(C["eyebrow"], 300)
    p.display(C["headline"], 384, 84, 90)
    p.body(C["lede"], 668, size=24, lh=36, maxchars=62)
    stat_strip(p, 800, num_size=60, label_size=15, label_lh=22)
    p.footer(C["site"], C["x"])
    return p


def portrait():
    """1080x1350 — portrait feed one-pager (more breathing room, larger type)."""
    p = Post(1080, 1350)
    p.brandblock("dispatch").pill(C["date"])
    p.eyebrow(C["eyebrow"], 360)
    p.display(C["headline"], 460, 100, 108)
    p.body(C["lede"], 800, size=27, lh=40, maxchars=58)
    stat_strip(p, 968, num_size=72, label_size=16, label_lh=24)
    p.footer(C["site"], C["x"])
    return p


if __name__ == "__main__":
    posts = {"post": square(), "portrait": portrait()}
    for name, post in posts.items():
        print("wrote", save(post, os.path.join(OUT, f"{name}.svg")))
