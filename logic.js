// Chess Vision — pure logic: input parsing, move wording, explanations, score formatting.
// Every move returned here comes from chess.js's legal-move generator, never from text alone.
import { Chess } from './chess.js';

export const NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
export const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
export const COLOR = { w: 'White', b: 'Black' };
const UP = (s) => s.toUpperCase();
const other = (c) => (c === 'w' ? 'b' : 'w');

/* ---------- Move wording ---------- */
export function describeMove(m) {
  const P = NAMES[m.piece];
  let title, sentence;
  if (m.flags.includes('k')) {
    title = 'Castle kingside';
    sentence = `Castle kingside: King ${UP(m.from)} to ${UP(m.to)}, rook jumps over`;
  } else if (m.flags.includes('q')) {
    title = 'Castle queenside';
    sentence = `Castle queenside: King ${UP(m.from)} to ${UP(m.to)}, rook jumps over`;
  } else if (m.captured) {
    title = `${P} takes ${NAMES[m.captured].toLowerCase()} on ${UP(m.to)}`;
    sentence = `${P} from ${UP(m.from)} takes the ${NAMES[m.captured].toLowerCase()} on ${UP(m.to)}`;
    if (m.flags.includes('e')) sentence += ' (en passant)';
  } else {
    title = `${P} to ${UP(m.to)}`;
    sentence = `${P} from ${UP(m.from)} to ${UP(m.to)}`;
  }
  if (m.promotion) {
    title += `, promote to ${NAMES[m.promotion]}`;
    sentence += `, and promote to a ${NAMES[m.promotion]}`;
  }
  if (m.san.endsWith('#')) { title += ' — checkmate'; sentence += ' — checkmate'; }
  else if (m.san.endsWith('+')) { title += ', check'; sentence += ', with check'; }
  return { title, sentence, arrow: `${UP(m.from)} → ${UP(m.to)}`, san: m.san };
}

/* ---------- Input parsing ---------- */
const NUM_WORDS = { one: 1, won: 1, two: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, ate: 8 };
const LETTER_WORDS = { ay: 'a', bee: 'b', be: 'b', see: 'c', sea: 'c', cee: 'c', dee: 'd', ee: 'e', eff: 'f', gee: 'g', aitch: 'h' };
const PIECE_WORDS = [
  [/\b(knight|night|knights|horse|nite)\b/, 'n'],
  [/\b(bishop|bishops)\b/, 'b'],
  [/\b(rook|rooks|rock|brook|tower)\b/, 'r'],
  [/\b(queen|queens)\b/, 'q'],
  [/\b(king|kings)\b/, 'k'],
  [/\b(pawn|pawns|porn|pond|prawn)\b/, 'p'],
];
const PROMO_WORDS = { queen: 'q', rook: 'r', bishop: 'b', knight: 'n', night: 'n' };

function legal(chess) { return chess.moves({ verbose: true }); }

