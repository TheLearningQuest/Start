# Red words lesson

A thin shell that plays one heart word from the claw through to a seed. Each step stays in its own folder. This page only keeps the current word and shows the next step.

It does not open the live Word Garden, save coins, or plant the seed in Gardens.

## Play

1. **Claw.** Grab a capsule. Pink is kindergarten, gold is 1st grade, blue is 2nd grade. The capsule she wins is the word for the rest of the round.
2. **Open.** Three taps tip the capsule until its two halves separate. The heart word fills the screen and the iPad says it. She taps the red letters. The hearts lift off, those letters stay red, and that same word slides into the sample sentence for her to read out loud. There is no seed pouch on this step.
3. **Spell.** Two passes. First the letters sit in the dotted slots, then they jumble, and the slots still show the letters. **Spell it again** deals the same word with empty slots. Heart slots stay pink so a heart card still has a home.
4. **Write.** She writes the word and taps **Check**. MyScript reads it. A match is **Next**. A miss stays on this step. On a landscape iPad the key form sits above the writing box, and **Check** stays on the screen.
5. **Seed.** After the whole module, tear the pouch sideways (or tap it three times). The pouch shakes and flashes common, uncommon, rare, then legendary, and lands on her seed. She hears the flower it grows into, and sees that flower at its middle growth stage (the same picture as the garden). Green is common, blue is uncommon, pink is rare, gold is legendary. Kindergarten lands on common most often. 2nd grade lands on rare and legendary more often. **Another word** goes back to the claw and keeps the heart count. **Start over** clears the round, including hearts. The top of the lesson keeps the heart count and **Start over**.

Letter-play is not in this flow.

Calm and Sound buttons are not on the lesson. The garden’s speaker button, next to the stars and coins, is the one that stays. The seed pop also settles when the iPad’s Reduce Motion setting is on.

## Open it

From the repo root, so the shell and the step folders share one origin:

```
python3 -m http.server 8765
```

On the iPad, join the same Wi-Fi and open `http://<this-computer>:8765/prototypes/red-words-shell/` in Safari.

After merge, with GitHub Pages serving this repo from the main branch root:

`https://thelearningquest.github.io/Start/prototypes/red-words-shell/`

Do not open the file from the Files app. The shell only frames pages on this site.

A few links for a grown-up, when you want one step:

- `?fresh=1` clears the saved round and starts at the claw
- `?step=reveal&word=said`
- `?step=jumble&word=said&stage=2` empty slots
- `?step=write&word=friend`
- `?step=seed&word=because`
- `?step=seed&word=because&tier=legendary` forces that seed color

## MyScript keys

The write step is `prototypes/write-box-myscript/`, framed by this shell. Keys are not in git.

On the iPad, open **Add MyScript keys** on the Write step, paste the application key and the HMAC key, and tap **Save**. They stay in this browser under `write-box-myscript.keys`, the same place as the standalone write box. Check works right away. **Clear keys** on that step wipes them.

A computer on the same Wi-Fi can still use a gitignored `prototypes/write-box-myscript/config.local.js`. If the iPad also has keys saved, those saved keys win. See that folder’s README for how to create the keys. Ink leaves the device only when she taps **Check**.

This shell page does not call MyScript. The write page’s own content security policy allows `cloud.myscript.com`.

## Demo words

Eight heart words, the same specs as the other prototypes. There is no mastery schedule yet. All eight are due every time, so the claw can hand her any of them.

The first row in the cabinet is one blue (2nd), one pink (K), and one gold (1st), then the rest of the kindergarten words.

| Word | Grade | Capsule | Spec |
| --- | --- | --- | --- |
| because | 2nd | blue `#3d8bff` | `bec[au:u]s[e:]` |
| said | K | pink `#ff4d88` | `s[ai:e]d` |
| friend | 1st | gold `#ffb020` | `fr[ie:e]nd` |
| the | K | pink | `th[e:u]` |
| was | K | pink | `w[a:u]s` |
| they | K | pink | `th[ey:ay]` |
| come | K | pink | `c[o:u]m[e:]` |
| one | K | pink | `[one:wun]` |

The current word and the heart count live in `localStorage` under `red-words-shell.session` on this iPad. That count is finished modules in this shell. It is not the garden shop.

Add a demo word in `js/words.js` if you want another capsule. The live weekly list is a different file and is not read here.

## What is real, and what is still a stub

Real in this prototype:

- The claw grab, with grade-colored capsules when the shell opens it
- The capsule halves opening, the spoken heart word, the tap on the red letters, and the sample sentence built around that same word
- The two jumble passes
- MyScript **Check**, once keys are saved on the device
- The sideways pouch tear, the rarity roll, and the seed pop after a successful write

Still stubbed:

- No spaced-repetition or “due today” schedule. The eight words are always in the machine
- No coins, shop, or Word Garden save
- The seed is a celebration. It does not plant in Gardens
- Letter-play is skipped
- Spoken words use the iPad voice. Recorded clips are not wired in this shell
- Without MyScript keys, Write shows the paste panel and Check does not grade

## Notes

- Steps stay in their own folders: `claw-machine`, `prize-crack`, `jumble-spell`, `write-box-myscript`. Open any of them alone and it still plays as its own toy. `?shell=1` is the lesson hook.
- Fredoka (SIL Open Font License) is the face already vendored at `prototypes/prize-crack/fonts/`. This folder does not copy it.
- `node --test tests/red-words-shell.test.js` checks the route, the capsule colors, the empty-slot jumble, and the tear.
