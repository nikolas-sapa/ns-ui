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
import os, glob, sys, json
from PIL import Image

BASE = '/Users/nikolassapalidis/scratch/antislop'
# Which capture session's tiles to stitch. Session 4's live under s4/; later
# sessions pass their own so a re-pass never overwrites the capture it is
# correcting. NS_SESSION=s5 stitch.py truemile
SESSION = os.environ.get('NS_SESSION', 's4')
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
    tiles = sorted(glob.glob(f'{BASE}/{SESSION}/{slug}/{slug}-*.png'))
    if not tiles:
        return [], 0, 0
    out_dir = f'{BASE}/{SESSION}strips'
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


def walk_height(slug):
    """Page height for `slug`, read from the walker's own walk.json.

    Was a hardcoded dict, which meant every new capture needed this file
    hand-edited -- unworkable once raters capture in parallel, and a silent
    wrong answer if a page's height drifted since the map was written (tsenta
    moved 9326 -> 9548 inside two hours). The walker now writes walk.json
    beside its tiles; the map below survives only for the s4 captures taken
    before it did.

    Refuses a clamped walk outright. The walker's own comment: the tiles lie,
    do not stitch or rate from them. Stitching one yields a strip whose height
    matches a page the walk never reached, so the invariant passes and the
    evidence is still wrong -- failure mode 5's exact shape.

    WHICH HEIGHT. The page height that matters is the SETTLED one, re-read by
    the walker after the walk, because a reveal-gated page grows as it mounts
    and the walker re-reads it for exactly that reason. `walkHeight` is
    docH_before -- the height the walk planned against -- so tying the
    invariant to it means a page that grew mid-walk stitches short and still
    reports OK. anthropic-com did precisely that: docH_before 3340, docH_after
    3346, a 1440x3340 strip against a 3346px page, and `0 slug(s) where
    stitched height != page height`. The evidence file for it was more honest
    than the tool: it recorded the 3346 as the page height and the strip as one
    strip. A drift is now printed, so the number travels with the strip rather
    than living in prose beside it.

    A LARGE growth still fails loudly, and does not need a threshold to do it:
    if the page outgrew what the tiles captured, `covered` falls short of the
    settled height and the existing MISMATCH assert fires.
    """
    wj = f'{BASE}/{SESSION}/{slug}/walk.json'
    if os.path.exists(wj):
        with open(wj) as f:
            w = json.load(f)
        assert not w.get('clamped'), (
            f'{slug}: walk is CLAMPED ({w.get("reachedPx")}px of '
            f'{w.get("walkHeight")}px) -- re-walk with wheel events, do not stitch'
        )
        # A single short landing passes every other check: the stitcher assumes
        # tile i sits at min(i*STEP, max scroll), so a stalled tile is pasted
        # at the wrong y, content repeats, and the total height still matches.
        # databuddy did exactly that (asked 4200, landed 3907). Refuse instead.
        # Older walk.json files carry no landings and cannot be checked.
        doc_max = max(0, w['walkHeight'] - VIEWPORT)
        for i, l in enumerate(w.get('landings', [])):
            want = min(l['asked'], doc_max)
            assert l['landed'] >= want - 8, (
                f"{slug}: tile {i} asked y{l['asked']}, landed y{l['landed']} -- "
                f"something held the scroll; re-walk, do not stitch"
            )
        before, after = w.get('docH_before'), w.get('docH_after')
        if before and after and before != after:
            print(
                f'{slug:24s} page height moved during the walk: {before} -> {after}'
                f' ({after - before:+d}px); stitching to the settled height'
            )
        return after or w['walkHeight']
    if slug in DOC_H:
        return DOC_H[slug]
    raise SystemExit(f'{slug}: no {wj} and no DOC_H entry -- run shoot-tiles.cjs first')


# docH per slug for the s4 captures, taken before the walker wrote walk.json.
DOC_H = {
    'provenmetal': 4384, 'the-subvocal-company': 13726, 'sentient-os': 14803,
    'neuron-industries': 13947, 'standard-machines': 1668, 'osseus': 2654,
    'edotenv': 3098, 'tsenta': 9326, 'financial-datasets': 5758, 'dipole-labs': 1528,
}

def session_slugs():
    """Every slug with a walk.json in this session, so the invariant runs over
    the whole capture set. Falls back to the s4 map, which predates walk.json.

    Skips `_`-prefixed directories: those are the deliberately-clamped fixtures
    that prove the clamp assert fires, so running them here would fail the
    audit by design rather than find anything.
    """
    return sorted(
        name for p in glob.glob(f'{BASE}/{SESSION}/*/walk.json')
        if not (name := os.path.basename(os.path.dirname(p))).startswith('_')
    )


def longest_blank_band(paths, tol=4):
    """Longest run of uniform rows (max-min luma <= tol) across the stitched
    strips, in page px.

    The height invariant cannot see an UNPAINTED band: a tile frozen before its
    content loaded has the right dimensions and nothing on it. That failure hit
    four pages in one batch at n=42 -- mailchimp-2014's hero (animation frozen
    blank), heroku-2014's logo wall, squarespace-2014 (97% white: the 8s settle
    beat a 25s Wayback hero), github-2014's unloaded client screenshot -- and
    every one was caught only because a rater happened to read the DOM.

    A WARNING, not an assert, and its reach is measured, not hoped for. Over
    the 40 session-5 captures the longest uniform band runs:
        squarespace-2014 3306 (miss)    mailchimp-2014 679 (miss)
        sentient-os 452                 basecamp-2014 450 (archive gaps)
        the-subvocal-company 390 ...    heroku-2014 305 (miss)
    600px separates the two large misses from everything else. It does NOT
    catch heroku-2014's logo wall or github-2014's missing screenshot: those
    bands are no longer than designed whitespace on pages that are fine, so no
    threshold on band length can. Those still need a rater reading the DOM.
    """
    import numpy as np
    best = run = 0
    for path in paths:
        a = np.asarray(Image.open(path).convert('L'), dtype=np.int16)
        flat = (a.max(axis=1) - a.min(axis=1)) <= tol
        for f in flat:
            run = run + 1 if f else 0
            best = max(best, run)
    return best


BLANK_WARN = 600

bad = 0
for s in (sys.argv[1:] or session_slugs() or sorted(DOC_H)):
    doc_h = walk_height(s)
    made, covered, n = stitch(s, doc_h)
    total = sum(h for _, _, h, _ in made)
    ok = 'OK' if total == doc_h == covered else f'MISMATCH (page {doc_h}, covered {covered})'
    if total != doc_h:
        bad += 1
    print(f'{s:24s} {n:>3} tiles -> {len(made)} strips, {total}px vs page {doc_h}px  {ok}')
    for _, w, h, kb in made:
        print(f'{"":26s} {w}x{h} {kb}KB')
    blank = longest_blank_band([p for p, *_ in made])
    if blank >= BLANK_WARN:
        print(f'{"":26s} WARNING: {blank}px uniform band -- suspect an unpainted '
              f'capture (frozen animation, slow hero, unloaded image); read the DOM')

print(f'\n{bad} slug(s) where stitched height != page height')
assert bad == 0, 'stitched height must equal page height'
