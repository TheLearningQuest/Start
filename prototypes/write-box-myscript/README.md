# Write box · MyScript

A trial of [MyScript iinkTS](https://github.com/MyScript/iinkTS) for Naomi’s red words. She picks a short heart word, writes it in one big box, and taps **Check**. That tap sends the ink to MyScript Cloud for TEXT recognition. The page compares the text that comes back with the word. A match celebrates. Anything else is a gentle try-again. Nothing is graded, and nothing is saved.

This folder does not open the word garden, the offline write box, or the other prototypes.

## Try it on the iPad

After merge, open this on the iPad in Safari:

`https://thelearningquest.github.io/Start/prototypes/write-box-myscript/`

The page has no keys yet. Open **Add MyScript keys**, paste the application key and the HMAC key, and tap **Save**. Check works right away. There is no rebuild and nothing to commit. The keys stay in this iPad’s localStorage under `write-box-myscript.keys`. They are not sent to GitHub. After Save the fields are cleared and the page shows only a mask (the last four characters, once the key is long enough).

Ink still leaves the device only when she taps **Check**.

**Clear keys** sits inside **Keys saved**. It wipes that iPad storage. Add the page to the Home Screen if you want it full screen. The Home Screen name is Write Cloud, so it sits apart from the offline write box.

`?word=said` opens that word. The same works for the other heart words (`the`, `because`, `was`, `they`, `friend`, `come`, `one`). `?calm=1` starts in Calm. `?sound=0` starts quiet.

A computer on the same Wi-Fi can still use a gitignored file instead of the form. Copy `config.example.js` to `config.local.js`, paste the two strings, and do not commit that file. From the repo root:

```
python3 -m http.server 8765
```

Open `http://<this-computer>:8765/prototypes/write-box-myscript/`. If the iPad also has keys saved in the browser, those saved keys win over `config.local.js`. Clear keys falls back to the file when the file has keys.

Do not open the file from the Files app. The content security policy only loads scripts from this site, and `file://` often treats each file as a different origin.

## Keys

1. Create an account at [developer.myscript.com](https://developer.myscript.com) with Apple, Google, Microsoft, or email.
2. If you used email, confirm it. Confirming the account grants the free quota: **2,000 requests a month**. After that, MyScript rejects calls until the next month unless you have a contract. The pricing page is [developer.myscript.com/pricing](https://developer.myscript.com/pricing).
3. In the account, open **Applications**. Create an application if you need one, open it, and under **Keys** choose **Generate application key**. Copy the application key and the hmac key. The steps are written up at [Registering with MyScript Cloud](https://developer.myscript.com/support/cloud/registering-myscript-cloud/).
4. `config.example.js` shows the shape. `config.local.js` is the real one:

```javascript
window.MyScriptWriteConfig = {
  applicationKey: "paste-the-application-key",
  hmacKey: "paste-the-hmac-key"
};
```

Leave the example file empty. On GitHub Pages, paste the same two strings into **Add MyScript keys** and tap **Save**. Empty or placeholder keys do not call MyScript.

Counters for the account: [cloud.myscript.com/#/counters](https://cloud.myscript.com/#/counters).

## Play

1. Tap a word. The iPad says it. Pink letters wear hearts.
2. Write the word in the big box with a finger or Apple Pencil.
3. Tap **Check**.
   - The cloud’s text is that word, ignoring capitals and punctuation: **You wrote it!** A few hearts pop up, unless Calm or Reduce Motion is on.
   - The cloud read some other letters: **Let's try that once more.** A small line shows what came back, for example `I read "soid".` The ink stays so she can fix a letter.
   - The cloud returned no letters: **I couldn't quite read that. Try again.**
   - The box is empty: a nudge to write. That tap does not call MyScript.
4. **Hear it** says the word again. **Clear** wipes the box. **Next** deals another word. **Words** goes back to the list.

**Calm** starts from the iPad’s Reduce Motion setting. It holds the hearts still. **Sound** is tiny Web Audio notes made on the device. The spoken word is the iPad’s own voice (Zoe or Zoey when that voice is installed, otherwise the iPad default).

The target word is not sent as a hint. MyScript sees the strokes and the language `en_US`. This page decides afterwards.

## What counts as a request

The library is iinkTS **4.1.0**, vendored at `vendor/iink.min.js`. The canvas type is `INK_V2`. That is the REST recognizer in [the iinkTS canvas guide](https://developer.myscript.com/docs/interactive-ink/4.5/web/iinkts/canvas/), not the live WebSocket editor.

This page sets `triggers.exportContent` to `DEMAND`. In iinkTS 4.1 the Ink canvas would otherwise export on a quiet period after each pen lift (the library default is `QUIET_PERIOD`, about one second). A pause between letters would spend a request. **Check** calls `canvas.export(["text/plain"])`.

iinkTS posts once per mime type to `https://cloud.myscript.com/api/v4.0/iink/recognize`. The only mime type here is `text/plain`, so one Check is one recognize POST. The HMAC header is computed inside iinkTS from the application key and the hmac key. The page never builds that header itself.

Opening the writing box also lets iinkTS `GET https://cloud.myscript.com/api/v4.0/iink/version` once, so it can match the server’s configuration. That is not a recognize call. MyScript’s pricing page counts a REST request as a call to the iink web API, so glance at the counter on the first day and see whether that version GET shows up.

**Clear**, **Next**, and **Words** only clear the local ink. They do not recognize. Undo is not on the page, because iinkTS undo on this canvas exports again.

A WebSocket session is a different kind of request (everything between socket open and socket close, with a time limit). This trial does not open a socket.

## Privacy

The strokes — the path of the finger or the pencil, not a photo and not her name — are sent to MyScript Cloud when she taps **Check**. MyScript’s servers do the reading. This toy does not store the ink. Keys saved with **Save** stay in localStorage on that iPad. `config.local.js` stays on the computer you edit, and out of git. The page does not print the full keys after Save.

## Content security policy

This page only. The offline write box and the live app are unchanged.

```
default-src 'none';
script-src 'self';
style-src 'self' 'unsafe-inline';
font-src 'self' https://cdn.jsdelivr.net;
img-src 'self' data:;
connect-src https://cloud.myscript.com wss://cloud.myscript.com;
media-src 'none';
worker-src 'none';
form-action 'none';
base-uri 'none'
```

- `script-src 'self'`. iinkTS is vendored, so there is no script CDN. `config.local.js` is a script on this site.
- `style-src 'unsafe-inline'`. iinkTS inserts its own `<style>` element (the ink theme) and sets a few style attributes. The kid CSS stays in `style.css`.
- `font-src`. Fredoka is `fonts/fredoka-latin.woff2`. The injected theme also names a MathJax woff on `cdn.jsdelivr.net`. Text recognition does not use that font. The host is allowed so a browser that fetches it is not blocked.
- `img-src data:`. The pen cursor inside iinkTS is an inline SVG.
- `connect-src`. REST uses `https://cloud.myscript.com` (the version GET and the recognize POST). `wss://cloud.myscript.com` is MyScript’s WebSocket host for the interactive canvas (`INTERACTIVE_INK`). This page does not open it. It is listed so that host is explicit if the canvas type changes later.
- `worker-src 'none'`. The ping worker inside the bundle is for the WebSocket canvas. If that canvas were used, the worker is a `blob:` URL and `worker-src` would need `blob:`.
- `media-src 'none'`. Notes are Web Audio oscillators. The word is `speechSynthesis`. No audio file is loaded.

The writing guides are off (`rendering.guides.enable` is false, which iinkTS copies onto the text recognizer). The box stays one open cream sheet, like the offline write box. The pen color is the same blue.

## Notes

- Fredoka (SIL Open Font License, copyright The Fredoka Project Authors) is vendored at `fonts/fredoka-latin.woff2`. The license is `fonts/OFL.txt`.
- Heart-word specs are `js/words.js`. Speech is `js/speech.js`. The compare is `js/check.js`. The page is `js/app.js`.
- `vendor/iink.min.js` is the UMD build of iink-ts 4.1.0. `vendor/LICENSE-Apache-2.0.txt` is the Apache 2.0 license. `vendor/NOTICE` says where it came from. The source-map comment was removed so the page does not ask for a missing `.map` file.
- `node --test tests/write-box-myscript.test.js` checks the compare and that the example keys are empty. It does not call MyScript.
