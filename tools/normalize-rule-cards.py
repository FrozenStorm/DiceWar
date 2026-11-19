"""Give every rule card image the same pixel size and the same dark frame.

The scans differ in size and in how much dark border surrounds the paper.
Text cards: the paper area is detected, scaled to one size and framed again.
Artwork cards: scaled to fill the whole card. All get the same rounded corners.
Run from the repository root: python3 tools/normalize-rule-cards.py
"""
import glob
import numpy as np
from PIL import Image, ImageDraw

W, H = 680, 985          # final card size (px)
FRAME = 20               # dark frame width around the paper
PAPER_ASPECT = 0.677     # paper width / height of the printed cards
RADIUS = 30
FRAME_RGB = (40, 40, 40)


def paper_box(img):
    a = np.asarray(img.convert("L")).astype(int)
    light = a > 90
    rows = np.where(light.mean(1) > 0.5)[0]
    cols = np.where(light.mean(0) > 0.5)[0]
    left, right, bottom = cols[0], cols[-1] + 1, rows[-1] + 1
    # The top edge is derived from the aspect ratio because some sets have a
    # dark header bar that would otherwise be taken as frame.
    top = max(0, int(round(bottom - (right - left) / PAPER_ASPECT)))
    return left, top, right, bottom


def rounded_mask():
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, W - 1, H - 1), RADIUS, fill=255)
    return m


def cover(img, w, h):
    scale = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def main():
    files = sorted(glob.glob("img/*/rules/*.png") + glob.glob("img/global/*.png"))
    mask = rounded_mask()
    for f in files:
        src = Image.open(f).convert("RGB")
        if f.endswith("artwork.png"):
            card = cover(src, W, H)
        else:
            paper = src.crop(paper_box(src)).resize((W - 2 * FRAME, H - 2 * FRAME), Image.LANCZOS)
            card = Image.new("RGB", (W, H), FRAME_RGB)
            card.paste(paper, (FRAME, FRAME))
        out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        out.paste(card, (0, 0), mask)
        out.save(f, optimize=True)
        print(f, src.size, "->", out.size)


if __name__ == "__main__":
    main()
