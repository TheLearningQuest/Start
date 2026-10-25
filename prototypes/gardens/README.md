# Gardens

Three grade gardens in a row: **Kindergarten**, **1st grade**, and **2nd grade**. Swipe sideways to move from one dollhouse garden to the next. Each one has soil beds, a few demo flowers, and empty pebble spots left open for a later planting step.

This folder is its own toy. It does not open the word garden, the claw, or the lesson pages.

## Play

Swipe sideways, or use the arrows and the **K / 1st / 2nd** chips. The garden follows your finger, then snaps into place.

- A quick flick moves one garden, even before the middle.
- A slow drag commits once you pass the middle.
- The first and last gardens stretch a little, then spring back.

Tap a flower and it wiggles. Tap an empty pebble ring and the line says that spot is waiting.

**Calm** starts from the iPad’s Reduce Motion setting. It turns off sway, flutter, and the small camera tilt. **Sound** is a soft chime made on the device. Nothing is downloaded.

Keyboard, on a laptop: left and right arrows.

## Open it

From the repo root, so the page and the vendored Three.js file share one origin:

```
python3 -m http.server 8765
```

On the iPad, join the same Wi-Fi and open `http://<this-computer>:8765/prototypes/gardens/` in Safari. Add it to the Home Screen if you want it full screen.

After merge, with GitHub Pages serving this repo from the main branch root:

`https://thelearningquest.github.io/Start/prototypes/gardens/`

`?garden=k`, `?garden=1`, or `?garden=2` opens that garden first.

Do not open the file directly from the Files app. The page’s content security policy only loads scripts from the same site (`script-src 'self'`), and `file://` often treats each file as a different origin.

## How the picture works

The camera sits above the lawn and looks down a little, like a toy on a table. It does not fly. Swiping slides that view from garden to garden. Flowers and the path are closer than the fence, the hills, and the sky, so the near things slip past faster. That is the parallax. Soft shadows and chunky shapes keep the depth readable at arm’s length.

## Notes

- Three.js **r160** (MIT) is vendored at `vendor/three.min.js`. It is the same file as `red-words/three.min.js`, copied so this folder stands alone. No CDN.
- Paging math is `js/pager.js` (no WebGL). `node --test tests/gardens.test.js` checks a flick, a snap-back, the midpoint, and the rubber band at the ends.
- The content security policy is the same shape as the claw prototype: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'none'`. Scripts and CSS are files next to the page, so there is no `unsafe-inline`. `connect-src 'none'` blocks any network call. `img-src` allows only this folder plus `data:` and `blob:`, which is how a painted canvas can become a sky or a sign without fetching anything. Web Audio chimes are oscillators, not audio files, so `media-src 'none'` stays shut.
- Empty plots are placeholders. Nothing is saved here, and there is no spelling lesson.
