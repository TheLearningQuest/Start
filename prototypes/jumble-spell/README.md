# Jumble Spell

A standalone spelling toy. She picks a red word, the letters jumble off the page, and a few extra letters fly in. Dotted slots stay in the middle, one for each letter. She drags the letters back into place.

Pink letters wear hearts. Nothing is graded, and nothing is saved.

This folder does not open the word garden, the claw, the gardens, the prize room, letter play, or Cole.

## Play

1. Tap a word. The iPad says it. The letters sit in the dotted slots for a beat, then jumble out across the table. Two, three, or four decoy letters fly in from the edges.
2. Drag a letter onto its slot, or tap a letter and then tap its slot. Heart letters are pink. Their slots are pink too, with a heart.
3. A letter that belongs there pops into the slot. A letter that does not match shakes the slot and springs back to where she picked it up. The page does not scold her.
4. The slots can be filled in any order. When the word is complete, the page says **You spelled it!** and, unless Calm or Reduce Motion is on, tosses a few hearts.
5. **Hear it** says the word again. **Another word** deals the next one. **Words** goes back to the list.

**Calm** starts from the iPad’s Reduce Motion setting. It skips the jumble flight, the heart wiggle, and the toss. The letters simply appear on the table. **Sound** is tiny Web Audio beeps made on the device. The spoken word is the iPad’s own voice. Nothing is downloaded.

## Open it

From the repo root, so the page, the scripts, and the font share one origin:

```
python3 -m http.server 8765
```

On the iPad, join the same Wi-Fi and open `http://<this-computer>:8765/prototypes/jumble-spell/` in Safari. Add it to the Home Screen if you want it full screen.

After merge, with GitHub Pages serving this repo from the main branch root:

`https://thelearningquest.github.io/Start/prototypes/jumble-spell/`

Do not open the file directly from the Files app. The page’s content security policy only loads scripts, CSS, and the font from the same site, and `file://` often treats each file as a different origin.

A few links for a grown-up, when you want a still picture:

- `?word=said&still=1` letters already scattered, slots empty
- `?word=said&filled=1&still=1` said, spelled, with the extra letters still on the table
- `?word=because&still=1` the two different e cards (plain and heart)
- `?decoys=4` four extra letters
- `?calm=1` starts in Calm

## Heart letters

A word is a spec string. Plain letters are written as themselves. One pair of brackets is one heart part: those letters are pink and share one heart. Inside the brackets, `:sound` is how that part is spoken. An empty sound means the letters are silent.

`s[ai:e]d` is **said**. The heart part is **ai**, and it says e. `th[e:u]` is **the**. `bec[au:u]s[e:]` is **because**. The heart parts are **au** (says u) and a silent **e**.

The sound after the colon is stored on the part. This toy does not quiz it.

| Word | Spec | Heart parts |
| --- | --- | --- |
| said | `s[ai:e]d` | ai |
| the | `th[e:u]` | e |
| because | `bec[au:u]s[e:]` | au, silent e |
| was | `w[a:u]s` | a |
| they | `th[ey:ay]` | ey |
| friend | `fr[ie:e]nd` | ie |
| come | `c[o:u]m[e:]` | o, silent e |
| one | `[one:wun]` | one |

## Drag and snap

Constants live in `js/table.js`.

**Deal.** One card for each letter, in order. Then `DECOY_MIN` to `DECOY_MAX` extra cards (2, 3, or 4). A decoy is chosen from a–z minus every letter that appears in the word, so it has no slot. Decoys are the same blue cards as the plain letters. Only the heart letters are pink. That way a yellow pile does not give the extras away.

The word cards start on their slots (`from`) and fly to scatter spots (`to`) with a small tilt, at most `TILT` degrees (16). Decoys start just off the mat and fly in a little later. Scatter spots stay on the mat and off the dotted slots, with a gap so the outline stays visible. Same word, same seed, and same table size deal the same cards.

**Arm.** A press does not pick the card up until the finger moves `ARM` pixels (8). A tap selects the card. A second tap on a slot tries to drop it there. The same snap rules apply. If that tap misses, the card stays selected so she can tap a different slot.

**Snap.** On release, only the nearest slot is considered. It catches the card when both are true:

1. The distance from the card’s center to the slot’s center is at most `SNAP_RATIO` times the slot’s side. `SNAP_RATIO` is **0.62**. That is a little more than half the slot, so most of the card is over the outline.
2. The slot is empty, the letters match, and the heart matches. A pink heart letter only sits in the pink heart slot. Two plain cards of the same letter can trade places. The two e cards in **because** cannot: one is a heart e and one is not.

A snap locks the card to the slot center, straightens it, and plays a short pop. Slots can be filled in any order.

**Miss.** If the nearest slot is inside that reach, but the letter is different, the heart does not match, or the slot is already full, the slot shakes for `SHAKE` seconds (0.32, a small side-to-side wobble) and the card springs back to the spot where the drag began. A card that was lifted out of a slot returns to that slot. A decoy misses every slot. Nothing is added up. She can miss as many times as she likes and still finish.

**Park.** If the nearest slot is farther than the snap reach, the card stays on the table where she let go. It is nudged off the dotted outlines so they stay visible, and clamped so the whole card remains on the mat. Parking is not a miss. It does not shake.

**Done.** When every slot holds a card, the word celebrates. She can still lift a card back off. The celebration quiets until the word is full again.

Calm and Reduce Motion skip the flight and the heart toss. A miss still returns the card, with the same short shake.

## Notes

- Fredoka (SIL Open Font License, copyright The Fredoka Project Authors) is vendored at `fonts/fredoka-latin.woff2`. The license is `fonts/OFL.txt`. It is a latin subset so the red word stays round on an iPad and on a computer without SF Pro Rounded. No CDN.
- Word specs are `js/words.js`. The deal, the drag, and the snap are `js/table.js`. Speech is `js/speech.js`.
- `node --test tests/jumble-spell.test.js` checks the heart parts, a jumble from the slots, decoys flying in from off the mat, a snap inside 0.62 of the slot, a park just outside it, a heart e that will not sit in the plain e slot, a decoy that always bounces back, two identical letters that can trade, a full word in any order, and a card that springs back to where it was picked up.
- The content security policy is `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'none'; media-src 'none'`. Scripts, CSS, and the font are files next to the page, so there is no `unsafe-inline`. `font-src 'self'` is the vendored face. `connect-src 'none'` blocks fetch and XHR. `media-src 'none'` stays shut because there is no audio element: beeps are Web Audio oscillators, and the word is `speechSynthesis` (the browser voice, not a URL). `img-src` allows this folder plus `data:` and `blob:` so a canvas can be shown without fetching a picture. Nothing here asks the network.
- This toy does not do handwriting recognition, Leitner boxes, or saving. It is not wired into the main app.
