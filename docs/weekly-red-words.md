# Weekly 2nd-grade red words

A small scheduled change adds one week's list. It may edit only the block between these two comments in `index.html`:

```
/* WEEKLY_RED_WORDS_START */
/* WEEKLY_RED_WORDS_END */
```

Inside the block is a JavaScript array named `WEEKLY_RED_WORDS`. Append one object and nothing else.

```js
var WEEKLY_RED_WORDS = [
  { weekOf: '2026-11-02', words: ['world', 'friend'] }
];
```

Rules for each entry:

- `weekOf` is any `YYYY-MM-DD`. Use the Monday of that week.
- `words` is a non-empty array of spellings.
- Store words in lowercase. The only capital is `I`.
- Keep an apostrophe in a word such as `don't`.
- Do not number the words, and do not add notes inside the block.
- The same word in the same week cannot appear twice.

The game builds a stable id from the entry: `rw-2w-` + the date + `-` + the word with any apostrophe removed. `world` on 2026-11-02 is `rw-2w-2026-11-02-world`.

These words show up in the 2nd-grade Explore area. They are not on Naomi's default K and 1st-grade path.

The sheet's original 40 second-grade words stay in the Explore list even when this array is empty. Do not paste those into the weekly block.
