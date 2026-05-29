"""
Process the official CNSPK logo (Frame 11 -> brand/assets/cnspk-logo.png):
  1. Make the near-black background transparent.
  2. Auto-crop the shield mark (top portion) -> cnspk-shield.png  (square, transparent)
  3. Keep the full lockup (shield + wordmark) on transparent -> cnspk-logo-transparent.png
  4. Generate favicons: logo.png (512), apple-touch (180), 32, 16, favicon.ico

Run:  python tools/process-logo.py
"""
from PIL import Image
import os

SRC = "brand/assets/cnspk-logo.png"
ASSETS = "brand/assets"
ROOT = "."

def make_bg_transparent(img, thresh=28):
    """Black (and near-black) background -> transparent alpha."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r <= thresh and g <= thresh and b <= thresh:
                px[x, y] = (r, g, b, 0)
    return img

def autocrop(img):
    """Crop to the non-transparent bounding box."""
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img

def square_pad(img, pad_ratio=0.12):
    """Center the image on a transparent square canvas with padding."""
    w, h = img.size
    side = int(max(w, h) * (1 + pad_ratio))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas

def main():
    base = Image.open(SRC).convert("RGBA")
    w, h = base.size
    print(f"source: {w}x{h}")

    # 1. Full lockup on transparent bg
    transparent = make_bg_transparent(base)
    full = autocrop(transparent)
    full.save(os.path.join(ASSETS, "cnspk-logo-transparent.png"))
    print("wrote cnspk-logo-transparent.png", full.size)

    # 2. Shield only: the mark sits in roughly the top 58% of the 1020 canvas,
    #    text below. Crop the top region, then autocrop + square-pad.
    shield_region = transparent.crop((0, 0, w, int(h * 0.58)))
    shield = square_pad(autocrop(shield_region))
    shield.save(os.path.join(ASSETS, "cnspk-shield.png"))
    print("wrote cnspk-shield.png", shield.size)

    # 3. Favicons from the shield (square, recognizable at small sizes)
    fav_src = shield
    fav_src.resize((512, 512), Image.LANCZOS).save(os.path.join(ROOT, "logo.png"))
    fav_src.resize((180, 180), Image.LANCZOS).save(os.path.join(ASSETS, "apple-touch-icon.png"))
    fav_src.resize((32, 32), Image.LANCZOS).save(os.path.join(ASSETS, "favicon-32.png"))
    fav_src.resize((16, 16), Image.LANCZOS).save(os.path.join(ASSETS, "favicon-16.png"))
    # ICO with multiple sizes
    fav_src.resize((64, 64), Image.LANCZOS).save(
        os.path.join(ROOT, "favicon.ico"),
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    print("wrote logo.png (512), apple-touch (180), favicon-32, favicon-16, favicon.ico")

if __name__ == "__main__":
    main()
