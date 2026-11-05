# Chess Vision

A blindfold chess coach that runs entirely in your browser. Enter your opponent's moves (typed, spoken or tapped on the board) and Stockfish 18 tells you the strongest reply in plain words: which piece, from which square, to which square, and why.

**Open it:** https://ogharka.github.io/chess-vision/

## Features
- Full-strength Stockfish 18 (complete NNUE network), with an automatic fallback to the 7 MB lite build
- Every engine move is checked against the chess rules before it is shown
- Win / draw / loss chances, threats against you, the opponent's strongest replies, and a ranking of every legal move
- Forced wins, losses and draws are reported only when the search proves them
- Blindfold mode (text and voice) or board mode, undo / redo, FEN and PGN import, move ratings on the scoresheet

## How it works
Static files only, so it costs nothing to host. All analysis happens on your device; nothing is sent to a server.

| File | Purpose |
| --- | --- |
| `index.html` | The app |
| `logic.js` | Move parsing, plain-English move descriptions, explanations |
| `chess.js` | Chess rules ([chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause) |
| `sf-full.js`, `full/` | Full Stockfish 18, split into 14 MB parts and checksum-verified when loaded |
| `stockfish.js`, `stockfish.wasm` | Stockfish 18 lite |
| `stockfish-asm.js` | Stockfish 18 lite in plain JavaScript, for browsers without WebAssembly |

The full engine is a 113 MB download the first time and is then cached by the browser. Choose **Lite** on mobile data.

## Licences
Stockfish is free software under the [GNU GPL v3](https://github.com/official-stockfish/Stockfish/blob/master/Copying.txt); the WebAssembly builds come from [stockfish.js](https://github.com/nmrugg/stockfish.js). chess.js is BSD-2-Clause.
