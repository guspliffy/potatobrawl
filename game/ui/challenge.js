/* ===================== Challenge a friend: a link after a 1v1 (UI only) =====================
   The results of a finished 1v1 against a CPU, a Quick match or Ranked vs CPU carry "Challenge a friend" (#rChl, css/96-challenge.css),
   on our own server only (a link can't reach anyone from inside Claude or from a downloaded copy). A tap hosts a Play friends 1v1 with
   your fighter and your lobby rules, the lobby's own room (netHost), and in that same tap opens the share sheet on a phone or copies
   "Think you can beat my Samurai? <link>" on a computer: both need the tap itself, so the room's code is picked first and the hosting
   follows (NET.chlNext). A challenge room's code starts with "ch": that is how the friend's page and the play counts tell it from an
   ordinary invite. The friend's side is the lobby's invite link as before (online.js NET.invite; loop.js: the turn screen first, then the
   lobby, no welcome sheet). Counts (ui/counter.js): chl:make, chl:open, chl:new (opened on a brand-new device) and chl:play (a 1v1
   started in a challenge room, counted on the friend's phone). */
const CHL = { copied: 0 };   // 1: the line is on the clipboard and the lobby's link card hasn't said so yet
const chlRoom = (code) => typeof code === "string" && /^ch[a-z0-9]{7}$/.test(code);
const chlCan = () => !!NET.standalone && onlineAvailable() && !(NET.tried && !NET.ok);
const chlText = () => `Think you can beat my ${FIG[sel.fighter].name}?`;
const chlPhone = () => !!navigator.share && !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);   // a computer copies the link instead
// screens.js showResults: after a finished 1v1 against a CPU (the Road, the Daily, bosses, 2v2, the Tournament and the tutorial have their
// own ends), a Quick match and Ranked vs CPU (not a warm-up while the search runs: the tap would stop it); not after Play friends
function chlRes(R) {
  const solo = R.qm ? !R.qm.tm : R.vc || (R.warm ? !R.tcw && !qmSearching() : !R.tc && !R.online && !R.daily && !R.road && !R.boss && !R.duo);   // not after a cup match (ui/tourney.js) or in the cup lobby
  $("rChl").hidden = !(solo && !R.forfeit && !R.left && !R.lost && chlCan());
}
tap("rChl", () => {
  if (mode !== "result" || !chlCan()) return;
  const code = ("ch" + Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, "0")).padEnd(9, "0"), link = inviteLink(code);
  CHL.copied = 0;
  if (chlPhone()) { try { navigator.share({ title: "PotatoBrawl", text: chlText(), url: link }).catch(() => {}); } catch (e) { /* no share sheet: the lobby's link card has it */ } }
  else {
    try { navigator.clipboard.writeText(`${chlText()} ${link}`).then(() => { CHL.copied = 1; chlCopied(); }, () => {}); } catch (e) { /* the card's Copy link */ }
  }
  cnt("chl:make");
  // leave the results the way Menu does (a chip challenge withdrawn, a Quick match search stopped, its room left), then host a 1v1
  stkLeave(); qmStop();
  if (NET.mr) leaveMatchRoom();
  if (NET.phase !== "idle") { resetNet(); NET.phase = "idle"; }
  P.onBoss = Object.assign({}, P.onBoss, { on: false }); P.onTeam = Object.assign({}, P.onTeam, { on: false });
  saveProfile();
  NET.chlNext = code;
  openOnline();
  NET.autoHost = NET.phase === "idle";
  autoHost();
});
// "Link copied" on the lobby's link card, once it is up (renderOnline calls this too: the copy can land before or after the room opens)
function chlCopied() {
  const btn = $("onCopy");
  if (!CHL.copied || mode !== "online" || $("onInvite").hidden || !chlRoom(NET.hostCode)) return;
  CHL.copied = 0;
  btn.textContent = "Link copied";
  setTimeout(() => { btn.textContent = "Copy link"; }, 2500);
}
