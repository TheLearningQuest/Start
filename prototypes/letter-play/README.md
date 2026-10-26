# Letter Play

A standalone tracing toy. She picks a red word, hears it, and paints the letters. The pink letters wear hearts. Nothing is graded, and nothing is saved.

This folder does not open the word garden, the claw, the gardens, the prize room, or Cole.

## Play

1. Tap a word. The word fills the next screen, hearts sit on the tricky letters, and the iPad says it.
2. **Hear it** says the word again.
3. **Paint the letters** gives her one big letter at a time. **Paint the whole word** lays the word out in a row.
4. She paints with a finger. Any direction counts. She can lift and continue. Strokes that miss the letter still show up as the same paint.
5. When the ribbon is painted enough, the page says **You painted it!** and, unless Calm or Reduce Motion is on, tosses a few hearts. There is no score.
6. **Next letter** always moves on, even if she has only made a mark. **Paint again** clears the paint so she can do it for fun. **Words** picks another word.

**Calm** starts from the iPad’s Reduce Motion setting. It turns off the heart wiggle and the toss. **Sound** is tiny Web Audio beeps made on the device. The spoken word is the iPad’s own voice. Nothing is downloaded.

Keyboard, on a laptop: left and right arrows move between letters.

## Open it

From the repo root, so the page, the scripts, and the font share one origin:

```
python3 -m http.server 8765
```

On the iPad, join the same Wi-Fi and open `http://<this-computer>:8765/prototypes/letter-play/` in Safari. Add it to the Home Screen if you want it full screen.

After merge, with GitHub Pages serving this repo from the main branch root:

`https://thelearningquest.github.io/Start/prototypes/letter-play/`

Do not open the file directly from the Files app. The page’s content security policy only loads scripts, CSS, and the font from the same site, and `file://` often treats each file as a different origin.

A few links for a grown-up, when you want a still picture:

- `?word=because` the word, already on the look screen
- `?word=said&play=letter&at=1` painting the pink **a** in said
- `?word=they&play=word` the whole word
- `?calm=1` starts in Calm
- `?still=1` holds the heart still

## Heart letters

A word is a spec string. Plain letters are written as themselves. One pair of brackets is one heart part: those letters are pink and share one heart. Inside the brackets, `:sound` is how that part is spoken. An empty sound means the letters are silent.

`s[ai:e]d` is **said**. The heart part is **ai**, and it says e. `th[e:u]` is **the**. `bec[au:u]s[e:]` is **because**. The heart parts are **au** (says u) and a silent **e**.

While she paints, heart letters stay pink and keep a heart on them. The other letters are blue. The sound after the colon is stored on the part. This toy does not quiz it.

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

## How forgiveness works

The letter on the page is a thick candy ribbon, not a line she has to trace in order. Under the ribbon is a trail of soft spots along the middle of each stroke. Spots only ever turn on.

- She can start at the top, the bottom, or the middle.
- She can go backwards, lift her finger, or scribble back and forth.
- A stroke still counts when it lands on the ribbon **or about a fingertip past its edge** (32 CSS pixels, `FINGER` in `js/ribbon.js`). That extra room is wider than the painted ribbon on purpose. The visible letter is the ribbon. The fingertip past the edge is invisible forgiveness.
- Strokes that miss by more than that still show as the same pink or blue paint. They do not erase spots, they do not turn red, and they do not play a different sound.
- About **half** the spots (`COVER` 0.5) is enough. The dot on i, or the tail of a letter, can be skipped.
- A poke does not finish it. Her finger has to travel about a third of the ribbon (`TRAVEL` 0.33) so a pocket tap does not celebrate.
- On a whole word, every letter also needs a small swipe, about a fifth of that letter (`FLOOR` 0.18). A letter she has not touched stays pale. That is a cue, not a penalty. The page never says she is wrong, and it never shows a percent.
- **Next letter** works the whole time. Leaving early is not a miss.

`node --test tests/letter-play.test.js` checks a backwards trace, a trace that starts in the middle, strokes painted out of order, a fingertip-outside trace that still counts, a far scribble that does not undo paint, a tap that does not finish, and a word that is not done while one letter is still blank.

## Notes

- Fredoka (SIL Open Font License, copyright The Fredoka Project Authors) is vendored at `fonts/fredoka-latin.woff2`. The license is `fonts/OFL.txt`. It is a latin subset so the red word stays round on an iPad and on a computer without SF Pro Rounded. No CDN.
- Word specs are `js/words.js`. Letter ribbons are `js/letters.js`. Coverage is `js/ribbon.js`. Speech is `js/speech.js`.
- The content security policy is `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'none'; media-src 'none'`. Scripts, CSS, and the font are files next to the page, so there is no `unsafe-inline`. `font-src 'self'` is the vendored face. `connect-src 'none'` blocks fetch and XHR. `media-src 'none'` stays shut because there is no audio element: beeps are Web Audio oscillators, and the word is `speechSynthesis` (the browser voice, not a URL). `img-src` allows this folder plus `data:` and `blob:` so a canvas can be shown without fetching a picture. Nothing here asks the network.
- This toy does not do jumble spelling, handwriting recognition, Leitner boxes, or saving. It is not wired into the main app.
