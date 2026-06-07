#!/usr/bin/env python3
"""Carousel — 6 square 1080x1080 slides telling the EU Tech Sovereignty story."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_kit import Post, CONTENT, save, BONE, BONE2, LIME, STEEL, SLATE, MONO, CARBON

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exports", "carousel")
S = 1080
C = CONTENT


def cover():
    p = Post(S, S)
    p.brandblock("dispatch").pill(C["date"])
    p.eyebrow(C["eyebrow"], 392)
    p.display(C["headline"], 500, 108, 110)
    p.body(C["lede"], 858)
    p.footer(C["site"], C["x"])
    p.text(S - 84, 470, "01 / 06", 16, fill=STEEL, font=MONO, anchor="end")
    return p


def numbers():
    p = Post(S, S)
    p.brandblock("the numbers").pill("WHY IT MATTERS")
    p.eyebrow("// EUROPE-BY-THE-NUMBERS", 360)
    y = 470
    for num, lines in C["stats"]:
        p.text(84, y, num, 96, fill=LIME, weight=800, italic=True, ls=-4)
        ty = y - 58
        for ln in lines:
            p.text(444, ty, ln, 25, fill=BONE2)
            ty += 34
        p.line(84, y + 28, S - 84, y + 28, stroke=SLATE, w=1, dash="6 6")
        y += 170
    p.footer(C["site"], C["source"])
    p.text(S - 84, 470, "02 / 06", 16, fill=STEEL, font=MONO, anchor="end")
    return p


def package():
    p = Post(S, S)
    p.brandblock("breakdown").pill("THE PACKAGE")
    p.eyebrow("// WHATS-IN-THE-BOX", 360)
    y = 452
    for title, desc in C["package"]:
        p.text(84, y, "+", 36, fill=LIME, font=MONO, weight=700)
        p.text(142, y - 4, title, 40, fill=BONE, weight=800, italic=True, ls=-1)
        p.text(142, y + 32, desc, 21, fill=STEEL)
        y += 128
    p.footer(C["site"], C["x"])
    p.text(S - 84, 470, "03 / 06", 16, fill=STEEL, font=MONO, anchor="end")
    return p


def momentum():
    p = Post(S, S)
    p.brandblock("the signals").pill("NOT A COINCIDENCE")
    p.eyebrow("// A-DECADE-GOING-OFFICIAL", 360)
    rows = [
        ("QWANT > GOOGLE", "EU Parliament default search, from 4 Jun 2026."),
        ("LINUX ON DESKTOPS", "Government offices across Europe migrating off Windows."),
        ("OPEN SOURCE STRATEGY", "Quiet momentum is now written into EU policy."),
    ]
    y = 470
    for title, desc in rows:
        p.text(84, y, "->", 34, fill=LIME, font=MONO, weight=700)
        p.text(150, y - 2, title, 38, fill=BONE, weight=800, italic=True, ls=-1)
        p.text(150, y + 32, desc, 21, fill=STEEL)
        y += 138
    p.footer(C["site"], C["x"])
    p.text(S - 84, 470, "04 / 06", 16, fill=STEEL, font=MONO, anchor="end")
    return p


def statement():
    p = Post(S, S)
    p.brandblock("the take").pill("// THE-TAKE")
    p.display(C["statement"], 430, 104, 116)
    p.stamp(84, 905, C["stamp"])
    p.text(S - 84, 952, C["site"], 17, fill=STEEL, font=MONO, anchor="end")
    p.text(S - 84, 200, "05 / 06", 16, fill=STEEL, font=MONO, anchor="end")
    return p


def cta():
    p = Post(S, S)
    p.brandblock("why we care").pill("JOIN US")
    p.eyebrow("// FROM-LAHORE-TO-BRUSSELS", 392)
    p.display(C["cta_head"], 500, 96, 100)
    p.body(C["cta_lede"], 770)
    p.footer(C["join"], C["ig"])
    p.text(S - 84, 470, "06 / 06", 16, fill=STEEL, font=MONO, anchor="end")
    return p


if __name__ == "__main__":
    slides = {
        "01-cover": cover(), "02-numbers": numbers(), "03-package": package(),
        "04-momentum": momentum(), "05-statement": statement(), "06-cta": cta(),
    }
    for name, post in slides.items():
        print("wrote", save(post, os.path.join(OUT, f"{name}.svg")))