function trySan(chess, s) {
  const list = legal(chess);
  const clean = s.replace(/[!?]+$/, '').replace(/e\.?p\.?$/i, '').trim();
  const strip = (x) => x.replace(/[+#]/g, '');
  const hit = list.find((m) => strip(m.san) === strip(clean));
  if (hit) return hit;
  // Let chess.js resolve looser SAN such as "Ng1f3" or "e7e8Q".
  try {
    const c = new Chess(chess.fen());
    const m = c.move(clean, { strict: false });
    if (m) {
      // A promotion typed without a piece letter ("e7e8") defaults to a queen.
      const promo = m.promotion && !/[qrbn][+#]?$/i.test(clean) ? 'q' : m.promotion;
      return list.find((x) => x.from === m.from && x.to === m.to && (x.promotion || '') === (promo || '')) || null;
    }
  } catch (e) { /* not SAN */ }
  return null;
}

/**
 * Turn whatever the person typed or said into one legal move.
 * Returns { ok:true, move } or { ok:false, error, options? }.
 */
export function parseMove(chess, raw) {
  const original = (raw || '').trim();
  if (!original) return { ok: false, error: 'Type a move first, for example e4, Nf3, g1f3 or "knight to f3".' };
  const list = legal(chess);
  if (!list.length) return { ok: false, error: 'The game is over, so no move can be entered.' };

  // 1. Standard algebraic notation, case as typed.
  let m = trySan(chess, original);
  if (m) return { ok: true, move: m };
  // Lower-case piece letter (nf3, qh5). "b" is tried last because bc4 may mean a pawn move.
  if (/^[nrqk][a-h1-8x]/.test(original)) {
    m = trySan(chess, original[0].toUpperCase() + original.slice(1));
    if (m) return { ok: true, move: m };
  }

  let t = ' ' + original.toLowerCase().replace(/[.,;:!?]/g, ' ').replace(/[→\-–—>]+/g, ' ') + ' ';

  // 2. Castling, in any common form.
  const castleLong = /\b(o o o|0 0 0|ooo|castles? (long|queen ?side)|(long|queen ?side) castles?)\b/.test(t);
  const castleShort = !castleLong && /\b(o o|0 0|castles? (short|king ?side)|(short|king ?side) castles?|castles?)\b/.test(t);
  if (castleLong || castleShort) {
    m = list.find((x) => x.flags.includes(castleLong ? 'q' : 'k'));
    if (m) return { ok: true, move: m };
    return { ok: false, error: `Castling ${castleLong ? 'queenside' : 'kingside'} is not legal in this position.` };
  }

  // 3. Spoken-style words to squares: "e four" -> e4, "see 4" -> c4.
  for (const [w, l] of Object.entries(LETTER_WORDS)) t = t.replace(new RegExp(`\\b${w}\\s+(?=[1-8]\\b|one|two|three|four|five|six|seven|eight)`, 'g'), l + ' ');
  t = t.replace(/\b([a-h])\s*(one|won|two|three|four|five|six|seven|eight|ate|for)\b/g, (_, l, n) => l + NUM_WORDS[n]);
  t = t.replace(/\b([a-h])\s+([1-8])\b/g, '$1$2');

  // Promotion choice: "e7e8q", "=N", "promote to knight".
  let promo = null;
  const pw = t.match(/(promot\w*|=|becomes?)\s*(to\s*)?(a\s+)?(queen|rook|bishop|knight|night|[qrbn])\b/);
  if (pw) promo = PROMO_WORDS[pw[4]] || pw[4];
  const glued = t.match(/\b[a-h][1-8]\s*[a-h][1-8]\s*([qrbn])\b/) || t.match(/\b[a-h][1-8][a-h][1-8]([qrbn])\b/);
  if (glued) promo = glued[1];

  let piece = null;
  for (const [re, p] of PIECE_WORDS) { if (re.test(t)) { piece = p; break; } }
  if (pw && piece === promo) { // "pawn e8 promote to queen" — the queen word is the promotion, not the mover
    piece = null;
    for (const [re, p] of PIECE_WORDS) { if (p !== promo && re.test(t)) { piece = p; break; } }
  }

  const squares = [...t.matchAll(/([a-h])([1-8])/g)].map((x) => x[1] + x[2]);

  const finish = (cands, describeAs) => {
    if (promo) { const pc = cands.filter((x) => x.promotion === promo); if (pc.length) cands = pc; }
    // Same from/to with several promotion pieces and none named: choose a queen and say so.
    if (cands.length > 1 && cands.every((x) => x.promotion && x.from === cands[0].from && x.to === cands[0].to)) {
      return { ok: true, move: cands.find((x) => x.promotion === 'q'), note: 'Promoted to a Queen. Add "promote to knight" (or rook, bishop) for another piece.' };
    }
    if (cands.length === 1) return { ok: true, move: cands[0] };
    if (cands.length > 1) {
      return { ok: false, error: `That could mean ${cands.length} different moves. Say which piece or the starting square.`, options: cands.map((x) => describeMove(x).sentence + ` (${x.san})`) };
    }
    return { ok: false, error: describeAs };
  };

  if (squares.length >= 2) {
    const [from, to] = squares.slice(-2);
    const cands = list.filter((x) => x.from === from && x.to === to);
    const pieceOn = chess.get(from);
    let why = `${UP(from)} to ${UP(to)} is not a legal move here.`;
    if (!pieceOn) why = `There is no piece on ${UP(from)}. Check the starting square.`;
    else if (pieceOn.color !== chess.turn()) why = `The piece on ${UP(from)} is ${COLOR[pieceOn.color]}'s, but it is ${COLOR[chess.turn()]} to move.`;
    return finish(cands, why);
  }

  if (squares.length === 1) {
    const to = squares[0];
    let cands = list.filter((x) => x.to === to);
    if (piece) cands = cands.filter((x) => x.piece === piece);
    // A file letter next to "takes" (e.g. "e takes d5") narrows pawn captures.
    const fileHint = t.match(/\b([a-h])\s+(takes|captures|x)\b/);
    if (fileHint && cands.length > 1) {
      const f = cands.filter((x) => x.from[0] === fileHint[1]);
      if (f.length) cands = f;
    }
    const pName = piece ? NAMES[piece] : 'No piece';
    return finish(cands, `${pName === 'No piece' ? 'No piece' : 'No ' + pName.toLowerCase()} of ${COLOR[chess.turn()]}'s can legally move to ${UP(to)}.`);
  }

  return { ok: false, error: `I couldn't read "${original}" as a move. Try e4, Nf3, g1f3, "g1 to f3" or "knight to f3".` };
}

/* ---------- Board facts used for explanations and threats ---------- */
function pieces(chess, color) {
  const out = [];
  for (const row of chess.board()) for (const sq of row) if (sq && sq.color === color) out.push(sq);
  return out;
}

/** Pieces of `color` that the other side can win: attacked and undefended, or attacked by something cheaper. */
export function hangingPieces(chess, color) {
  const res = [];
  for (const p of pieces(chess, color)) {
    if (p.type === 'k') continue;
    const att = chess.attackers(p.square, other(color));
    if (!att.length) continue;
    const def = chess.attackers(p.square, color);
    const cheapest = Math.min(...att.map((s) => VALUES[chess.get(s).type]));
    if (!def.length || cheapest < VALUES[p.type]) {
      const by = att.map((s) => chess.get(s)).sort((a, b) => VALUES[a.type] - VALUES[b.type])[0];
      res.push({ square: p.square, type: p.type, defended: def.length > 0, by: { type: by.type, square: att.find((s) => chess.get(s) === by) || att[0] } });
    }
  }
  return res.sort((a, b) => VALUES[b.type] - VALUES[a.type]);
}

const CENTER = ['d4', 'e4', 'd5', 'e5'];

/** Plain-language reasons for a move, from concrete board facts only. */
export function explainMove(chess, move, moveNumber) {
  const me = chess.turn();
  const reasons = [];
  const before = new Chess(chess.fen());
  const hangBefore = hangingPieces(before, me);
  const after = new Chess(chess.fen());
  after.move({ from: move.from, to: move.to, promotion: move.promotion });

  if (after.isCheckmate()) return ['Delivers checkmate. The game ends immediately.'];
  if (move.flags.includes('k') || move.flags.includes('q')) reasons.push('Castles: moves your king to safety and brings the rook into play.');
  if (move.promotion) reasons.push(`Promotes the pawn to a ${NAMES[move.promotion]}.`);

  if (move.captured) {
    const capVal = VALUES[move.captured];
    const myVal = VALUES[move.promotion || move.piece];
    const recapturable = after.attackers(move.to, other(me)).length > 0;
    const cap = NAMES[move.captured].toLowerCase();
    if (!recapturable) reasons.push(`Wins the ${cap} on ${UP(move.to)}; it cannot be taken back.`);
    else if (capVal > myVal) reasons.push(`Takes the ${cap} with a cheaper piece, so you come out ahead even if they recapture.`);
    else if (capVal === myVal) reasons.push(`Trades your ${NAMES[move.piece].toLowerCase()} for their ${cap}.`);
    else reasons.push(`Captures the ${cap} on ${UP(move.to)}.`);
  }
  if (after.isCheck()) reasons.push('Gives check, so your opponent must deal with the threat to their king.');

  if (hangBefore.some((h) => h.square === move.from)) reasons.push(`Moves your threatened ${NAMES[move.piece].toLowerCase()} out of danger.`);
  const hangAfter = hangingPieces(after, me).map((h) => h.square);
  const saved = hangBefore.filter((h) => h.square !== move.from && !hangAfter.includes(h.square));
  if (saved.length && !move.captured) reasons.push(`Protects your ${NAMES[saved[0].type].toLowerCase()} on ${UP(saved[0].square)}.`);

  if ((move.piece === 'n' || move.piece === 'b') && moveNumber <= 15 && move.from[1] === (me === 'w' ? '1' : '8')) {
    reasons.push(`Develops your ${NAMES[move.piece].toLowerCase()} off the back rank.`);
  }
  if (move.piece === 'p' && CENTER.includes(move.to) && moveNumber <= 20) reasons.push('Puts a pawn in the centre.');
  else {
    const ctl = CENTER.filter((sq) => after.attackers(sq, me).includes(move.to) && !before.attackers(sq, me).includes(move.from));
    const crowded = before.board().flat().filter(Boolean).length >= 20;
    if (ctl.length && moveNumber <= 20 && crowded) reasons.push(`Adds control of the centre (${ctl.map(UP).join(', ')}).`);
  }

  // New attacks made by the moved piece.
  const targets = pieces(after, other(me))
    .filter((p) => p.type !== 'k' && p.square !== move.to)
    .filter((p) => after.attackers(p.square, me).includes(move.to))
    .filter((p) => VALUES[p.type] > VALUES[move.promotion || move.piece] || after.attackers(p.square, other(me)).length === 0)
    .sort((a, b) => VALUES[b.type] - VALUES[a.type]);
  if (targets.length >= 2) reasons.push(`Attacks two pieces at once: the ${NAMES[targets[0].type].toLowerCase()} on ${UP(targets[0].square)} and the ${NAMES[targets[1].type].toLowerCase()} on ${UP(targets[1].square)}.`);
  else if (targets.length === 1) reasons.push(`Attacks the ${NAMES[targets[0].type].toLowerCase()} on ${UP(targets[0].square)}.`);

  return reasons;
}

/* ---------- Engine scores ---------- */
// score: {cp} or {mate} from the side-to-move's point of view.
export function flip(score) { return score.mate != null ? { mate: -score.mate } : { cp: -score.cp }; }
export function toCp(score) {
  if (score.mate != null) return score.mate > 0 ? 10000 - score.mate * 10 : -10000 - score.mate * 10;
  return score.cp;
}
export function clampCp(score) { return Math.max(-1000, Math.min(1000, toCp(score))); }

/** Score from YOUR point of view, in words. */
export function scoreWords(score) {
  if (score.mate != null) {
    if (score.mate === 0) return { short: 'Mate', long: 'Checkmate on the board.' };
    return score.mate > 0
      ? { short: `Mate in ${score.mate}`, long: `You have a forced checkmate in ${score.mate}.` }
      : { short: `Mated in ${-score.mate}`, long: `Your opponent has a forced checkmate in ${-score.mate} with best play.` };
  }
  const p = score.cp / 100;
  const s = (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(2);
  const a = Math.abs(p);
  let feel;
  if (a < 0.3) feel = 'The position is about equal.';
  else if (a < 1) feel = p > 0 ? 'You are slightly better.' : 'Your opponent is slightly better.';
  else if (a < 2.5) feel = p > 0 ? 'You are clearly better.' : 'Your opponent is clearly better.';
  else feel = p > 0 ? 'You are winning.' : 'Your opponent is winning.';
  return { short: s, long: feel };
}

/** Classify a move by how much evaluation the mover lost (centipawns, ≥ 0). */
export function classify(loss, wasBest) {
  if (wasBest || loss <= 10) return { key: 'best', label: 'Best' };
  if (loss <= 40) return { key: 'good', label: 'Good' };
  if (loss <= 90) return { key: 'inaccuracy', label: 'Inaccuracy' };
  if (loss <= 200) return { key: 'mistake', label: 'Mistake' };
  return { key: 'blunder', label: 'Blunder' };
}

/** FEN with the other side to move, for "what would they do if I passed?" threat checks. */
export function nullMoveFen(fen) {
  const f = fen.split(' ');
  f[1] = f[1] === 'w' ? 'b' : 'w';
  f[3] = '-';
  return f.join(' ');
}

export function uciToMove(chess, uci) {
  const from = uci.slice(0, 2), to = uci.slice(2, 4), promotion = uci[4];
  return chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to && (m.promotion || undefined) === (promotion || undefined)) || null;
}

/** Convert an engine PV (UCI list) into verified legal moves; stops at the first move that isn't legal. */
export function pvToMoves(fen, pv, max = 6) {
  const c = new Chess(fen);
  const out = [];
  for (const u of pv.slice(0, max)) {
    const m = uciToMove(c, u);
    if (!m) break;
    out.push(m);
    c.move({ from: m.from, to: m.to, promotion: m.promotion });
  }
  return out;
}
