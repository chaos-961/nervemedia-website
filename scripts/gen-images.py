"""Generate responsive, modern-format variants of the hero image + an OG share image.

Run from the project root:  python scripts/gen-images.py
Re-runnable and idempotent. Source stays untouched as the ultimate fallback.
"""
import os
from PIL import Image

try:
    import pillow_avif  # noqa: F401  (registers the AVIF plugin if installed)
except Exception:  # noqa: BLE001
    pass

SRC = "assets/nerve-media-beirut-shoot.jpeg"
OUT = "assets"
BASE = "nerve-media-beirut-shoot"

WIDTHS = [1600, 1200, 800]          # CSS-px widths covered by srcset
JPEG_FALLBACK_W = 1200              # downscaled jpeg for non-webp/avif browsers
OG_SIZE = (1200, 630)              # social share card

def info(p):
    try:
        kb = os.path.getsize(p) / 1024
        return f"{p}  ({kb:.0f} KB)"
    except OSError:
        return p

def save_webp(im, path, q=80):
    im.save(path, "WEBP", quality=q, method=6)

def save_avif(im, path, q=62):
    # Pillow gained native AVIF in 11.3; older builds need pillow-avif-plugin.
    im.save(path, "AVIF", quality=q)

def save_jpeg(im, path, q=82):
    im.convert("RGB").save(path, "JPEG", quality=q, optimize=True, progressive=True)

def main():
    src = Image.open(SRC)
    src.load()
    sw, sh = src.size
    print(f"source: {info(SRC)}  {sw}x{sh}")

    avif_ok = True
    for w in WIDTHS:
        h = round(w * sh / sw)
        im = src.resize((w, h), Image.LANCZOS)
        save_webp(im, f"{OUT}/{BASE}-{w}.webp")
        print("  wrote", info(f"{OUT}/{BASE}-{w}.webp"))
        if avif_ok:
            try:
                save_avif(im, f"{OUT}/{BASE}-{w}.avif")
                print("  wrote", info(f"{OUT}/{BASE}-{w}.avif"))
            except Exception as e:  # noqa: BLE001
                avif_ok = False
                print(f"  AVIF unsupported in this Pillow build ({e}); skipping AVIF.")

    # Downscaled JPEG fallback
    h = round(JPEG_FALLBACK_W * sh / sw)
    jpg = src.resize((JPEG_FALLBACK_W, h), Image.LANCZOS)
    save_jpeg(jpg, f"{OUT}/{BASE}-{JPEG_FALLBACK_W}.jpg")
    print("  wrote", info(f"{OUT}/{BASE}-{JPEG_FALLBACK_W}.jpg"))

    # OG share image: center-crop "cover" to 1200x630
    tw, th = OG_SIZE
    scale = max(tw / sw, th / sh)
    rw, rh = round(sw * scale), round(sh * scale)
    cover = src.resize((rw, rh), Image.LANCZOS)
    left = (rw - tw) // 2
    top = round((rh - th) * 0.38)  # bias slightly above center for faces
    top = max(0, min(top, rh - th))
    og = cover.crop((left, top, left + tw, top + th))
    save_jpeg(og, f"{OUT}/nerve-media-og.jpg", q=84)
    print("  wrote", info(f"{OUT}/nerve-media-og.jpg"))

    print("avif:", "yes" if avif_ok else "no")

if __name__ == "__main__":
    main()
