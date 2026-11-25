# Shahi Shatranj — The Royal Game of the Court

A 3D chess game painted in the style of a Mughal miniature.

## Play
- **Easiest:** double-click `index.html` (needs internet the first time to load the 3D library and fonts).
- **Or run a tiny local server:** `python3 -m http.server 8000` in this folder, then open http://localhost:8000
- **Put it online:** this folder is a plain static site; deploy it to Vercel as-is (no build step).

## Files
- `index.html` — page layout and the miniature-painting styling
- `game.js` — 3D board, pieces, animations, drone camera, controls
- `chess.js` — full chess rules + the computer opponent ("the Vizier")

## Controls
Click a piece, then click a gold dot (move) or red ring (capture). Drag to look around, scroll to zoom.
Keys: U undo · N new game · D drone camera · T top view · V your view · M sound · H guide · Esc drop piece
