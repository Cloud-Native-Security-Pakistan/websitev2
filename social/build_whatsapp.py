#!/usr/bin/env python3
"""WhatsApp Status — 2 vertical 1080x1920 (9:16) frames for the EU Tech Sovereignty campaign.

WhatsApp Status is glanceable (~15s) and has NO clickable link sticker, so the CTA
is a large, obviously-readable text URL. Punchier and simpler than the IG story:
fewer words, bigger type. Follows the brand_kit Electric register helpers.

Safe zones (vertical): essential content lives between y=260 (top: sender name/time)
and y=1640 (bottom: caption + reply bar). Brandblock sits near the top inside the
safe zone (y~300); the URL CTA stays above y~1600.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_kit import Post, CONTENT, save, BONE, BONE2, LIME, STEEL, SLATE, MONO, CARBON

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exports", "whatsapp-status")
W, H = 1080, 1920
C = CONTENT

# Vertical safe zone: keep essential content between these y values.
TOP_SAFE = 260
BOTTOM_SAFE = 1640
BRAND_Y = 300


def frame_headline():
    """Frame 1 — the hook: big headline + one punchy line."""
    p = Post(W, H, pad=96)
    # Brand furniture parked inside the top safe zone.
    p.brandblock("dispatch", y=BRAND_Y)
    p.pill(C["date"], y=BRAND_Y + 4)

    # Eyebrow + oversized headline, the single glanceable hook.
    p.eyebrow(C["eyebrow"], 640)
    p.display(C["headline"], 800, 124, 138)

    # One punchy line — no paragraph, status is read in a blink.
    p.text(96, 1300, "Big news for open source.", 46, fill=BONE2, weight=700, italic=True, ls=-1)
    p.text(96, 1358, "Europe just made it the plan.", 46, fill=LIME, weight=700, italic=True, ls=-1)

    # Footer kept above the bottom reply-bar safe zone.
    p.footer(C["site"], C["x"], y=1560)
    return p


def frame_cta():
    """Frame 2 — condensed facts + a big, obvious text-URL CTA."""
    p = Post(W, H, pad=96)
    p.brandblock("the facts", y=BRAND_Y)
    p.pill("WHY IT MATTERS", y=BRAND_Y + 4)

    p.eyebrow("// EUROPE-RIGHT-NOW", 560)

    # 2-3 condensed facts pulled from CONTENT["stats"] — short, glanceable versions.
    facts = [
        ("80%+", "non-EU digital stack"),
        ("70%", "= three US clouds"),
        ("OPEN SOURCE", "= the strategy now"),
    ]
    y = 720
    for num, tail in facts:
        p.text(96, y, "->", 40, fill=LIME, font=MONO, weight=700)
        p.text(170, y, num, 76, fill=LIME, weight=800, italic=True, ls=-3)
        p.text(170, y + 46, tail, 34, fill=BONE2)
        p.line(96, y + 80, W - 96, y + 80, stroke=SLATE, w=1, dash="6 6")
        y += 200

    # The CTA — WhatsApp has no link sticker, so make the URL large and unmissable.
    cta_y = 1420
    p.rect(96, cta_y - 78, W - 192, 132, LIME, rx=18, fill_opacity="0.10",
           stroke=LIME, stroke_opacity="0.35", stroke_width="2")
    p.text(W // 2, cta_y - 18, "READ THE FULL STORY", 26, fill=STEEL, font=MONO, ls=4, anchor="middle")
    p.text(W // 2, cta_y + 34, C["site"], 62, fill=LIME, weight=800, italic=True, ls=-2, anchor="middle")

    # Handle line, still above the bottom safe zone.
    p.text(W // 2, cta_y + 120, C["ig"], 30, fill=BONE, font=MONO, anchor="middle")
    return p


if __name__ == "__main__":
    frames = {
        "01-headline": frame_headline(),
        "02-cta": frame_cta(),
    }
    for name, post in frames.items():
        print("wrote", save(post, os.path.join(OUT, f"{name}.svg")))
