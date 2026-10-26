# Write Box

A standalone handwriting check. She picks a red word, hears it, and writes it in one big box. **Submit** reads the ink on the iPad. A clear match celebrates. A close call asks which word she meant. A miss is a gentle try-again. Nothing is graded, and nothing is saved.

This folder does not open the word garden, the claw, the gardens, the prize room, letter play, jumble spell, or Cole.

## Play

1. Tap a word. The iPad says it. Pink letters wear hearts.
2. Write the word in the big box with a finger. Print, with a little space between letters.
3. Tap **Submit**.
   - The writing clearly says that word: **You wrote it!** A few hearts pop up, unless Calm or Reduce Motion is on.
   - Two or more readings are close: chips appear, for example **Did you mean came or come?** She taps the one she meant. The right word celebrates, even when it was not the reader's first guess. Another chip is **Let's try that once more.** Asking is not a miss.
   - The writing clearly says some other word, or it cannot be read: the same gentle line. The ink stays so she can fix a letter. **Clear** wipes the box.
4. **Hear it** says the word again. **Next** deals another word. **Words** goes back to the list.

**Calm** starts from the iPad’s Reduce Motion setting. It holds the hearts still. **Sound** is tiny Web Audio notes made on the device. The spoken word is the iPad’s own voice (Zoe or Zoey when that voice is installed, otherwise the iPad default). Nothing is downloaded.

Keyboard, on a laptop: Enter submits when the box is open.

## Open it

From the repo root, so the page, the scripts, and the font share one origin:

```
python3 -m http.server 8765
```

On the iPad, join the same Wi-Fi and open `http://<this-computer>:8765/prototypes/write-box/` in Safari. Add it to the Home Screen if you want it full screen.

After merge, with GitHub Pages serving this repo from the main branch root:

`https://thelearningquest.github.io/Start/prototypes/write-box/`

Do not open the file directly from the Files app. The page’s content security policy only loads scripts, CSS, and the font from the same site, and `file://` often treats each file as a different origin.

A few links for a grown-up, when you want a still picture. The ink is real sample strokes, and Submit runs the real reader:

- `?word=said&demo=clear` neat **said**, already submitted, clear win
- `?word=come&demo=ask` **come** with a muddy **o**, already submitted, chips **came** and **come**
- `?word=said&sample=clear` the same neat ink, waiting for Submit
- `?word=come&sample=ask` the muddy **o**, waiting for Submit
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

## How a word is read

Everything stays on the device. There is no model download and no network call.

The reader is `$P` point-cloud matching (Vatavu, Anthony, and Wobbrock, 2012), the same family of matcher as the math digit reader, rewritten in this folder so the toy stands alone. It does not load that code.

1. Strokes are grouped into letters. Two strokes belong to one letter when the gap between their boxes is under **GAP_RATIO** (**0.10**) of the ink height. That keeps the dot on **i** and the cross of **t** with the letter, and it keeps a small break inside a letter from becoming a new letter. A speck smaller than **SPECK_RATIO** (**0.045**) of that height is dropped once the word itself is big enough. Ink whose longer side is under **TINY** (**18**) CSS pixels is “write it bigger,” not a word.
2. Each letter is resampled to **24** points, scaled into a square, and matched against print skeletons in `js/letters.js`. Each skeleton is also stored with a small slant each way (**0.12**), so a mild tilt still has a template. Stroke order and direction do not matter. An aspect penalty (**ASPECT_W** 0.14, ignored until the width-to-height ratio differs by more than **ASPECT_DEAD** 0.22 in log space) keeps a tall **l** from tying a round **o**.
3. The distance is the greedy cloud distance divided by 12 (half the point count), plus that aspect penalty. Lower is closer. A perfect trace of a skeleton is distance 0.

The target word is not used while reading. The ink is read first. The check happens after.

## When it asks

Constants live in `js/ink.js`.

