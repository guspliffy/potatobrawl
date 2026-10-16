/* ===================== Ranked vs CPU: a CPU match that counts for its own rank (the server side is cpurank.js) =====================
   The server deals the match (a ticket: the CPU, its rating and strength, the map and the seed), this phone plays it with no lag and
   logs your inputs in the online encoding, and the server plays the same match again from them before the CPU rank or the board moves.
   Fable's design: quick-match/vs-cpu/fable-vs-cpu.md. Styles: css/96-vscpu.css. The Boards sheet is ui/boards.js. */
const VC = { pl: 0, opl: 0 };   // your place on the CPU board and on the online board (0: not on it)
// The board data for the Boards sheet (ui/boards.js): k "c" (vs CPU) or "o" (online). Resolves to null without the server.
//   { k, n, at, top: [{ id, nm, f, r, w, l, pl }], me: null | { i, pn, row } }   i: your place (0: not on the board), pn: placing
//   matches played (while placing), row: your own row. window.__blBoardMock = { c: {...}, o: {...} } stands in for the server (tests).
function vcBoard(k) {
  if (window.__blBoardMock) return Promise.resolve(window.__blBoardMock[k] || null);
  return Promise.resolve(null);
}
