#!/usr/bin/env python3
"""
Compose all 15 posts onto ONE big board SVG -> social/exports/figma-board.svg

Drag this single file into Figma (File > Place image / just drag-drop) and you
get every post in one organized board, grouped by format with section headers
and per-post labels. Also opens fine in a browser.

Each post is embedded as a namespaced nested <svg> (via Post.fragment) so there
are no id collisions between the 15 posts.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brand_kit as bk
from brand_kit import CARBON, CHARCOAL, SLATE, STEEL, BONE, BONE2, LIME, DISP, MONO, esc
import build_carousel as C
import build_post as P
import build_story as S
import build_whatsapp as W
import build_landscape as L

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exports", "figma-board.svg")

SECTIONS = [
    ("CAROUSEL  ·  1080x1080  ·  6 slides", [
        ("01 cover", C.cover()), ("02 numbers", C.numbers()), ("03 package", C.package()),
        ("04 momentum", C.momentum()), ("05 statement", C.statement()), ("06 cta", C.cta()),
    ]),
    ("INSTAGRAM POST  ·  square + portrait", [
        ("post 1:1", P.square()), ("portrait 4:5", P.portrait()),
    ]),
    ("INSTAGRAM STORY  ·  1080x1920  ·  3 frames", [
        ("01 hook", S.hook()), ("02 numbers", S.numbers()), ("03 cta", S.cta()),
    ]),
    ("WHATSAPP STATUS  ·  1080x1920  ·  2 frames", [
        ("01 headline", W.frame_headline()), ("02 cta", W.frame_cta()),
    ]),
    ("LINKEDIN / X  ·  landscape", [
        ("linkedin 1200x630", L.landscape(630)), ("twitter 1200x675", L.landscape(675)),
    ]),
]

GAP = 90
SECTION_GAP = 220
PAD = 120
LABEL_H = 70
HEADER_H = 90


def build():
    rows = []
    for title, posts in SECTIONS:
        row_w = sum(p.w for _, p in posts) + GAP * (len(posts) - 1)
        row_h = max(p.h for _, p in posts)
        rows.append((title, posts, row_w, row_h))
    board_w = PAD * 2 + max(r[2] for r in rows)
    board_h = PAD * 2 + sum(HEADER_H + LABEL_H + r[3] + SECTION_GAP for r in rows) + 160

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{board_w}" height="{board_h}" '
        f'viewBox="0 0 {board_w} {board_h}" font-family="{DISP}">',
        f'<rect width="{board_w}" height="{board_h}" fill="#07080A"/>',
        f'<text x="{PAD}" y="{PAD - 30}" font-size="54" font-weight="800" font-style="italic" '
        f'fill="{BONE}" letter-spacing="-2">CNSPK SOCIAL KIT</text>',
        f'<text x="{PAD}" y="{PAD + 14}" font-family="{MONO}" font-size="22" fill="{LIME}" '
        f'letter-spacing="2">// eu-tech-sovereignty  ·  15 posts  ·  editable in figma</text>',
    ]

    uid = 0
    y = PAD + 90
    for title, posts, row_w, row_h in rows:
        out.append(f'<text x="{PAD}" y="{y + 40}" font-family="{MONO}" font-size="26" '
                   f'fill="{BONE2}" letter-spacing="2">{esc(title)}</text>')
        out.append(f'<line x1="{PAD}" y1="{y + 58}" x2="{board_w - PAD}" y2="{y + 58}" '
                   f'stroke="{SLATE}" stroke-width="2"/>')
        y += HEADER_H
        x = PAD
        for label, post in posts:
            out.append(f'<text x="{x}" y="{y + 42}" font-family="{MONO}" font-size="24" '
                       f'fill="{STEEL}" letter-spacing="1">{esc(label)}  [{post.w}x{post.h}]</text>')
            out.append(post.fragment(uid, x, y + LABEL_H))
            out.append(f'<rect x="{x}" y="{y + LABEL_H}" width="{post.w}" height="{post.h}" '
                       f'fill="none" stroke="{SLATE}" stroke-width="2"/>')
            uid += 1
            x += post.w + GAP
        y += LABEL_H + row_h + SECTION_GAP

    out.append("</svg>\n")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"wrote {OUT}  ({board_w}x{board_h})")


if __name__ == "__main__":
    build()