| Constant | Value | Meaning |
| --- | --- | --- |
| `SURE_DIST` | **0.22** | A letter is crisp when its best distance is under this. |
| `SURE_MARGIN` | **0.06** | And the runner-up is at least this much worse. |
| `ASK_MARGIN` | **0.06** | A runner-up inside this gap is a choice chip. Same number as `SURE_MARGIN`, so any close second asks instead of grading. |
| `READABLE_DIST` | **0.42** | A best distance above this is not treated as a letter. |
| `CHIP_MAX` | **4** | At most four chips. |

A letter is **unsure** when the runner-up is a real letter (`READABLE_DIST` or better) and the gap is strictly under `ASK_MARGIN`. A gap of exactly 0.06 does not ask.

**Chips** are built only from the ink:

1. The best spelling (the top letter in every slot).
2. One chip per unsure letter, left to right, with that letter swapped to its runner-up.
3. When exactly two letters are unsure, one more chip swaps both, if there is still room under `CHIP_MAX`.

The target word is not pasted onto the list. If the ink never produced it, it is not a chip.

**What Submit does**

- Every letter crisp, and the spelling is the word: **You wrote it!** (`clear`). Not a miss.
- Two or more chips: ask, for example **Did you mean come or came?** Three or four chips use **Which word did you write?** Not a miss. Her tap is the intent.
- She taps the target word: **You wrote it!** Not a miss, even when that spelling was not the reader’s first guess.
- She taps a different chip: **Let's try that once more.** That one is a miss in spirit (she named a different word). This toy still has no streak and no score.
- One reading, a bit soft, but it is the word: **You wrote it!** (`likely`). Not a miss.
- One crisp reading of a different word: **Let's try that once more.** (`mismatch`).
- A fuzzy reading that is not the word, with no close second: the same gentle line (`soft`). Not a crisp miss.
- A distance past `READABLE_DIST`: **I couldn't quite read that. Try again.** Not a miss.
- Nothing in the box, or a tiny mark: a nudge to write, or to write bigger. Not a miss.

The copy never says she is wrong. The box does not shake, and the ink is not erased unless she taps **Clear** or **Next**.

**The muddy o.** `MUDDY_STEM` is **32**, in the 100×140 letter box. It is a round bowl plus a stem down the right side, used for the ask demo. On **come**, that shape ranks **a** then **o**, about 0.04 apart, which is inside `ASK_MARGIN`, so the chips are **came** and **come**. The reader's first guess is came. Tapping **come** still celebrates. A stem of about 40 reads as a crisp **a** (`came`). That is a mismatch, not a chip, because it is no longer a close call.

Neat traces of the eight demo words clear `SURE_DIST` and `SURE_MARGIN`. Real handwriting that wanders will ask, or invite another try. This is a small template matcher, not a trained recognizer. Cursive that joins the letters will be read as fewer shapes.

## Notes

- Fredoka (SIL Open Font License, copyright The Fredoka Project Authors) is vendored at `fonts/fredoka-latin.woff2`. The license is `fonts/OFL.txt`. It is a latin subset so the red word stays round on an iPad and on a computer without SF Pro Rounded. No CDN.
- Word specs are `js/words.js`. Skeletons are `js/letters.js`. The reader and the ask rule are `js/ink.js`. Sample ink for the tests and the demo links is `js/samples.js`. Speech is `js/speech.js`.
- `node --test tests/write-box.test.js` checks the heart parts, a clear win for every demo word, the dot staying on **i**, the come/came ask, picking **said** out of an unsure **soid** / **said** pair, a long stem that is a mismatch instead of a chip, a crisp other word that does not gain the answer as a chip, empty and tiny ink, the chip cap, and Zoe.
- The content security policy is `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'none'; media-src 'none'`. Scripts, CSS, and the font are files next to the page, so there is no `unsafe-inline`. `font-src 'self'` is the vendored face. `connect-src 'none'` blocks fetch and XHR. `media-src 'none'` stays shut because there is no audio element: notes are Web Audio oscillators, and the word is `speechSynthesis` (the browser voice, not a URL). Nothing here asks the network.
- This toy does not do Leitner boxes, streaks, or saving. It is not wired into the main app.
