"""
Process the official CNSPK logo (brand/assets/cnspk-logo.png) into clean,
anti-aliased transparent assets.

Technique: the logo is a WHITE mark on a near-black background. We use the
pixel BRIGHTNESS as the alpha channel and paint everything white:
  - white shield      -> fully opaque white
  - black background  -> fully transparent
  - anti-aliased edges-> partial alpha (smooth, no jaggies)
This is the correct way to lift a white-on-black mark onto transparency.

Outputs:
  brand/assets/cnspk-shield.png            shield mark only, square, transparent
  brand/assets/cnspk-logo-transparent.png  full lockup (shield + wordmark), transparent
  logo.png (512), apple-touch-icon (180), favicon-32/16, favicon.ico

Run:  python tools/process-logo.py
"""
from PIL import Image
import os

SRC = "brand/assets/cnspk-logo.png"
ASSETS = "brand/assets"
ROOT = "."


def white_on_alpha(img):
    """Return an RGBA image: pure white, alpha = source brightness (anti-aliased)."""
    gray = img.convert("L")            # luminance 0..255
    w, h = gray.size
    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    out.putalpha(gray)                 # bright pixels opaque, dark transparent
    # Force the colour channels to white so nothing tints grey on dark bg.
    white = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    white.putalpha(gray)
    return white


def autocrop(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def square_pad(img, pad_ratio=0.14):
    w, h = img.size
    side = int(max(w, h) * (1 + pad_ratio))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas


def main():
    base = Image.open(SRC).convert("RGBA")
    w, h = base.size
    print("source: {}x{}".format(w, h))

    # White-on-transparent version of the whole image (anti-aliased).
    full_alpha = white_on_alpha(base)

    # 1. Full lockup (shield + wordmark), trimmed.
    full = autocrop(full_alpha)
    full.save(os.path.join(ASSETS, "cnspk-logo-transparent.png"))
    print("wrote cnspk-logo-transparent.png", full.size)

    # 2. Shield only: the mark occupies roughly the top 56% of the square canvas.
    shield_region = full_alpha.crop((0, 0, w, int(h * 0.56)))
    shield = square_pad(autocrop(shield_region))
    # Keep a high-res master so CSS downscaling stays crisp.
    if shield.size[0] < 512:
        s = 512
        shield = shield.resize((s, s), Image.LANCZOS)
    shield.save(os.path.join(ASSETS, "cnspk-shield.png"))
    print("wrote cnspk-shield.png", shield.size)

    # 3. Favicons from the shield.
    def out(name, size, root=False):
        d = ROOT if root else ASSETS
        shield.resize((size, size), Image.LANCZOS).save(os.path.join(d, name))

    out("logo.png", 512, root=True)
    out("apple-touch-icon.png", 180)
    out("favicon-32.png", 32)
    out("favicon-16.png", 16)
    shield.resize((64, 64), Image.LANCZOS).save(
        os.path.join(ROOT, "favicon.ico"),
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    print("wrote logo.png (512), apple-touch (180), favicon-32/16, favicon.ico")


if __name__ == "__main__":
    main()
