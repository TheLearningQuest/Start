# Toy Claw

A standalone 3D claw machine. No word lists, no garden, no accounts. Open it on its own, including on an iPad.

## Play

1. Drag the **Move** stick, or drag anywhere on the glass. Up on the stick sends the claw toward the back of the cabinet.
2. The claw **swings**. Ease the stick back to the middle and wait. Flicking it and letting go makes it swing harder.
3. A ring on the floor shows where the jaws will land. **Green** means the claw is calm and in the middle of one toy. Press **DROP**.
4. The cable lowers and the jaws close.
   - Calm and centered: the toy is yours. The claw lifts, glides home over the glowing hole, and drops it into the drawer.
   - Close but not centered: the jaws slip and kick the toy. The hint says which way to nudge. You stay in control.
   - Still swinging: the claw knocks toys aside.
   - Two toys in the jaws at once: too crowded, it slips.
5. The drawer pops open. A new toy drops in so you can play again. **Refill** resets the pile and keeps your prize count.

Keyboard, for a laptop: arrow keys or WASD, Space or Enter to drop.

**Calm** follows the iPad’s Reduce Motion setting and can be tapped on or off. It settles the swing faster and turns off confetti and camera shake. **Sound** is tiny Web Audio beeps generated on the device. Nothing is downloaded.

## Open it

From the repo root, so the page and the vendored Three.js file share one origin:

```
python3 -m http.server 8765
```

On the iPad, join the same Wi-Fi and open `http://<this-computer>:8765/prototypes/claw-machine/` in Safari. Add it to the Home Screen if you want it full screen.

After merge, with GitHub Pages serving this repo from the main branch root:

`https://thelearningquest.github.io/Start/prototypes/claw-machine/`

Do not open the file directly from the Files app. The page’s content security policy only loads scripts from the same site (`script-src 'self'`), and `file://` often treats each file as a different origin.

## Why the grab is fussy on purpose

The trolley has weight, and the claw is a pendulum. The ring turns green only when three things are true at once: the trolley has nearly stopped, the swing angle and speed are tiny, and the bite is in the inner part of a single resting toy. A green drop falls straight down from that ring. Anything else keeps swinging while the cable pays out, so the jaws miss or slip, and she tries again. A clean grab is the win: the machine carries that toy home and drops it in the drawer.

Near misses are told in one line (`A little to the right`, `Let the claw hang still`, `Too crowded`). The slip is a nudge you can see, not a hidden coin-flip.

## Notes

- Three.js **r160** (MIT) is vendored at `vendor/three.min.js`. It is the same file as `red-words/three.min.js`, copied so this folder stands alone. No CDN and no `connect-src`.
- Physics is `js/physics.js` (no WebGL). `node --test tests/claw-machine.test.js` drives a grab, a slip, a swing, and the automatic ride home to the chute.
- This page does not change the main app’s content security policy. Its own policy is stricter: `script-src 'self'`, `style-src 'self'`, `connect-src 'none'`.
