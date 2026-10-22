# Humanity’s Largest Group Project

A concept site for Google I/O. Science is humanity’s largest group project. The site invites anyone to ask a question or share something they’ve noticed, then shows them the work already underway at Google.

## Run it

No build step. Serve the folder and open it:

```sh
cd humanitys-largest-group-project
python3 -m http.server 8790
# open http://127.0.0.1:8790
```

## How the page works

The whole page sits on one **field of pigment grains**, a full-screen canvas behind the text. As you scroll, the grains re-form into a new picture for each idea:

| Section | What it says | What the grains do |
|---|---|---|
| Hero | The title, one sentence about what to do, and the question box | Stream in from every side and are drawn into the box |
| How it works | 1 Ask or share, 2 It’s filed in the index, 3 See the work underway | Flow from step 1 to step 3 |
| Why | The client’s manifesto, one line per screen | Four “big” clusters, then everyone else, then an ivory tower, then one wide ring |
| Stories | *Et al.* hides people; six of them are told on a map | Spell *et al.*, then become a dot map that moves to each person’s town (gold), then shows all 17 places and you |
| Google’s work | Six projects anyone can use or join | A protein, quake ripples, flood lines, a reef recording, a cyclone, a crystal |
| Your turn | A second question box | Drawn into that box. Adding an entry sends a ripple out |
| Index | Everyday words and the Google work behind them, with an A–Z row | Settle into faint dust so the text reads cleanly |

The top bar has **Discover with Gemini** on the left (Google’s lockup, in Google Sans; it opens Gemini in a new tab), links to each section with the current one underlined, and **Ask a question** on the right, which takes you to the nearest question box. On phones the section links fold into a menu.

## Design notes

- **Type:** Latin Modern Roman, the OpenType edition of Computer Modern, the typeface of LaTeX papers. It uses optical masters: 17 pt for headlines, 12 pt for reading text, and 10, 9 and 7 pt for small text. Names in other scripts use Noto Serif subsets. The one exception is **Discover with Gemini**, top left, set in Google Sans as Google’s own lockup. That font file is subset to just those letters, so changing the words means downloading a new subset.
- **The question box:** a white pill with a soft halo that brightens while you type. The button and the text sit on the same 8px inset.
- **Color:** French ultramarine `#2132a8`, plus white. Ultramarine was once costlier than gold until an open prize in 1824 made it cheap enough for everyone. It’s ground from lapis lazuli, which carries gold flecks of pyrite, so gold grains (`#f2c75c`) mark people and places, and nothing else. Everything a visitor adds is a white slip on the blue.
- **Motion:** scrolling drives the pictures, and each one holds still while you read. Grains dim behind text so every line stays legible. With reduced motion turned on, each picture appears in place with no drift or morphing.

## Files

| File | Purpose |
|---|---|
| `index.html` | Structure and copy (the manifesto is the client’s own words) |
| `styles.css` | Tokens, type scale, layout |
| `js/data.js` | People and their places (with map coordinates), Google projects, the six featured projects, index terms and match keywords, example prompts |
| `js/app.js` | Stories and project steps, both question boxes, matching, results, index, navigation, local storage |
| `js/field.js` | The grain field: every picture, the scroll timeline, WebGL drawing with a Canvas 2D fallback |
| `js/world.js` | A 1° land mask for the dot map, from Natural Earth (public domain) via world-atlas |
| `fonts/` | Self-hosted Latin Modern subsets (woff2), native-script name subsets, and Google Sans for the “Discover with Gemini” lockup |
| `assets/` | Favicon, Apple touch icon, and `share.jpg`, the 1200 × 630 link-preview card |

## Prototype behavior

- Matching runs in the browser: keyword and stem matching against `js/data.js`. To add a topic, add an index entry with `keys` and `refs`.
- To feature a different person, set `story: true` (plus `lat`, `lon` and `town`) on them in `js/data.js`. To feature a different project, edit `featured` and pick one of the shapes in `js/field.js`.
- Entries are stored in `localStorage` only. **Remove what I’ve added** in the footer clears them.
- **Ask Gemini about it** copies the visitor’s words and opens Gemini in a new tab.
- The visitor’s grain on the map sits on their time zone’s city. It never asks for a location.

## Before it goes public

- Change `og:image` in `index.html` to the full URL of `assets/share.jpg`. Link previews need an absolute URL.
- The byline (names, places and years) and the Google projects (names, status and links) were fact-checked on 22 October 2026. Check the projects again near launch, because products get renamed.
