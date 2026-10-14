"""Stitch the overlapping walk tiles back into full-page strips.

The walk steps 700px through a 900px viewport, so consecutive tiles share
200px. Taking each tile's unique top 700px and stacking them reconstructs
the real full-page image -- which is the thing --full-page silently fails to
produce (failure mode 1: correct dimensions, nothing painted).

CLAMPING. The naive version of this assumed every step advanced a full
700px. It does not: the walk asks for y = 0, 700, 1400, ... but the browser
clamps at maxScrollY = docH - 900, so the last one or two tiles can be the
same frame. Appending 700px of each anyway re-shows content and the strip
comes out taller than the page. On osseus (docH 2654, 4 tiles) that put a
346px band in twice and a rater read it as the page shipping a duplicated
section. It was this script. Session 4 asserted that defect in an evidence
file before the rater caught it.

So: compute each tile's ACTUAL scroll position, clamped the way the browser
clamps, and take only the newly-revealed band. A tile that revealed nothing
contributes nothing. Strip height then equals page height, which is the
invariant worth asserting -- and this file does assert it.

One strip per ~6 bands keeps each image under ~4200px so it stays readable
in one go, at full 1440 width so body copy is still legible.
"""
import os, glob, sys
from PIL import Image

BASE = '/Users/nikolassapalidis/scratch/antislop'
STEP = 700
VIEWPORT = 900
BANDS_PER_STRIP = 6


def bands(tiles, doc_h):
    """(tile_index, crop_top, crop_bottom) for the newly-revealed part of each tile."""
    max_scroll = max(0, doc_h - VIEWPORT)
    out, covered = [], 0
    for i in range(len(tiles)):
        y = min(i * STEP, max_scroll)          # where the browser actually landed
        top = covered - y                       # skip what an earlier tile already showed
        if top >= VIEWPORT:
            continue                            # fully clamped duplicate, contributes nothing
        bottom = min(VIEWPORT, doc_h - y)
        if bottom <= top:
            continue
        out.append((i, top, bottom))
        covered = y + bottom
    return out, covered


def stitch(slug, doc_h):
    tiles = sorted(glob.glob(f'{BASE}/s4/{slug}/{slug}-*.png'))
    if not tiles:
        return [], 0, 0
    out_dir = f'{BASE}/s4strips'
    os.makedirs(out_dir, exist_ok=True)
    plan, covered = bands(tiles, doc_h)
    made = []
    for si in range(0, len(plan), BANDS_PER_STRIP):
        chunk = plan[si:si + BANDS_PER_STRIP]
        ims = [(Image.open(tiles[i]), t, b) for i, t, b in chunk]
        w = ims[0][0].width
        strip = Image.new('RGB', (w, sum(b - t for _, t, b in ims)), (255, 255, 255))
        y = 0
        for im, t, b in ims:
            strip.paste(im.crop((0, t, w, b)), (0, y))
            y += b - t
        p = f'{out_dir}/{slug}-strip{si // BANDS_PER_STRIP}.png'
        strip.save(p, optimize=True)
        made.append((p, strip.width, strip.height, os.path.getsize(p) // 1024))
    return made, covered, len(tiles)


# docH per slug, from the shoot-tiles.cjs walk output.
DOC_H = {
    'provenmetal': 4384, 'the-subvocal-company': 13726, 'sentient-os': 14803,
    'neuron-industries': 13947, 'standard-machines': 1668, 'osseus': 2654,
    'edotenv': 3098, 'tsenta': 9326, 'financial-datasets': 5758, 'dipole-labs': 1528,
}

bad = 0
for s in (sys.argv[1:] or sorted(DOC_H)):
    doc_h = DOC_H[s]
    made, covered, n = stitch(s, doc_h)
    total = sum(h for _, _, h, _ in made)
    ok = 'OK' if total == doc_h == covered else f'MISMATCH (page {doc_h}, covered {covered})'
    if total != doc_h:
        bad += 1
    print(f'{s:24s} {n:>3} tiles -> {len(made)} strips, {total}px vs page {doc_h}px  {ok}')
    for _, w, h, kb in made:
        print(f'{"":26s} {w}x{h} {kb}KB')

print(f'\n{bad} slug(s) where stitched height != page height')
assert bad == 0, 'stitched height must equal page height'
