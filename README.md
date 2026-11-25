# ♔ Shahi Shatranj — The Royal Game of the Court

A 3D chess game for the browser, painted in the style of a Mughal miniature. Play against the computer, "the Vizier", or with a friend on the same screen.

### ▶️ [Play now: shahi-shatranj.vercel.app](https://shahi-shatranj.vercel.app/)

No installation or sign-up needed.

## About the project

Shahi Shatranj sets a game of chess in a Mughal royal court. The board stands in a painted garden with water channels, pavilions and cypress trees. The pieces are courtiers, and each type moves in its own way: the king walks in slow procession, the queen glides, and the knight rears and leaps. Captured pieces bow and retire to the side of the board.

The chess rules, computer opponent, 3D scene and interface are written in plain JavaScript, HTML and CSS, with Three.js for 3D rendering.

## Features

- **Two game modes:** play against the computer, or two players on one screen
- **Three difficulty levels:** Novice, Courtier and Grand Vizier
- **Choice of side:** White, Black or random
- **Full chess rules:** castling, en passant, promotion, check and checkmate
- **Draws:** stalemate, threefold repetition, the fifty-move rule and insufficient material
- **3D board:** rotate and zoom, with a top view
- **Drone camera:** flies to the side whose turn it is
- **Move help:** gold dots show legal moves and red rings show captures
- **Move history:** every move is listed, along with captured pieces
- **Undo:** take back a move
- **Sound:** can be switched on or off
- **In-game guide:** explains the pieces and rules

## How to play

1. Open the [live game](https://shahi-shatranj.vercel.app/).
2. Choose an opponent, then a side and difficulty if you are playing the computer.
3. Select **Begin the Game**.
4. Click or tap a piece, then click a gold dot to move or a red ring to capture.
5. Checkmate the opposing king to win.

### Controls

| Input | Action |
|---|---|
| Click or tap | Select and move a piece |
| Drag | Look around the board |
| Scroll or pinch | Zoom |
| `U` | Undo |
| `N` | New game |
| `D` | Drone camera on or off |
| `T` | Top view |
| `V` | Return to your side |
| `M` | Sound on or off |
| `H` | Open the guide |
| `Esc` | Drop the selected piece |

### Meet the court

| Piece | Court name | Movement |
|---|---|---|
| ♔ King | Padishah | One square in any direction; can castle |
| ♕ Queen | Malika | Any distance, straight or diagonal |
| ♖ Rook | Rukh | Any distance along rows and columns |
| ♗ Bishop | Wazir | Any distance diagonally |
| ♘ Knight | Aswar | L-shaped leap over other pieces |
| ♙ Pawn | Sipahi | Forward one square, or two on its first move; captures diagonally |

## How it works

- **Rules engine:** generates legal moves, tracks the position and detects the end of the game.
- **The Vizier:** looks ahead using iterative deepening and alpha-beta search, with a quiescence search to follow captures. It sometimes varies its choice between moves of similar strength.
- **3D scene:** Three.js renders the board, courtiers, animations and camera.
- **Hosting:** a static site on Vercel, with no backend or build step.

## Tech stack

| Technology | Used for |
|---|---|
| JavaScript | Game logic, computer opponent and animation |
| Three.js 0.160 | 3D graphics |
| HTML and CSS | Interface and styling |
| Web Audio API | Sound |
| Google Fonts | Typography |
| Vercel | Hosting |

## Project structure

```text
.
├── index.html   # Page layout and styling
├── game.js      # 3D scene, animation, sound, camera and controls
├── chess.js     # Chess rules and computer opponent
└── README.md    # Project documentation
```

## Run locally

You need Python 3 and an internet connection, because the 3D library and fonts load online.

```bash
git clone https://github.com/riyakumari0/shahi-shatranj.git
cd shahi-shatranj
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Author

**Riya Kumari** — [@riyakumari0](https://github.com/riyakumari0)
