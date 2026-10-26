# Prize Crack

A standalone prize room. She wins a capsule, a seed packet, or a toy, opens it herself, and a red word pops out in a big round font. The tricky letters are pink, with a heart over them, and the word is read aloud.

This folder does not open the claw, the gardens, Cole, or the lesson. Nothing is saved.

## Play

1. Tap **I won a capsule**. The capsule lands on its own screen.
2. Tap it three times. Each tap cracks it a little more. The third tap pops it open.
3. The red word fills the screen. Heart letters are pink and a little bigger, with a heart sitting on them.
4. **Hear it** says the word again. **Another prize** goes back to the drawer and lines up the next word.

**I won a seed packet** peels. Drag the seal downward. Let go too early and it springs shut. Drag it most of the way, or tap it three times, and it opens. **I won a toy** is the same three taps, on the bow.

**Calm** starts from the iPad’s Reduce Motion setting. It skips the bounce, the flying shell, and the heart pulse. She still has to crack or peel it herself. A short peel snaps shut instead of easing back. **Sound** is tiny Web Audio beeps made on the device. Nothing is downloaded.

Keyboard, on a laptop: Enter or Space on the prize. Each press is one crack, or one tug on the packet.

## Open it

From the repo root, so the page, the script files, and the font share one origin:

```
python3 -m http.server 8765
```

On the iPad, join the same Wi-Fi and open `http://<this-computer>:8765/prototypes/prize-crack/` in Safari. Add it to the Home Screen if you want it full screen.

After merge, with GitHub Pages serving this repo from the main branch root:

`https://thelearningquest.github.io/Start/prototypes/prize-crack/`

Do not open the file directly from the Files app. The page’s content security policy only loads scripts, CSS, and the font from the same site, and `file://` often treats each file as a different origin.

A few links for a grown-up, when you want a still picture instead of the landing bounce:

- `?won=capsule&ready=1` closed capsule
- `?won=capsule&crack=2` two cracks, not open yet
- `?word=because&open=1` the word, already revealed
- `?won=packet` or `?won=toy`
- `?calm=1` starts in Calm
- `?still=1` pauses the wiggle

## Heart letters

A word is stored as a spec string. Plain letters are written as themselves. The irregular part sits in square brackets. That bracket is one heart part: one pink chunk, one heart above it. Inside the brackets, a colon introduces the sound a child would spell by ear. An empty sound means those letters are silent.

`s[ai:e]d` is **said**. The heart part is **ai**, and it says e. `th[e:u]` is **the**. The heart part is **e**. `bec[au:u]s[e:]` is **because**. The heart parts are **au** (says u) and a silent **e**.

The sound after the colon is kept on the part for a later lesson. This screen does not quiz it. It shows the letters and says the whole word.

| Word | Spec | Heart parts | Clip id |
| --- | --- | --- | --- |
| said | `s[ai:e]d` | ai | `rw-k-said` |
| the | `th[e:u]` | e | `rw-k-the` |
| because | `bec[au:u]s[e:]` | au, silent e | `rw-2-because` |
| was | `w[a:u]s` | a | `rw-k-was` |
| they | `th[ey:ay]` | ey | `rw-k-they` |
| friend | `fr[ie:e]nd` | ie | `rw-1-friend` |
| come | `c[o:u]m[e:]` | o, silent e | `rw-k-come` |
| one | `[one:wun]` | one | `rw-k-one` |

`said`, `the`, `they`, `friend`, and `come` use the same clip ids as the recording script. `was`, `because`, and `one` use that same `audio/words/<id>.m4a` pattern so a file can be added later.

## How the word is spoken

`js/speech.js` keeps `CLIPS` empty. `playClip` asks `plan` first. A path that is not in the list never builds an audio element, and the page does not request a file. The opening tap speaks the word with `speechSynthesis` in that same gesture. **Hear it** does it again.

If a voice named Zoe or Zoey is installed, that voice is used. United States English comes first, then Enhanced or Premium. Otherwise the utterance does not set `voice`. `lang` is `en-US`, which is the iPad’s own default voice. Safari on iPad often hides downloaded voices, so Zoe may be missing and the default voice is the one she hears. That is expected.

When a recording exists, add its path to `CLIPS`, for example `audio/words/rw-k-said.m4a`. `playClip` will play that same-origin file and speak only if playback fails. The screen does not need a new layout for that.

The first **I won** tap also speaks an empty utterance, which is what unlocks speech on iOS. The word itself is spoken on the tap that finishes the open.

## Notes

- Fredoka (SIL Open Font License, copyright The Fredoka Project Authors) is vendored at `fonts/fredoka-latin.woff2`. The license is `fonts/OFL.txt`. It is a latin subset so the red word stays round on an iPad and on a computer without SF Pro Rounded. No CDN.
- Opening math is `js/open.js`. Word specs are `js/words.js`. `node --test tests/prize-crack.test.js` checks the heart parts, a three-tap crack, a peel that springs shut, a peel that opens, and the clip plan.
- The content security policy is `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; media-src 'self'; connect-src 'none'`. Scripts, CSS, and the font are files next to the page, so there is no `unsafe-inline`. `connect-src 'none'` blocks fetch and XHR. `media-src 'self'` is there so a later same-origin clip can play. The clip list is empty today, so the page does not set an audio src. `img-src` allows only this folder plus `data:` and `blob:`. Web Audio beeps are oscillators, not audio files. `speechSynthesis` is the browser voice, not a URL.
