/*
 * Shahi Shatranj — chess rules engine (no graphics here).
 * Full modern FIDE rules: castling, en passant, promotion, check,
 * checkmate, stalemate, threefold repetition, fifty-move rule,
 * insufficient material. Also a small computer opponent ("the Vizier").
 *
 * Squares are numbers 0..63: a1 = 0, b1 = 1 ... h8 = 63.
 * Pieces are letters: uppercase = White (PNBRQK), lowercase = Black.
 */
(function (root) {
  'use strict';

  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const FILES = 'abcdefgh';
  const N_OFF = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const K_OFF = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const B_DIR = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const R_DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const Q_DIR = B_DIR.concat(R_DIR);

  const colorOf = (p) => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
  const sqName = (s) => FILES[s & 7] + ((s >> 3) + 1);
  const sqIndex = (n) => (n.charCodeAt(1) - 49) * 8 + (n.charCodeAt(0) - 97);
  const other = (c) => (c === 'w' ? 'b' : 'w');
  const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

  class Chess {
    constructor(fen) { this.load(fen || START); }

    load(fen) {
      const parts = fen.trim().split(/\s+/);
      this.board = new Array(64).fill(null);
      const rows = parts[0].split('/');
      for (let i = 0; i < 8; i++) {
        let f = 0;
        for (const ch of rows[i]) {
          if (ch >= '1' && ch <= '8') f += +ch;
          else { this.board[(7 - i) * 8 + f] = ch; f++; }
        }
      }
      this.turn = parts[1] || 'w';
      const c = parts[2] || '-';
      this.castling = { K: c.includes('K'), Q: c.includes('Q'), k: c.includes('k'), q: c.includes('q') };
      this.ep = parts[3] && parts[3] !== '-' ? sqIndex(parts[3]) : -1;
      this.half = parseInt(parts[4] || '0', 10);
      this.full = parseInt(parts[5] || '1', 10);
      this.kings = { w: this.board.indexOf('K'), b: this.board.indexOf('k') };
      this.history = [];
      this.played = [];
      this.positions = new Map();
      this._bump(1);
    }

    reset() { this.load(START); }

    fen() {
      let s = '';
      for (let r = 7; r >= 0; r--) {
        let empty = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.board[r * 8 + f];
          if (!p) empty++;
          else { if (empty) { s += empty; empty = 0; } s += p; }
        }
        if (empty) s += empty;
        if (r) s += '/';
      }
      const c = (this.castling.K ? 'K' : '') + (this.castling.Q ? 'Q' : '') +
                (this.castling.k ? 'k' : '') + (this.castling.q ? 'q' : '');
      return `${s} ${this.turn} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
    }

    // Position identity for repetition. En passant only counts if a capture is really possible.
    _posKey() {
      let ep = '-';
      if (this.ep >= 0) {
        const pawn = this.turn === 'w' ? 'P' : 'p';
        const r = (this.ep >> 3) + (this.turn === 'w' ? -1 : 1);
        const f = this.ep & 7;
        for (const df of [-1, 1]) {
          if (onBoard(f + df, r) && this.board[r * 8 + f + df] === pawn) ep = sqName(this.ep);
        }
      }
      const p = this.fen().split(' ');
      return `${p[0]} ${p[1]} ${p[2]} ${ep}`;
    }

    _bump(d) {
      const k = this._posKey();
      this.positions.set(k, (this.positions.get(k) || 0) + d);
    }

    get(sq) { return this.board[sq]; }

    attacked(sq, by) {
      const B = this.board, f = sq & 7, r = sq >> 3;
      const w = by === 'w';
      const P = w ? 'P' : 'p', N = w ? 'N' : 'n', Bi = w ? 'B' : 'b', R = w ? 'R' : 'r', Q = w ? 'Q' : 'q', K = w ? 'K' : 'k';
      const pr = w ? r - 1 : r + 1;
      if (pr >= 0 && pr < 8) {
        if (f > 0 && B[pr * 8 + f - 1] === P) return true;
        if (f < 7 && B[pr * 8 + f + 1] === P) return true;
      }
      for (const [df, dr] of N_OFF) {
        const ff = f + df, rr = r + dr;
        if (onBoard(ff, rr) && B[rr * 8 + ff] === N) return true;
      }
      for (const [df, dr] of K_OFF) {
        const ff = f + df, rr = r + dr;
        if (onBoard(ff, rr) && B[rr * 8 + ff] === K) return true;
      }
      for (const [df, dr] of B_DIR) {
        let ff = f + df, rr = r + dr;
        while (onBoard(ff, rr)) {
          const p = B[rr * 8 + ff];
          if (p) { if (p === Bi || p === Q) return true; break; }
          ff += df; rr += dr;
        }
      }
      for (const [df, dr] of R_DIR) {
        let ff = f + df, rr = r + dr;
        while (onBoard(ff, rr)) {
          const p = B[rr * 8 + ff];
          if (p) { if (p === R || p === Q) return true; break; }
          ff += df; rr += dr;
        }
      }
      return false;
    }

    // All moves that follow piece movement, before checking king safety.
    _pseudo(c, capturesOnly) {
      const B = this.board, moves = [];
      const add = (from, to, flags, promo) => {
        moves.push({
          from, to, piece: B[from], color: c,
          captured: flags === 'e' ? (c === 'w' ? 'p' : 'P') : B[to],
          flags, promotion: promo || null,
        });
      };
      for (let s = 0; s < 64; s++) {
        const p = B[s];
        if (!p || colorOf(p) !== c) continue;
        const t = p.toLowerCase(), f = s & 7, r = s >> 3;
        if (t === 'p') {
          const dir = c === 'w' ? 1 : -1, startR = c === 'w' ? 1 : 6, lastR = c === 'w' ? 7 : 0;
          const r1 = r + dir;
          if (r1 < 0 || r1 > 7) continue;
          const one = r1 * 8 + f;
          if (!B[one]) {
            if (r1 === lastR) { for (const pr of 'qrbn') add(s, one, 'n', pr); }
            else if (!capturesOnly) {
              add(s, one, 'n');
              const two = (r + 2 * dir) * 8 + f;
              if (r === startR && !B[two]) add(s, two, 'b');
            }
          }
          for (const df of [-1, 1]) {
            const ff = f + df;
            if (ff < 0 || ff > 7) continue;
            const to = r1 * 8 + ff, q = B[to];
            if (q && colorOf(q) !== c) {
              if (r1 === lastR) { for (const pr of 'qrbn') add(s, to, 'c', pr); }
              else add(s, to, 'c');
            } else if (!q && to === this.ep) add(s, to, 'e');
          }
        } else if (t === 'n' || t === 'k') {
          for (const [df, dr] of (t === 'n' ? N_OFF : K_OFF)) {
            const ff = f + df, rr = r + dr;
            if (!onBoard(ff, rr)) continue;
            const to = rr * 8 + ff, q = B[to];
            if (!q) { if (!capturesOnly) add(s, to, 'n'); }
            else if (colorOf(q) !== c) add(s, to, 'c');
          }
        } else {
          const dirs = t === 'b' ? B_DIR : t === 'r' ? R_DIR : Q_DIR;
          for (const [df, dr] of dirs) {
            let ff = f + df, rr = r + dr;
            while (onBoard(ff, rr)) {
              const to = rr * 8 + ff, q = B[to];
              if (!q) { if (!capturesOnly) add(s, to, 'n'); }
              else { if (colorOf(q) !== c) add(s, to, 'c'); break; }
              ff += df; rr += dr;
            }
          }
        }
      }
      if (!capturesOnly) {
        const them = other(c);
        const base = c === 'w' ? 0 : 56;
        const K = c === 'w' ? 'K' : 'k', R = c === 'w' ? 'R' : 'r';
        const canK = c === 'w' ? this.castling.K : this.castling.k;
        const canQ = c === 'w' ? this.castling.Q : this.castling.q;
        if (B[base + 4] === K && (canK || canQ) && !this.attacked(base + 4, them)) {
          if (canK && B[base + 7] === R && !B[base + 5] && !B[base + 6] &&
              !this.attacked(base + 5, them) && !this.attacked(base + 6, them)) add(base + 4, base + 6, 'k');
          if (canQ && B[base] === R && !B[base + 1] && !B[base + 2] && !B[base + 3] &&
              !this.attacked(base + 3, them) && !this.attacked(base + 2, them)) add(base + 4, base + 2, 'q');
        }
      }
      return moves;
    }

    _make(m) {
      const B = this.board, us = m.color;
      this.history.push({ m, castling: { ...this.castling }, ep: this.ep, half: this.half, full: this.full });
      B[m.to] = m.promotion ? (us === 'w' ? m.promotion.toUpperCase() : m.promotion) : m.piece;
      B[m.from] = null;
      if (m.flags === 'e') B[m.to + (us === 'w' ? -8 : 8)] = null;
      else if (m.flags === 'k') { B[m.to - 1] = B[m.to + 1]; B[m.to + 1] = null; }
      else if (m.flags === 'q') { B[m.to + 1] = B[m.to - 2]; B[m.to - 2] = null; }
      const t = m.piece.toLowerCase();
      if (t === 'k') {
        this.kings[us] = m.to;
        if (us === 'w') { this.castling.K = false; this.castling.Q = false; }
        else { this.castling.k = false; this.castling.q = false; }
      }
      for (const s of [m.from, m.to]) {
        if (s === 0) this.castling.Q = false;
        else if (s === 7) this.castling.K = false;
        else if (s === 56) this.castling.q = false;
        else if (s === 63) this.castling.k = false;
      }
      this.ep = m.flags === 'b' ? (m.from + m.to) >> 1 : -1;
      this.half = t === 'p' || m.captured ? 0 : this.half + 1;
      if (us === 'b') this.full++;
      this.turn = other(us);
    }

    _undo() {
      const h = this.history.pop();
      if (!h) return null;
      const m = h.m, B = this.board;
      B[m.from] = m.piece;
      B[m.to] = null;
      if (m.flags === 'e') B[m.to + (m.color === 'w' ? -8 : 8)] = m.captured;
      else if (m.captured) B[m.to] = m.captured;
      if (m.flags === 'k') { B[m.to + 1] = B[m.to - 1]; B[m.to - 1] = null; }
      else if (m.flags === 'q') { B[m.to - 2] = B[m.to + 1]; B[m.to + 1] = null; }
      if (m.piece.toLowerCase() === 'k') this.kings[m.color] = m.from;
      this.castling = h.castling; this.ep = h.ep; this.half = h.half; this.full = h.full;
      this.turn = m.color;
      return m;
    }

    _legal(c = this.turn) {
      const out = [];
      for (const m of this._pseudo(c)) {
        this._make(m);
        if (!this.attacked(this.kings[c], other(c))) out.push(m);
        this._undo();
      }
      return out;
    }

    moves(square) {
      const all = this._legal();
      return square == null ? all : all.filter((m) => m.from === square);
    }

    _san(m, legal) {
      let s;
      if (m.flags === 'k') s = 'O-O';
      else if (m.flags === 'q') s = 'O-O-O';
      else {
        const t = m.piece.toUpperCase();
        if (t === 'P') {
          s = (m.captured ? FILES[m.from & 7] + 'x' : '') + sqName(m.to);
          if (m.promotion) s += '=' + m.promotion.toUpperCase();
        } else {
          const rivals = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
          let dis = '';
          if (rivals.length) {
            const sameFile = rivals.some((o) => (o.from & 7) === (m.from & 7));
            const sameRank = rivals.some((o) => (o.from >> 3) === (m.from >> 3));
            if (!sameFile) dis = FILES[m.from & 7];
            else if (!sameRank) dis = String((m.from >> 3) + 1);
            else dis = sqName(m.from);
          }
          s = t + dis + (m.captured ? 'x' : '') + sqName(m.to);
        }
      }
      this._make(m);
      if (this.inCheck()) s += this._legal().length ? '+' : '#';
      this._undo();
      return s;
    }

    // Play a move: { from, to, promotion? }. Returns the full move or null if illegal.
    move(spec) {
      const legal = this._legal();
      const m = legal.find((x) => x.from === spec.from && x.to === spec.to &&
        (!x.promotion || x.promotion === (spec.promotion || 'q')));
      if (!m) return null;
      m.san = this._san(m, legal);
      this._make(m);
      this._bump(1);
      this.played.push(m);
      return m;
    }

    undo() {
      if (!this.played.length) return null;
      this._bump(-1);
      this.played.pop();
      return this._undo();
    }

    inCheck() { return this.attacked(this.kings[this.turn], other(this.turn)); }

    isInsufficient() {
      const minors = [];
      for (let s = 0; s < 64; s++) {
        const p = this.board[s];
        if (!p || p === 'K' || p === 'k') continue;
        const t = p.toLowerCase();
        if (t === 'p' || t === 'r' || t === 'q') return false;
        minors.push({ t, shade: ((s & 7) + (s >> 3)) % 2 });
      }
      if (minors.length <= 1) return true;
      if (minors.every((m) => m.t === 'b')) return minors.every((m) => m.shade === minors[0].shade);
      return false;
    }

    // { over, winner: 'w'|'b'|null, reason }
    status() {
      const legal = this._legal();
      const check = this.inCheck();
      if (!legal.length) {
        return check ? { over: true, winner: other(this.turn), reason: 'checkmate', check }
                     : { over: true, winner: null, reason: 'stalemate', check };
      }
      if (this.isInsufficient()) return { over: true, winner: null, reason: 'insufficient material', check };
      if ((this.positions.get(this._posKey()) || 0) >= 3) return { over: true, winner: null, reason: 'threefold repetition', check };
      if (this.half >= 100) return { over: true, winner: null, reason: 'fifty-move rule', check };
      return { over: false, check };
    }

    /* ---------------- The Vizier (computer opponent) ---------------- */

    evaluate() {
      const B = this.board;
      let s = 0, heavy = 0;
      for (let i = 0; i < 64; i++) {
        const p = B[i];
        if (p && 'nbrqNBRQ'.includes(p)) heavy += VAL[p.toLowerCase()];
      }
      const endgame = heavy <= 2600;
      for (let i = 0; i < 64; i++) {
        const p = B[i];
        if (!p) continue;
        const t = p.toLowerCase(), f = i & 7, r = i >> 3;
        const table = t === 'k' && endgame ? PST.ke : PST[t];
        if (p === t) s -= VAL[t] + table[r * 8 + f];
        else s += VAL[t] + table[(7 - r) * 8 + f];
      }
      return this.turn === 'w' ? s : -s;
    }

    _order(moves) {
      for (const m of moves) {
        let k = 0;
        if (m.captured) k += 10 * VAL[m.captured.toLowerCase()] - VAL[m.piece.toLowerCase()] / 10 + 1000;
        if (m.promotion) k += VAL[m.promotion] + 800;
        m._k = k;
      }
      moves.sort((a, b) => b._k - a._k);
      return moves;
    }

    _quiesce(alpha, beta, ctx, qd) {
      ctx.nodes++;
      const stand = this.evaluate();
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (qd > 6) return alpha;
      const c = this.turn, them = other(c);
      for (const m of this._order(this._pseudo(c, true))) {
        this._make(m);
        if (this.attacked(this.kings[c], them)) { this._undo(); continue; }
        const sc = -this._quiesce(-beta, -alpha, ctx, qd + 1);
        this._undo();
        if (sc >= beta) return beta;
        if (sc > alpha) alpha = sc;
      }
      return alpha;
    }

    _search(depth, alpha, beta, ply, ctx) {
      if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.stop = true;
      if (ctx.stop) return 0;
      if (depth <= 0) return this._quiesce(alpha, beta, ctx, 0);
      const c = this.turn, them = other(c);
      let legal = 0, best = -INF;
      for (const m of this._order(this._pseudo(c))) {
        this._make(m);
        if (this.attacked(this.kings[c], them)) { this._undo(); continue; }
        legal++;
        const sc = -this._search(depth - 1, -beta, -alpha, ply + 1, ctx);
        this._undo();
        if (ctx.stop) return 0;
        if (sc > best) best = sc;
        if (sc > alpha) alpha = sc;
        if (alpha >= beta) break;
      }
      if (!legal) return this.attacked(this.kings[c], them) ? -MATE + ply : 0;
      if (this.half >= 100) return 0;
      return best;
    }

    // level: 1 = Novice, 2 = Courtier, 3 = Grand Vizier
    bestMove(level = 2) {
      const root = this._legal();
      if (!root.length) return null;
      const ctx = { nodes: 0, stop: false, deadline: Date.now() + (level >= 3 ? 2500 : 1200) };
      const maxDepth = level === 1 ? 1 : level === 2 ? 2 : 5;
      const scoreMove = (m, depth, alpha, beta) => {
        this._make(m);
        let sc;
        // avoid walking into a repeated position when not losing
        if ((this.positions.get(this._posKey()) || 0) >= 2) sc = 0;
        else sc = -this._search(depth - 1, -beta, -alpha, 1, ctx);
        this._undo();
        return sc;
      };
      if (level === 1) {
        const scored = root.map((m) => ({ m, s: scoreMove(m, 1, -INF, INF) + Math.random() * 120 }));
        scored.sort((a, b) => b.s - a.s);
        return scored[0].m;
      }
      let best = this._order(root.slice())[0];
      let ordered = this._order(root.slice());
      for (let depth = 1; depth <= maxDepth; depth++) {
        let alpha = -INF, iterBest = null;
        const scores = [];
        for (const m of ordered) {
          const sc = scoreMove(m, depth, alpha - 30, INF);
          if (ctx.stop) break;
          scores.push({ m, sc });
          if (!iterBest || sc > alpha) { alpha = sc; iterBest = m; }
        }
        if (ctx.stop && !iterBest) break;
        if (iterBest) best = iterBest;
        if (ctx.stop) break;
        // a little variety between near-equal moves
        const near = scores.filter((x) => x.sc >= alpha - 12);
        if (near.length > 1 && depth === maxDepth) best = near[Math.floor(Math.random() * near.length)].m;
        ordered = [best].concat(ordered.filter((m) => m !== best));
        if (alpha > MATE - 100) break;
      }
      return best;
    }
  }

  const INF = 1e9, MATE = 1e6;
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    ke: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };

  Chess.START = START;
  Chess.sqName = sqName;
  Chess.sqIndex = sqIndex;
  Chess.colorOf = colorOf;
  root.Chess = Chess;
})(typeof window !== 'undefined' ? window : this);
