import { createStore } from "./store.js";

/* ============================================================
   Config
   ============================================================ */

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3APYC1QfmdVhtIeeTSVdRpRxODl/hf_20261015_020205_";
// Brand imagery generated with Higgsfield (see README to self-host these in /assets).
const IMG = {
  hero: CDN + "39367cf5-4ce5-415f-8d1d-21a67246bdf0_min.webp",
  hoops: CDN + "3fbf0e27-66a4-4fe3-94c3-67fb4b81ecee_min.webp",
  ball: CDN + "6a9fbda5-8466-4fe6-afe7-146b76213435_min.webp",
  icon: CDN + "6fc0934b-d063-484c-9b3e-8c05236459ca_min.webp",
  motm: CDN + "aaccf9cb-c393-49fd-b325-d528dbd8d9c8_min.webp",
};

const SPORTS = {
  soccer: { label: "Soccer", icon: "⚽", stats: [["goals", "G"], ["assists", "A"], ["saves", "SV"]], key: "goals", keyLabel: "Goals/G", img: IMG.hero },
  basketball: { label: "Basketball", icon: "🏀", stats: [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["stl", "STL"], ["blk", "BLK"]], key: "pts", keyLabel: "PPG", positions: ["PG", "SG", "SF", "PF", "C"], img: IMG.hoops },
  volleyball: { label: "Volleyball", icon: "🏐", stats: [["kills", "K"], ["aces", "ACE"], ["blocks", "BLK"], ["digs", "DIG"]], key: "kills", keyLabel: "Kills/G", positions: ["S", "OH", "MB", "OPP", "L"], img: IMG.ball },
  other: { label: "Other", icon: "🎯", stats: [["pts", "PTS"]], key: "pts", keyLabel: "Pts/G", positions: [], img: IMG.ball },
};
const sportOf = (g) => SPORTS[g.sport] || SPORTS.other;

/* ============================================================
   State
   ============================================================ */

const store = createStore();
const state = {
  me: null, users: [], games: [], ratings: [], friendships: [],
  feedFilter: "all", feedScope: "friends", leadersSport: "all", squadTab: "friends",
  authTab: "login", phone: { number: "", sent: false },
};

async function reload() {
  const me = await store.currentUser();
  if (!me) {
    Object.assign(state, { me, users: [], games: [], ratings: [], friendships: [] });
    return;
  }
  const [users, games, ratings, friendships] = await Promise.all([store.listUsers(), store.listGames(), store.listRatings(), store.listFriendships()]);
  Object.assign(state, { me, users, games, ratings, friendships });
}

/* ============================================================
   Helpers
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const user = (id) => state.users.find((u) => u.id === id);
const uname = (id) => user(id)?.displayName ?? "Unknown";
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (n, d = 1) => (n == null || Number.isNaN(n) ? "–" : Number(n).toFixed(d));
const meId = () => state.me?.id;

/* ---------- Friends ---------- */
function friendLink(otherId) {
  return state.friendships.find((f) => (f.from === meId() && f.to === otherId) || (f.to === meId() && f.from === otherId));
}
function friendStatus(otherId) {
  const f = friendLink(otherId);
  if (!f) return "none";
  if (f.status === "accepted") return "friends";
  return f.from === meId() ? "outgoing" : "incoming";
}
const friendIds = () =>
  new Set(state.friendships.filter((f) => f.status === "accepted" && (f.from === meId() || f.to === meId())).map((f) => (f.from === meId() ? f.to : f.from)));
const incomingRequests = () => state.friendships.filter((f) => f.status === "pending" && f.to === meId());
const gamePlayers = (g) => [...g.teamA.playerIds, ...(g.teamB?.playerIds || [])];

function friendButton(id, size = "") {
  if (!state.me || id === meId()) return "";
  const st = friendStatus(id);
  const f = friendLink(id);
  if (st === "friends") return `<button class="btn ghost ${size} friend-on" data-unfriend="${f.id}">✓ Friends</button>`;
  if (st === "outgoing") return `<button class="btn ghost ${size}" data-cancel="${f.id}">Requested · Cancel</button>`;
  if (st === "incoming") return `<span class="btn-pair"><button class="btn primary ${size}" data-accept="${f.id}">Accept</button><button class="btn ghost ${size}" data-decline="${f.id}">Decline</button></span>`;
  return `<button class="btn ${size}" data-addfriend="${id}">＋ Add friend</button>`;
}

function bindFriendButtons(root = document) {
  const run = (el, fn, msg) => el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    act(el, async () => { await fn(); await reload(); render(); if (msg) toast(msg); });
  });
  $$("[data-addfriend]", root).forEach((b) => run(b, () => store.requestFriend(meId(), b.dataset.addfriend), "Friend request sent"));
  $$("[data-accept]", root).forEach((b) => run(b, () => store.respondFriend(b.dataset.accept, true), "You're friends now"));
  $$("[data-decline]", root).forEach((b) => run(b, () => store.respondFriend(b.dataset.decline, false), "Request declined"));
  $$("[data-cancel]", root).forEach((b) => run(b, () => store.removeFriend(b.dataset.cancel), "Request cancelled"));
  $$("[data-unfriend]", root).forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (b.dataset.armed) {
      act(b, async () => { await store.removeFriend(b.dataset.unfriend); await reload(); render(); toast("Removed from friends"); });
    } else {
      b.dataset.armed = "1";
      b.textContent = "Tap again to remove";
      b.classList.add("danger");
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "✓ Friends"; b.classList.remove("danger"); } }, 3000);
    }
  }));
}

function localDate(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}

function relDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((now - then) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  if (Math.abs(diff) < 7) return then.toLocaleDateString(undefined, { weekday: "long" });
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function ratingClass(r) {
  if (r == null) return "r-none";
  if (r >= 9) return "r-elite";
  if (r >= 8) return "r-great";
  if (r >= 7) return "r-good";
  if (r >= 6.5) return "r-ok";
  if (r >= 6) return "r-meh";
  return "r-bad";
}
const badge = (r, size = "") => `<span class="badge ${ratingClass(r)} ${size}">${fmt(r)}</span>`;

function avatar(id, size = "") {
  const u = user(id);
  const name = u?.displayName ?? "?";
  const initials = name.replace(/\(.*\)/, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const img = u?.avatar ? `<img src="${esc(u.avatar)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return `<span class="avatar ${size}" style="--c:${u?.color ?? "#64748b"}">${esc(initials)}${img}</span>`;
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2600);
}

async function act(btn, fn) {
  if (btn) btn.disabled = true;
  try {
    await fn();
  } catch (err) {
    toast(err.message || String(err));
    if (btn) btn.disabled = false;
  }
}

/* ============================================================
   Game rules
   ============================================================ */

const teamOf = (g, id) => (g.teamA?.playerIds.includes(id) ? "A" : g.teamB?.playerIds.includes(id) ? "B" : null);
const captainOf = (g, id) => (g.teamA?.captainId === id ? "A" : g.teamB?.captainId === id ? "B" : null);
const teamObj = (g, side) => (side === "A" ? g.teamA : g.teamB);
const formatLabel = (g) => `${g.teamA.playerIds.length}v${g.teamB ? g.teamB.playerIds.length : "?"}`;

function ratingIndex() {
  const idx = new Map();
  for (const r of state.ratings) {
    const k = `${r.gameId}|${r.target}`;
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k).push(r.score);
  }
  return idx;
}
const ratingFor = (idx, gid, target) => avg(idx.get(`${gid}|${target}`) || []);
const votesFor = (idx, gid, target) => (idx.get(`${gid}|${target}`) || []).length;

function motm(idx, g) {
  if (g.status !== "final") return null;
  let best = null;
  for (const id of [...g.teamA.playerIds, ...(g.teamB?.playerIds || [])]) {
    const r = ratingFor(idx, g.id, id);
    if (r == null) continue;
    const v = votesFor(idx, g.id, id);
    if (!best || r > best.rating || (r === best.rating && v > best.votes)) best = { playerId: id, rating: r, votes: v };
  }
  return best;
}

function winner(g) {
  if (g.status !== "final") return null;
  const a = Number(g.teamA.score), b = Number(g.teamB.score);
  return a > b ? "A" : b > a ? "B" : "D";
}

// Who I'm allowed to rate in this game: teammates (not me) + the ref.
function rateTargets(g, id) {
  const side = teamOf(g, id);
  if (!side || g.status !== "final") return [];
  const out = teamObj(g, side).playerIds.filter((p) => p !== id).map((p) => ({ target: p }));
  if (g.ref && g.ref.userId !== id) out.push({ target: "ref" });
  return out;
}

function pendingGames() {
  if (!state.me) return [];
  return state.games.filter((g) =>
    rateTargets(g, meId()).some((t) => !state.ratings.some((r) => r.gameId === g.id && r.raterId === meId() && r.target === t.target))
  );
}

function playerSummary(pid, sport = "all") {
  const idx = ratingIndex();
  const games = [];
  for (const g of state.games) {
    if (g.status !== "final" || (sport !== "all" && g.sport !== sport)) continue;
    const side = teamOf(g, pid);
    if (!side) continue;
    const w = winner(g);
    games.push({
      g, side,
      rating: ratingFor(idx, g.id, pid),
      res: w === "D" ? "D" : w === side ? "W" : "L",
      motm: motm(idx, g)?.playerId === pid,
      stats: g.stats?.[pid] || {},
      captain: captainOf(g, pid) === side,
    });
  }
  games.sort((a, b) => (b.g.date + (b.g.time || "")).localeCompare(a.g.date + (a.g.time || "")));
  const rated = games.filter((x) => x.rating != null);
  const bySport = {};
  for (const x of games) {
    const s = (bySport[x.g.sport] ??= { games: 0, totals: {}, ratings: [] });
    s.games++;
    if (x.rating != null) s.ratings.push(x.rating);
    for (const [k, v] of Object.entries(x.stats)) s.totals[k] = (s.totals[k] || 0) + (Number(v) || 0);
  }
  const reffed = state.games.filter((g) => g.status === "final" && g.ref?.userId === pid);
  const refRatings = reffed.map((g) => ratingFor(idx, g.id, "ref")).filter((r) => r != null);
  return {
    games, bySport,
    avg: avg(rated.map((x) => x.rating)),
    wins: games.filter((x) => x.res === "W").length,
    losses: games.filter((x) => x.res === "L").length,
    draws: games.filter((x) => x.res === "D").length,
    motms: games.filter((x) => x.motm).length,
    best: rated.reduce((b, x) => (!b || x.rating > b.rating ? x : b), null),
    reffed: reffed.length,
    refAvg: avg(refRatings),
  };
}

function statLine(sport, stats) {
  const cfg = SPORTS[sport] || SPORTS.other;
  const parts = cfg.stats.filter(([k]) => Number(stats?.[k])).map(([k, l]) => `${stats[k]} ${l}`);
  return parts.join(" · ");
}

/* ============================================================
   Formations
   ============================================================ */

function formationOptions(outfield) {
  if (outfield <= 0) return [""];
  if (outfield <= 2) return outfield === 1 ? ["1"] : ["2", "1-1"];
  const out = [];
  const rec = (left, parts) => {
    if (left === 0) {
      if (parts.length >= 2 && parts.length <= 4) out.push(parts);
      return;
    }
    if (parts.length >= 4) return;
    for (let n = 1; n <= Math.min(5, left); n++) rec(left - n, [...parts, n]);
  };
  rec(outfield, []);
  const score = (p) => {
    let s = 0;
    if (p.length === 3) s -= 3;
    if (p.length === 4 && outfield >= 8) s -= 2;
    if (p.length === 2 && outfield <= 4) s -= 2;
    if (p[0] >= 2 && p[0] <= 4) s -= 2;
    if (p[p.length - 1] <= 2) s -= 1;
    const m = outfield / p.length;
    s += p.reduce((a, x) => a + (x - m) ** 2, 0) * 0.4;
    return s;
  };
  return out.sort((a, b) => score(a) - score(b)).slice(0, 8).map((p) => p.join("-"));
}

function slotKeys(formation, gk) {
  const keys = gk ? ["gk"] : [];
  if (formation) formation.split("-").map(Number).forEach((n, li) => { for (let j = 0; j < n; j++) keys.push(`${li}-${j}`); });
  return keys;
}

// Keep the team's formation & slot assignments valid for its current roster.
function normalizeTeam(team, sport) {
  if (sport !== "soccer") {
    team.formation = null;
    team.gk = false;
    team.slots = {};
    team.positions ??= {};
    for (const k of Object.keys(team.positions)) if (!team.playerIds.includes(k)) delete team.positions[k];
    return team;
  }
  const n = team.playerIds.length;
  if (n < 2) team.gk = false;
  const outfield = n - (team.gk ? 1 : 0);
  const sum = (team.formation || "").split("-").filter(Boolean).map(Number).reduce((a, b) => a + b, 0);
  if (sum !== outfield) team.formation = formationOptions(outfield)[0];
  const keys = slotKeys(team.formation, team.gk);
  const slots = {};
  const used = new Set();
  for (const k of keys) {
    const p = team.slots?.[k];
    if (p && team.playerIds.includes(p) && !used.has(p)) { slots[k] = p; used.add(p); }
  }
  const free = team.playerIds.filter((p) => !used.has(p));
  for (const k of keys) if (!slots[k]) slots[k] = free.shift();
  team.slots = slots;
  team.positions = {};
  return team;
}

function pitch(team, { editable = false, idx = null, gameId = null, selected = null, side = "A" } = {}) {
  const lines = (team.formation || "").split("-").filter(Boolean).map(Number);
  const token = (key) => {
    const pid = team.slots[key];
    if (!pid) return `<div class="token empty"></div>`;
    const r = idx ? ratingFor(idx, gameId, pid) : null;
    const tag = editable ? "button" : "a";
    const attrs = editable ? `type="button" data-slot="${key}"` : `href="#/p/${pid}"`;
    return `<${tag} class="token ${selected === key ? "sel" : ""}" ${attrs}>
      ${avatar(pid)}${idx ? `<span class="tbadge">${badge(r, "sm")}</span>` : ""}
      ${team.captainId === pid ? '<span class="cap" title="Captain">C</span>' : ""}
      <span class="tname">${esc(uname(pid).split(" ")[0])}</span></${tag}>`;
  };
  const rows = lines
    .map((n, li) => `<div class="prow">${Array.from({ length: n }, (_, j) => token(`${li}-${j}`)).join("")}</div>`)
    .reverse()
    .join("");
  return `
  <div class="pitch side-${side}">
    <div class="pitch-lines"><span class="box top"></span><span class="circle"></span><span class="half"></span><span class="box bottom"></span></div>
    <div class="formation-tag">${esc(team.formation || "")}${team.gk ? "" : " · no GK"}</div>
    ${rows}
    ${team.gk ? `<div class="prow gk">${token("gk")}</div>` : ""}
  </div>`;
}

function lineupList(g, team, idx) {
  const cfg = sportOf(g);
  const rows = team.playerIds
    .map((pid) => ({ pid, r: idx ? ratingFor(idx, g.id, pid) : null, v: idx ? votesFor(idx, g.id, pid) : 0 }))
    .sort((a, b) => (b.r ?? -1) - (a.r ?? -1));
  const top = idx ? motm(idx, g) : null;
  return rows
    .map(({ pid, r, v }) => `
    <a class="lineup-row" href="#/p/${pid}">
      ${avatar(pid)}
      <div class="grow"><b>${esc(uname(pid))}${team.captainId === pid ? ' <span class="cap-inline">C</span>' : ""}${top?.playerId === pid ? ' <span class="motm-inline">MOTM</span>' : ""}</b>
      <small class="muted">${[team.positions?.[pid], cfg === SPORTS.soccer ? slotLabel(team, pid) : null, statLine(g.sport, g.stats?.[pid])].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</small></div>
      ${idx ? `<div class="rcol">${badge(r)}<small class="muted">${v} vote${v === 1 ? "" : "s"}</small></div>` : ""}
    </a>`)
    .join("");
}

function slotLabel(team, pid) {
  const key = Object.keys(team.slots || {}).find((k) => team.slots[k] === pid);
  if (!key) return null;
  if (key === "gk") return "GK";
  const lines = (team.formation || "").split("-").length;
  const li = Number(key.split("-")[0]);
  if (lines === 1) return "Outfield";
  if (li === 0) return "DEF";
  if (li === lines - 1) return "ATT";
  return "MID";
}

/* ============================================================
   Shared components
   ============================================================ */

function gameCard(g, idx) {
  const cfg = sportOf(g);
  const w = winner(g);
  const top = motm(idx, g);
  const status =
    g.status === "open" ? `<span class="status open">Needs opponent</span>`
    : g.status === "ready" ? `<span class="status ready">Upcoming</span>`
    : `<span class="status final">FT</span>`;
  return `
  <a class="card match" href="#/g/${g.id}">
    <div class="match-head">
      <span class="sport-tag">${cfg.icon} ${cfg.label} <b>${formatLabel(g)}</b></span>
      ${status}
    </div>
    <div class="scoreline">
      <span class="team ${w === "A" ? "win" : ""}">${avatar(g.teamA.captainId, "xs")}${esc(g.teamA.name)}</span>
      <span class="score">${g.status === "final"
        ? `<b class="${w === "A" ? "win" : ""}">${g.teamA.score}</b><i>–</i><b class="${w === "B" ? "win" : ""}">${g.teamB.score}</b>`
        : `<i class="vs">vs</i>`}</span>
      <span class="team right ${w === "B" ? "win" : ""}">${g.teamB ? `${esc(g.teamB.name)}${avatar(g.teamB.captainId, "xs")}` : `<em class="muted">Open spot</em>`}</span>
    </div>
    <div class="match-foot">
      ${top ? `<span class="potg">${avatar(top.playerId, "sm")}<span><small>Man of the match</small>${esc(uname(top.playerId))}</span>${badge(top.rating)}</span>`
        : `<span class="muted small">${esc(relDate(g.date))}${g.time ? " · " + fmtTime(g.time) : ""}${g.location ? " · " + esc(g.location) : ""}</span>`}
      ${top ? `<span class="muted small">${esc(relDate(g.date))}</span>` : ""}
    </div>
  </a>`;
}

function sportChips(active, attr) {
  const opts = [["all", "All", "🔥"], ...Object.entries(SPORTS).map(([k, v]) => [k, v.label, v.icon])];
  return `<div class="chips">${opts.map(([k, l, i]) => `<button class="chip ${active === k ? "on" : ""}" data-${attr}="${k}">${i} ${l}</button>`).join("")}</div>`;
}

function sparkline(values) {
  if (values.length < 2) return "";
  const w = 300, h = 70, pad = 8;
  const min = Math.min(5, ...values), max = Math.max(10, ...values);
  const x = (i) => pad + (i * (w - pad * 2)) / (values.length - 1);
  const y = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Rating trend">
    <line x1="0" x2="${w}" y1="${y(7).toFixed(1)}" y2="${y(7).toFixed(1)}" class="ref"/>
    <polyline points="${pts}" class="line"/>
    ${values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" class="dot ${ratingClass(v)}"/>`).join("")}</svg>`;
}

/* ============================================================
   Auth
   ============================================================ */

function viewAuth() {
  const shared = store.mode === "shared";
  const login = state.authTab === "login";
  const phoneMode = state.authTab === "phone";
  const social = `
      <div class="social">
        <button type="button" class="btn social-btn ${shared ? "" : "soon"}" id="google-btn">
          <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Continue with Google</button>
        <button type="button" class="btn social-btn ${shared ? "" : "soon"} ${phoneMode ? "on" : ""}" id="phone-btn">📱 Continue with phone</button>
      </div>
      ${shared ? "" : `<p class="muted small soon-note">Google and phone sign-in switch on once your league database is connected. In demo mode, use a username.</p>`}`;

  let form;
  if (phoneMode) {
    form = state.phone.sent
      ? `<form id="phone-form" class="stack">
           <p class="muted small">We texted a 6-digit code to <b>${esc(state.phone.number)}</b>.</p>
           <label>Code<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
           <button class="btn primary block big">Verify and log in</button>
           <button type="button" class="btn ghost small" id="phone-back">Use a different number</button>
         </form>`
      : `<form id="phone-form" class="stack">
           <label>Phone number<input name="phone" type="tel" autocomplete="tel" placeholder="+1 401 555 0123" required value="${esc(state.phone.number)}"></label>
           <button class="btn primary block big">Text me a code</button>
         </form>`;
  } else {
    form = `<form id="auth-form" class="stack">
        ${login
          ? `<label>${shared ? "Email" : "Username"}<input name="login" ${shared ? 'type="email"' : ""} autocomplete="username" required></label>
             <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
             <button class="btn primary block big">Log in</button>`
          : `${shared ? `<label>Email<input name="email" type="email" autocomplete="email" required></label>` : ""}
             <label>Username<input name="username" autocomplete="username" placeholder="e.g. jaybuckets" required pattern="[A-Za-z0-9_.]{3,20}"></label>
             <label>Display name<input name="displayName" placeholder="What the squad calls you" required></label>
             <label>Password<input name="password" type="password" autocomplete="new-password" minlength="6" required></label>
             <label class="file-label">Profile pic <span class="muted small">(optional, you can add it later)</span><input name="photo" type="file" accept="image/*"></label>
             <button class="btn primary block big">Create account</button>`}
      </form>`;
  }

  return `
  <div class="auth" style="--img:url('${IMG.ball}')">
    <div class="auth-panel">
      <img class="auth-logo" src="${IMG.icon}" alt="">
      <h1 class="wordmark">BALL UP TOP</h1>
      <p class="muted">Log the run. Rate your teammates. Find out who's really cooking.</p>
      ${social}
      <div class="or"><span>or ${shared ? "use email" : "use a username"}</span></div>
      <div class="tabs">
        <button class="${login ? "on" : ""}" data-tab="login">Log in</button>
        <button class="${state.authTab === "signup" ? "on" : ""}" data-tab="signup">Create account</button>
      </div>
      ${form}
      ${shared ? "" : `<p class="demo-note"><b>Demo mode.</b> Accounts live in this browser only. Try <code>marcus</code> / <code>demo123</code>, or create your own.</p>`}
    </div>
  </div>`;
}

function bindAuth() {
  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => { state.authTab = b.dataset.tab; render(); }));
  const afterLogin = async () => {
    await reload();
    location.hash = "#/";
    render();
    if (state.me && !state.me.needsSetup) toast(`Welcome, ${state.me.displayName}`);
  };
  // In shared mode this redirects to Google; in demo mode it explains why it's off.
  $("#google-btn").addEventListener("click", (e) => act(e.currentTarget, () => store.signInWithGoogle()));
  $("#phone-btn").addEventListener("click", () => {
    if (!store.supportsSocialLogin) return toast("Phone sign-in switches on once the league database is connected (see README).");
    state.authTab = "phone";
    render();
  });
  $("#phone-back")?.addEventListener("click", () => { state.phone.sent = false; render(); });
  $("#phone-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    act($("button", f), async () => {
      if (!state.phone.sent) {
        const num = f.phone.value.replace(/[^\d+]/g, "");
        if (!/^\+\d{8,15}$/.test(num)) throw new Error("Include your country code, e.g. +1 401 555 0123");
        await store.sendPhoneCode(num);
        state.phone = { number: num, sent: true };
        render();
        toast("Code sent");
      } else {
        await store.verifyPhoneCode(state.phone.number, f.code.value);
        state.phone = { number: "", sent: false };
        await afterLogin();
      }
    });
  });
  $("#auth-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    act($("button", f), async () => {
      if (state.authTab === "login") {
        await store.signIn({ login: f.login.value, password: f.password.value });
      } else {
        const u = await store.signUp({
          username: f.username.value, displayName: f.displayName.value, password: f.password.value, email: f.email?.value,
        });
        if (f.photo.files[0]) {
          try { await store.uploadAvatar(u.id, f.photo.files[0]); } catch (err) { toast(err.message); }
        }
      }
      await afterLogin();
    });
  });
}

/* First login with Google or phone: pick a username and add a photo. */
function viewSetup() {
  const u = state.me;
  return `
  <div class="auth" style="--img:url('${IMG.ball}')">
    <div class="auth-panel">
      <h1 class="wordmark sm">You're in.</h1>
      <p class="muted">Pick the name your squad will see.</p>
      <form id="setup-form" class="stack">
        <div class="setup-photo">${avatar(u.id, "xxl")}
          <label class="btn">📷 ${u.avatar ? "Change photo" : "Add a profile pic"}<input type="file" id="setup-photo" accept="image/*" hidden></label></div>
        <label>Username<input name="username" required pattern="[A-Za-z0-9_.]{3,20}" value="${esc(u.username)}" autocomplete="username"></label>
        <label>Display name<input name="displayName" required maxlength="30" value="${esc(u.displayName === "Player" ? "" : u.displayName)}" placeholder="What the squad calls you"></label>
        <button class="btn primary block big">Let's ball</button>
        <button type="button" class="btn ghost small" id="setup-out">Log out</button>
      </form>
    </div>
  </div>`;
}

function bindSetup() {
  $("#setup-photo").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) act(null, async () => { await store.uploadAvatar(meId(), file); await reload(); render(); });
  });
  $("#setup-out").addEventListener("click", async () => { await store.signOut(); await reload(); render(); });
  $("#setup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    act($("button", f), async () => {
      await store.completeSetup(meId(), { username: f.username.value, displayName: f.displayName.value });
      await reload();
      location.hash = "#/";
      render();
      toast(`Welcome, ${state.me.displayName}`);
    });
  });
}

/* ============================================================
   Feed
   ============================================================ */

function viewFeed() {
  const idx = ratingIndex();
  const friends = friendIds();
  const inScope = (g) => state.feedScope === "all" || gamePlayers(g).some((p) => p === meId() || friends.has(p)) || g.createdBy === meId();
  const games = state.games.filter((g) => (state.feedFilter === "all" || g.sport === state.feedFilter) && inScope(g));
  const open = state.games.filter((g) => g.status === "open" && (state.feedFilter === "all" || g.sport === state.feedFilter)).sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = games.filter((g) => g.status === "ready").sort((a, b) => a.date.localeCompare(b.date));
  const results = games.filter((g) => g.status === "final").sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const sum = playerSummary(meId());
  const pending = pendingGames();
  const requests = incomingRequests();

  // Highlights: the best individual performances in the games you can see.
  const highlights = [];
  for (const g of results.slice(0, 12)) {
    for (const pid of gamePlayers(g)) {
      const r = ratingFor(idx, g.id, pid);
      if (r != null && r >= 8) highlights.push({ g, pid, r, motm: motm(idx, g)?.playerId === pid });
    }
  }
  highlights.sort((a, b) => b.r - a.r);

  return `
  <section class="hero" style="--img:url('${IMG.hero}')">
    <div class="hero-inner">
      <span class="kicker">Pickup. Rated.</span>
      <h1>Who really<br>cooked tonight?</h1>
      <p>Start a run, let the other captain claim the other side, then rate your teammates after the final whistle.</p>
      <a class="btn primary big" href="#/new">＋ Start a game</a>
    </div>
  </section>

  <section class="card me-card">
    <a href="#/p/${meId()}" class="me-left">${avatar(meId(), "lg")}
      <div><small class="muted">Your overall</small><h2>${esc(state.me.displayName)}</h2>
      <span class="muted small">${sum.games.length} games · ${sum.wins}W ${sum.losses}L${sum.draws ? " " + sum.draws + "D" : ""} · ${sum.motms}× MOTM</span></div>
    </a>
    ${badge(sum.avg, "xl")}
    ${!state.me.avatar ? `<a class="nudge" href="#/p/${meId()}">📷 Add a profile pic so the squad knows who's who. <b>Add photo →</b></a>` : ""}
    ${pending.length ? `<a class="pending" href="#/g/${pending[0].id}">⏳ ${pending.length} game${pending.length > 1 ? "s" : ""} waiting on your ratings. <b>Rate now →</b></a>` : ""}
    ${requests.length ? `<a class="nudge" href="#/squad">👋 ${requests.length} friend request${requests.length > 1 ? "s" : ""}. <b>See ${requests.length > 1 ? "them" : "it"} →</b></a>` : ""}
  </section>

  ${highlights.length ? `
  <div class="section-head"><h3>Highlights</h3><span class="muted small">8.0+ performances</span></div>
  <div class="hl-strip">${highlights.slice(0, 10).map((h) => `
    <a class="hl" href="#/g/${h.g.id}">
      ${avatar(h.pid, "lg")}${badge(h.r)}
      <b>${esc(uname(h.pid).split(" ")[0])}</b>
      <small class="muted">${sportOf(h.g).icon} ${h.motm ? "MOTM · " : ""}${esc(relDate(h.g.date))}</small>
    </a>`).join("")}</div>` : ""}

  <div class="feed-controls">
    <div class="scope">
      <button class="${state.feedScope === "friends" ? "on" : ""}" data-scope="friends">Friends</button>
      <button class="${state.feedScope === "all" ? "on" : ""}" data-scope="all">Everyone</button>
    </div>
    ${sportChips(state.feedFilter, "feed")}
  </div>

  ${open.length ? `<div class="section-head"><h3>Open runs</h3><span class="muted small">Needs a second captain</span></div><div class="grid">${open.map((g) => gameCard(g, idx)).join("")}</div>` : ""}
  ${upcoming.length ? `<div class="section-head"><h3>Upcoming</h3></div><div class="grid">${upcoming.map((g) => gameCard(g, idx)).join("")}</div>` : ""}
  <div class="section-head"><h3>Results</h3></div>
  <div class="grid">${results.map((g) => gameCard(g, idx)).join("") ||
    `<div class="empty">${state.feedScope === "friends" ? `No games from you or your friends yet. <a href="#/squad">Add friends</a> or <a href="#/new">start a game</a>.` : `No results yet. <a href="#/new">Start a game.</a>`}</div>`}</div>`;
}

function bindFeed() {
  $$("[data-feed]").forEach((b) => b.addEventListener("click", () => { state.feedFilter = b.dataset.feed; render(); }));
  $$("[data-scope]").forEach((b) => b.addEventListener("click", () => { state.feedScope = b.dataset.scope; render(); }));
}

/* ============================================================
   Team editor (create game / claim other side / edit team)
   ============================================================ */

let editor = null; // { kind:'create'|'join'|'edit', gameId, side, game:{...}, team:{...}, selected }

function startEditor(kind, gameId) {
  if (kind === "create") {
    editor = {
      kind, side: "A", selected: null,
      game: { sport: "soccer", date: localDate(), time: "19:00", location: "", ref: null, refMode: "none", refName: "", refUser: "" },
      team: normalizeTeam({ captainId: meId(), name: `${state.me.displayName.split(" ")[0]}'s Squad`, playerIds: [meId()], formation: "", gk: false, slots: {}, positions: {}, score: null }, "soccer"),
    };
    return;
  }
  const g = state.games.find((x) => x.id === gameId);
  if (!g) { editor = null; return; }
  if (kind === "join") {
    editor = {
      kind, gameId, side: "B", selected: null, game: g,
      team: normalizeTeam({ captainId: meId(), name: `${state.me.displayName.split(" ")[0]}'s Squad`, playerIds: [meId()], formation: "", gk: false, slots: {}, positions: {}, score: null }, g.sport),
    };
  } else {
    const side = captainOf(g, meId());
    editor = { kind, gameId, side, selected: null, game: g, team: normalizeTeam(structuredClone(teamObj(g, side)), g.sport) };
  }
}

function viewEditor() {
  if (!editor) return `<div class="empty">Nothing to edit. <a href="#/">Back to feed</a></div>`;
  const { kind, team, game } = editor;
  const sport = game.sport;
  const cfg = SPORTS[sport];
  const other = kind === "create" ? null : teamObj(state.games.find((x) => x.id === editor.gameId), editor.side === "A" ? "B" : "A");
  const refUserId = kind === "create" ? (game.refMode === "user" ? game.refUser : null) : game.ref?.userId;
  const taken = new Set([...(other?.playerIds || []), ...(refUserId ? [refUserId] : [])]);
  const friends = friendIds();
  const rank = (u) => (u.id === team.captainId ? 0 : friends.has(u.id) ? 1 : 2);
  const pool = state.users.filter((u) => !taken.has(u.id)).sort((a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName));
  const title = kind === "create" ? "Start a game" : kind === "join" ? "Captain the other side" : "Edit your team";

  const gameFields =
    kind === "create"
      ? `
    <section class="card">
      <h3>The run</h3>
      <div class="segs">${Object.entries(SPORTS).map(([k, v]) => `<button type="button" class="seg ${sport === k ? "on" : ""}" data-sport="${k}">${v.icon}<span>${v.label}</span></button>`).join("")}</div>
      <div class="row3">
        <label>Date<input type="date" id="f-date" value="${esc(game.date)}" required></label>
        <label>Time<input type="time" id="f-time" value="${esc(game.time)}"></label>
        <label>Where<input id="f-loc" placeholder="Park, cage, gym…" value="${esc(game.location)}"></label>
      </div>
      <h4>Referee</h4>
      <div class="segs small">
        <button type="button" class="seg ${game.refMode === "none" ? "on" : ""}" data-refmode="none">No ref</button>
        <button type="button" class="seg ${game.refMode === "user" ? "on" : ""}" data-refmode="user">Someone on the app</button>
        <button type="button" class="seg ${game.refMode === "name" ? "on" : ""}" data-refmode="name">Just a name</button>
      </div>
      ${game.refMode === "user" ? `<select id="f-refuser"><option value="">Pick the ref…</option>${state.users.filter((u) => !team.playerIds.includes(u.id)).map((u) => `<option value="${u.id}" ${game.refUser === u.id ? "selected" : ""}>${esc(u.displayName)} (@${esc(u.username)})</option>`).join("")}</select>` : ""}
      ${game.refMode === "name" ? `<input id="f-refname" placeholder="Ref's name" value="${esc(game.refName)}">` : ""}
    </section>`
      : `
    <section class="card game-mini" style="--img:url('${cfg.img}')">
      <span class="sport-tag">${cfg.icon} ${cfg.label}</span>
      <h3>${esc(relDate(game.date))}${game.time ? " · " + fmtTime(game.time) : ""}${game.location ? " · " + esc(game.location) : ""}</h3>
      ${other ? `<p class="muted">Opponent: <b>${esc(other.name)}</b> (${other.playerIds.length} players, captain ${esc(uname(other.captainId))})</p>` : ""}
    </section>`;

  const formationBlock =
    sport === "soccer"
      ? `
    <section class="card">
      <div class="section-head tight"><h3>Formation</h3><span class="muted small">Tap two players to swap spots</span></div>
      <div class="formation-ctrl">
        <div class="chips">${formationOptions(team.playerIds.length - (team.gk ? 1 : 0)).map((f) => `<button type="button" class="chip ${team.formation === f ? "on" : ""}" data-form="${f}">${f}</button>`).join("")}</div>
        <div class="inline">
          <input id="f-custom" placeholder="Custom e.g. 3-2-1" value="" aria-label="Custom formation">
          ${team.playerIds.length >= 2 ? `<label class="toggle"><input type="checkbox" id="f-gk" ${team.gk ? "checked" : ""}> Keeper</label>` : ""}
        </div>
      </div>
      ${pitch(team, { editable: true, selected: editor.selected, side: editor.side })}
    </section>`
      : cfg.positions?.length
      ? `
    <section class="card">
      <h3>Positions</h3>
      ${team.playerIds.map((pid) => `<div class="pick-row">${avatar(pid, "sm")}<span class="grow">${esc(uname(pid))}</span>
        <select data-pos="${pid}"><option value="">–</option>${cfg.positions.map((p) => `<option ${team.positions[pid] === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>`).join("")}
    </section>`
      : "";

  return `
  <a class="back" href="${editor.gameId ? `#/g/${editor.gameId}` : "#/"}">← Back</a>
  <h1 class="page-title">${title}</h1>
  <p class="muted lead">${kind === "join" ? "You're the captain of this side. Pick your players and set the formation." : kind === "create" ? "You're captain of your side. Another player claims the other side to lock in the game. Teams don't need to be even." : "Captains can change their lineup until the final score is in."}</p>
  <form id="editor-form" class="stack">
    ${gameFields}
    <section class="card">
      <h3>Your team</h3>
      <label>Team name<input id="f-tname" value="${esc(team.name)}" required maxlength="30"></label>
      <div class="section-head tight"><h4>Players <span class="count">${team.playerIds.length}</span></h4><input id="f-search" class="search" placeholder="Search players"></div>
      <div class="roster-pick" id="pool">
        ${pool.map((u) => {
          const on = team.playerIds.includes(u.id);
          const isCap = u.id === team.captainId;
          return `<button type="button" class="pick ${on ? "on" : ""}" data-pick="${u.id}" data-name="${esc((u.displayName + " " + u.username).toLowerCase())}" ${isCap ? "disabled" : ""}>
            ${avatar(u.id, "sm")}<span>${esc(u.displayName)}${isCap ? " (C)" : ""}${friends.has(u.id) ? ' <em class="ftag">friend</em>' : ""}</span><i>${on ? "✓" : "+"}</i></button>`;
        }).join("")}
      </div>
    </section>
    ${formationBlock}
    <button class="btn primary block big" type="submit">${kind === "create" ? "Create game" : kind === "join" ? "Lock in the game" : "Save team"}</button>
  </form>`;
}

function captureEditor() {
  if (!editor) return;
  const v = (id) => $(id)?.value;
  if ($("#f-tname")) editor.team.name = v("#f-tname");
  if (editor.kind === "create") {
    if ($("#f-date")) editor.game.date = v("#f-date");
    if ($("#f-time")) editor.game.time = v("#f-time");
    if ($("#f-loc")) editor.game.location = v("#f-loc");
    if ($("#f-refuser")) editor.game.refUser = v("#f-refuser");
    if ($("#f-refname")) editor.game.refName = v("#f-refname");
  }
}

function rerenderEditor() {
  captureEditor();
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

function bindEditor() {
  if (!editor) return;
  const sport = editor.game.sport;
  $$("[data-sport]").forEach((b) => b.addEventListener("click", () => {
    captureEditor();
    editor.game.sport = b.dataset.sport;
    editor.team.formation = "";
    normalizeTeam(editor.team, editor.game.sport);
    rerenderEditor();
  }));
  $$("[data-refmode]").forEach((b) => b.addEventListener("click", () => { captureEditor(); editor.game.refMode = b.dataset.refmode; rerenderEditor(); }));
  $("#f-refuser")?.addEventListener("change", rerenderEditor);
  $$("[data-pick]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.pick;
    const t = editor.team;
    t.playerIds = t.playerIds.includes(id) ? t.playerIds.filter((x) => x !== id) : [...t.playerIds, id];
    if (sport === "soccer" && t.playerIds.length >= 3 && !t._gkTouched) t.gk = true;
    normalizeTeam(t, sport);
    editor.selected = null;
    rerenderEditor();
  }));
  $("#f-search")?.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$("#pool .pick").forEach((b) => (b.hidden = q && !b.dataset.name.includes(q)));
  });
  $$("[data-form]").forEach((b) => b.addEventListener("click", () => { editor.team.formation = b.dataset.form; normalizeTeam(editor.team, sport); rerenderEditor(); }));
  $("#f-custom")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = e.target.value.trim();
    const parts = val.split("-").map(Number);
    const need = editor.team.playerIds.length - (editor.team.gk ? 1 : 0);
    if (!/^\d+(-\d+)*$/.test(val) || parts.some((n) => n < 1) || parts.reduce((a, b) => a + b, 0) !== need) {
      return toast(`Formation has to add up to ${need} outfield player${need === 1 ? "" : "s"}`);
    }
    editor.team.formation = val;
    normalizeTeam(editor.team, sport);
    rerenderEditor();
  });
  $("#f-gk")?.addEventListener("change", (e) => {
    editor.team.gk = e.target.checked;
    editor.team._gkTouched = true;
    editor.team.formation = "";
    normalizeTeam(editor.team, sport);
    rerenderEditor();
  });
  $$("[data-slot]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.slot;
    if (!editor.selected) editor.selected = k;
    else if (editor.selected === k) editor.selected = null;
    else {
      const s = editor.team.slots;
      [s[editor.selected], s[k]] = [s[k], s[editor.selected]];
      editor.selected = null;
    }
    rerenderEditor();
  }));
  $$("[data-pos]").forEach((sel) => sel.addEventListener("change", () => { editor.team.positions[sel.dataset.pos] = sel.value; }));

  $("#editor-form").addEventListener("submit", (e) => {
    e.preventDefault();
    captureEditor();
    const t = { ...editor.team };
    delete t._gkTouched;
    t.name = (t.name || "").trim() || "My Squad";
    act($("button[type=submit]", e.target), async () => {
      let gid = editor.gameId;
      if (editor.kind === "create") {
        const g = editor.game;
        let ref = null;
        if (g.refMode === "user") {
          if (!g.refUser) throw new Error("Pick the ref, or choose No ref");
          ref = { userId: g.refUser, name: uname(g.refUser) };
        } else if (g.refMode === "name") {
          if (!g.refName.trim()) throw new Error("Type the ref's name, or choose No ref");
          ref = { userId: null, name: g.refName.trim() };
        }
        const created = await store.createGame({
          sport: g.sport, date: g.date, time: g.time, location: g.location.trim(),
          createdBy: meId(), status: "open", teamA: t, teamB: null, ref, stats: {},
        });
        gid = created.id;
        toast("Game created. Send the link to the other captain.");
      } else if (editor.kind === "join") {
        const fresh = (await store.listGames()).find((x) => x.id === gid);
        if (fresh?.teamB) throw new Error("Someone already claimed the other side.");
        if (t.playerIds.some((p) => fresh.teamA.playerIds.includes(p))) throw new Error("A player can't be on both teams.");
        await store.updateGame(gid, { teamB: t, status: "ready" });
        toast("Game on. Both sides are locked in.");
      } else {
        await store.updateGame(gid, editor.side === "A" ? { teamA: t } : { teamB: t });
        toast("Team saved");
      }
      editor = null;
      await reload();
      location.hash = `#/g/${gid}`;
    });
  });
}

/* ============================================================
   Game page
   ============================================================ */

function viewGame(id) {
  const g = state.games.find((x) => x.id === id);
  if (!g) return `<div class="empty">That game doesn't exist anymore. <a href="#/">Back to feed</a></div>`;
  const cfg = sportOf(g);
  const idx = g.status === "final" ? ratingIndex() : null;
  const top = idx ? motm(idx, g) : null;
  const w = winner(g);
  const myCap = captainOf(g, meId());
  const mySide = teamOf(g, meId());

  const sideBlock = (side) => {
    const t = teamObj(g, side);
    if (!t) {
      const canClaim = !mySide && g.ref?.userId !== meId();
      return `<section class="card open-side">
        <div class="ghost-team">?</div>
        <h3>Open spot</h3>
        <p class="muted">A game needs two captains. Whoever claims this side picks their players and sets their formation.</p>
        ${canClaim ? `<a class="btn primary" href="#/g/${g.id}/join">Captain this side</a>` : ""}
        ${myCap === "A" ? `<button class="btn" id="copy-link">Copy invite link</button>` : ""}
      </section>`;
    }
    return `<section class="card team-card">
      <div class="team-head"><h3>${esc(t.name)}</h3><span class="muted small">${t.playerIds.length} players · C: ${esc(uname(t.captainId))}</span>
      ${myCap === side && g.status !== "final" ? `<a class="btn ghost small" href="#/g/${g.id}/edit">Edit team</a>` : ""}</div>
      ${g.sport === "soccer" && t.formation != null ? pitch(t, { idx, gameId: g.id, side }) : ""}
      <div class="lineup">${lineupList(g, t, idx)}</div>
    </section>`;
  };

  let refBlock = "";
  if (g.ref) {
    const rr = idx ? ratingFor(idx, g.id, "ref") : null;
    const rv = idx ? votesFor(idx, g.id, "ref") : 0;
    const inner = `${g.ref.userId ? avatar(g.ref.userId) : `<span class="avatar whistle">🟨</span>`}
      <div class="grow"><small class="muted">Referee</small><b>${esc(g.ref.userId ? uname(g.ref.userId) : g.ref.name)}</b></div>
      ${idx ? `<div class="rcol">${badge(rr)}<small class="muted">${rv} vote${rv === 1 ? "" : "s"}</small></div>` : ""}`;
    refBlock = g.ref.userId ? `<a class="card ref-card" href="#/p/${g.ref.userId}">${inner}</a>` : `<div class="card ref-card">${inner}</div>`;
  }

  let actionBlock = "";
  if (g.status === "ready" && myCap) {
    actionBlock = `<section class="card cta"><div><h3>Game over?</h3><p class="muted">Either captain can post the final score and box score. That opens up ratings.</p></div><a class="btn primary" href="#/g/${g.id}/result">Enter final score</a></section>`;
  }

  let rateBlock = "";
  if (g.status === "final") {
    const targets = rateTargets(g, meId());
    if (!mySide) {
      rateBlock = `<section class="card"><h3>Ratings</h3><p class="muted">Only players in this game can rate. Players rate their own teammates and the ref, never the other team.</p></section>`;
    } else if (!targets.length) {
      rateBlock = `<section class="card"><h3>Ratings</h3><p class="muted">No teammates to rate in this one.</p></section>`;
    } else {
      rateBlock = `
      <section class="card">
        <h3>Rate your team${g.ref && g.ref.userId !== meId() ? " + the ref" : ""}</h3>
        <p class="muted small">You only rate your own side. Drag or tap − / + to fine-tune by 0.1. 6.0 is an average run, 7+ is solid, 8+ is cooking, 9+ means somebody got cooked.</p>
        <form id="rate-form" class="rate-list">
          ${targets.map(({ target }) => {
            const mine = state.ratings.find((r) => r.gameId === g.id && r.raterId === meId() && r.target === target);
            const v = mine ? mine.score : 6.5;
            const isRef = target === "ref";
            const name = isRef ? (g.ref.userId ? uname(g.ref.userId) : g.ref.name) : uname(target);
            const sub = isRef ? "Referee" : statLine(g.sport, g.stats?.[target]) || slotLabel(teamObj(g, mySide), target) || "";
            return `
            <div class="rate-row ${isRef ? "is-ref" : ""}">
              ${isRef ? (g.ref.userId ? avatar(g.ref.userId) : `<span class="avatar whistle">🟨</span>`) : avatar(target)}
              <div class="grow"><b>${esc(name)}</b><small class="muted">${esc(sub)}</small>
                <div class="slider-row">
                  <button type="button" class="nudge-btn" data-nudge="-0.1" data-t="${target}" aria-label="Lower ${esc(name)} by 0.1">−</button>
                  <input type="range" min="1" max="10" step="0.1" value="${v}" data-target="${target}" aria-label="Rating for ${esc(name)}">
                  <button type="button" class="nudge-btn" data-nudge="0.1" data-t="${target}" aria-label="Raise ${esc(name)} by 0.1">+</button>
                </div>
              </div>
              <span class="badge ${ratingClass(v)} live" data-for="${target}">${fmt(v)}</span>
            </div>`;
          }).join("")}
          <button class="btn primary block" type="submit">Save my ratings</button>
        </form>
      </section>`;
    }
  }

  return `
  <a class="back" href="#/">← Feed</a>
  <section class="scoreboard" style="--img:url('${cfg.img}')">
    <div class="sb-meta"><span class="sport-tag">${cfg.icon} ${cfg.label} <b>${formatLabel(g)}</b></span>
      <span>${esc(relDate(g.date))}${g.time ? " · " + fmtTime(g.time) : ""}${g.location ? " · " + esc(g.location) : ""}</span></div>
    <div class="big-score">
      <div class="side ${w === "A" ? "win" : ""}">${avatar(g.teamA.captainId, "lg")}<span>${esc(g.teamA.name)}</span></div>
      <div class="nums">${g.status === "final" ? `<b class="${w === "A" ? "win" : ""}">${g.teamA.score}</b><i>–</i><b class="${w === "B" ? "win" : ""}">${g.teamB.score}</b>` : `<i class="vs">VS</i>`}
        <small>${g.status === "final" ? (w === "D" ? "Draw" : "Full time") : g.status === "open" ? "Waiting for a captain" : "Upcoming"}</small></div>
      <div class="side ${w === "B" ? "win" : ""}">${g.teamB ? `${avatar(g.teamB.captainId, "lg")}<span>${esc(g.teamB.name)}</span>` : `<span class="avatar lg ghost">?</span><span class="muted">Open</span>`}</div>
    </div>
  </section>

  ${top ? `
  <section class="motm-banner" style="--img:url('${IMG.motm}')">
    ${avatar(top.playerId, "xl")}
    <div class="grow"><span class="kicker gold">★ Man of the match</span><h2>${esc(uname(top.playerId))}</h2>
    <span class="small">${esc(teamObj(g, teamOf(g, top.playerId)).name)}${statLine(g.sport, g.stats?.[top.playerId]) ? " · " + esc(statLine(g.sport, g.stats[top.playerId])) : ""}</span></div>
    ${badge(top.rating, "xxl")}
  </section>` : ""}

  ${actionBlock}
  ${rateBlock}
  <div class="two-col">${sideBlock("A")}${sideBlock("B")}</div>
  ${refBlock}
  ${g.status === "final" && myCap ? `<div class="center"><a class="btn ghost small" href="#/g/${g.id}/result">Fix score or stats</a></div>` : ""}
  ${g.createdBy === meId() ? `<div class="center"><button class="btn ghost danger small" id="del-game">Delete game</button></div>` : ""}`;
}

function bindGame(id) {
  $("#copy-link")?.addEventListener("click", async () => {
    const url = location.href.replace(/#.*/, "") + `#/g/${id}`;
    try { await navigator.clipboard.writeText(url); toast("Invite link copied"); } catch (_) { prompt("Copy this link:", url); }
  });
  const form = $("#rate-form");
  if (form) {
    $$('input[type="range"]', form).forEach((inp) => inp.addEventListener("input", () => {
      const b = $(`[data-for="${inp.dataset.target}"]`, form);
      const v = Number(inp.value);
      b.textContent = fmt(v);
      b.className = `badge ${ratingClass(v)} live`;
    }));
    $$("[data-nudge]", form).forEach((btn) => btn.addEventListener("click", () => {
      const inp = $(`input[data-target="${btn.dataset.t}"]`, form);
      const v = Math.min(10, Math.max(1, Math.round((Number(inp.value) + Number(btn.dataset.nudge)) * 10) / 10));
      inp.value = v;
      inp.dispatchEvent(new Event("input"));
    }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const g = state.games.find((x) => x.id === id);
      const allowed = new Set(rateTargets(g, meId()).map((t) => t.target));
      act($("button[type=submit]", form), async () => {
        const list = $$('input[type="range"]', form)
          .filter((i) => allowed.has(i.dataset.target))
          .map((i) => ({ gameId: id, raterId: meId(), target: i.dataset.target, score: Math.round(Number(i.value) * 10) / 10 }));
        await store.upsertRatings(list);
        await reload();
        render();
        toast("Ratings saved");
      });
    });
  }
  $("#del-game")?.addEventListener("click", (e) => {
    if (!confirm("Delete this game and all its ratings?")) return;
    act(e.target, async () => { await store.deleteGame(id); await reload(); location.hash = "#/"; toast("Game deleted"); });
  });
}

/* ============================================================
   Final score + box score
   ============================================================ */

function viewResult(id) {
  const g = state.games.find((x) => x.id === id);
  if (!g || !g.teamB) return `<div class="empty">This game isn't ready for a score yet. <a href="#/g/${id}">Back</a></div>`;
  if (!captainOf(g, meId())) return `<div class="empty">Only the two captains can post the score. <a href="#/g/${id}">Back</a></div>`;
  const cfg = sportOf(g);
  const table = (t) => `
    <h4 class="team-sub">${esc(t.name)}</h4>
    <div class="table-wrap"><table class="box">
      <thead><tr><th>Player</th>${cfg.stats.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead>
      <tbody>${t.playerIds.map((pid) => `<tr><td><span class="pcell">${avatar(pid, "xs")}${esc(uname(pid))}</span></td>${cfg.stats
        .map(([k]) => `<td><input type="number" min="0" inputmode="numeric" data-stat="${k}" data-pid="${pid}" value="${esc(g.stats?.[pid]?.[k] ?? "")}" placeholder="0" aria-label="${esc(uname(pid))} ${k}"></td>`)
        .join("")}</tr>`).join("")}</tbody>
    </table></div>`;
  return `
  <a class="back" href="#/g/${id}">← Game</a>
  <h1 class="page-title">Final score</h1>
  <form id="result-form" class="stack">
    <section class="card">
      <div class="score-input">
        <span class="tname">${esc(g.teamA.name)}</span>
        <input class="tscore" name="a" type="number" min="0" inputmode="numeric" required value="${g.teamA.score ?? ""}" placeholder="0" aria-label="${esc(g.teamA.name)} score">
        <i>–</i>
        <input class="tscore" name="b" type="number" min="0" inputmode="numeric" required value="${g.teamB.score ?? ""}" placeholder="0" aria-label="${esc(g.teamB.name)} score">
        <span class="tname right">${esc(g.teamB.name)}</span>
      </div>
    </section>
    <section class="card"><h3>Box score <span class="muted small">(optional)</span></h3>${table(g.teamA)}${table(g.teamB)}</section>
    <button class="btn primary block big">${g.status === "final" ? "Save changes" : "Blow the whistle"}</button>
  </form>`;
}

function bindResult(id) {
  $("#result-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const g = state.games.find((x) => x.id === id);
    const stats = {};
    $$("[data-stat]", f).forEach((i) => {
      const v = Number(i.value);
      if (v > 0) (stats[i.dataset.pid] ??= {})[i.dataset.stat] = v;
    });
    act($("button", f), async () => {
      await store.updateGame(id, {
        status: "final", stats,
        teamA: { ...g.teamA, score: Number(f.a.value) || 0 },
        teamB: { ...g.teamB, score: Number(f.b.value) || 0 },
      });
      await reload();
      location.hash = `#/g/${id}`;
      toast("Full time. Ratings are open.");
    });
  });
}

/* ============================================================
   Squad & profiles
   ============================================================ */

function playerCard(u, s) {
  return `
    <div class="card pcard" data-name="${esc((u.displayName + " " + u.username).toLowerCase())}">
      <a class="pc-link" href="#/p/${u.id}">
        ${avatar(u.id, "lg")}
        <div class="grow"><b>${esc(u.displayName)}${u.id === meId() ? ' <em class="ftag">you</em>' : ""}</b><small class="muted">@${esc(u.username)} · ${s.games.length} games · ${s.motms}× MOTM</small>
        <div class="form">${s.games.slice(0, 5).reverse().map((x) => `<span class="fdot ${ratingClass(x.rating)}" title="${fmt(x.rating)}"></span>`).join("")}</div></div>
        ${badge(s.avg, "lg")}
      </a>
      ${u.id !== meId() ? `<div class="pc-actions">${friendButton(u.id, "small")}</div>` : ""}
    </div>`;
}

function viewSquad() {
  const friends = friendIds();
  const requests = incomingRequests();
  const tab = state.squadTab === "requests" && !requests.length ? "friends" : state.squadTab;
  let list = state.users;
  if (tab === "friends") list = state.users.filter((u) => friends.has(u.id) || u.id === meId());
  if (tab === "requests") list = requests.map((f) => user(f.from)).filter(Boolean);
  const rows = list
    .map((u) => ({ u, s: playerSummary(u.id) }))
    .sort((a, b) => (b.s.avg ?? -1) - (a.s.avg ?? -1) || b.s.games.length - a.s.games.length);
  const outgoing = state.friendships.filter((f) => f.status === "pending" && f.from === meId());
  return `
  <h1 class="page-title">The squad</h1>
  <div class="scope wide">
    <button class="${tab === "friends" ? "on" : ""}" data-sq="friends">Friends <span class="count">${friends.size}</span></button>
    ${requests.length ? `<button class="${tab === "requests" ? "on" : ""}" data-sq="requests">Requests <span class="count red">${requests.length}</span></button>` : ""}
    <button class="${tab === "everyone" ? "on" : ""}" data-sq="everyone">Find players</button>
  </div>
  <input class="search block" id="sq-search" placeholder="${tab === "everyone" ? "Search by name or @username" : "Search"}">
  ${tab === "friends" && friends.size === 0 ? `<div class="empty">No friends yet. Tap <b>Find players</b> to add the people you run with.</div>` : ""}
  <div class="grid players">${rows.map(({ u, s }) => playerCard(u, s)).join("")}</div>
  ${tab === "friends" && outgoing.length ? `<p class="muted small center">Waiting on ${outgoing.length} request${outgoing.length > 1 ? "s" : ""} you sent.</p>` : ""}`;
}

function bindSquad() {
  $$("[data-sq]").forEach((b) => b.addEventListener("click", () => { state.squadTab = b.dataset.sq; render(); }));
  $("#sq-search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase().replace(/^@/, "");
    $$(".pcard").forEach((c) => (c.hidden = q && !c.dataset.name.includes(q)));
  });
  bindFriendButtons($("#main"));
}

function viewProfile(id) {
  const u = user(id);
  if (!u) return `<div class="empty">Player not found. <a href="#/squad">See the squad</a></div>`;
  const s = playerSummary(id);
  const mine = id === meId();
  const trend = s.games.filter((x) => x.rating != null).map((x) => x.rating).reverse();
  const theirFriends = state.friendships
    .filter((f) => f.status === "accepted" && (f.from === id || f.to === id))
    .map((f) => (f.from === id ? f.to : f.from));
  const comingUp = state.games
    .filter((g) => g.status !== "final" && (gamePlayers(g).includes(id) || g.ref?.userId === id))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  let together = null;
  if (!mine) {
    const shared = state.games.filter((g) => g.status === "final" && teamOf(g, id) && teamOf(g, meId()));
    together = { total: shared.length, same: shared.filter((g) => teamOf(g, id) === teamOf(g, meId())).length };
  }
  const sportRows = Object.entries(s.bySport).map(([sp, d]) => {
    const cfg = SPORTS[sp] || SPORTS.other;
    return `<div class="sport-block">
      <div class="sb-head"><span>${cfg.icon} ${cfg.label}</span><span class="muted small">${d.games} games</span>${badge(avg(d.ratings))}</div>
      <div class="statgrid">${cfg.stats.map(([k, l]) => `<div><b>${fmt((d.totals[k] || 0) / d.games)}</b><small>${l}/G</small></div>`).join("")}</div>
    </div>`;
  }).join("");

  return `
  <a class="back" href="#/squad">← Squad</a>
  <section class="profile-head" style="--img:url('${IMG.hero}')">
    <div class="ph-avatar">${avatar(id, "xxl")}
      ${mine ? `<label class="photo-btn" title="Change profile pic">📷<input type="file" id="avatar-file" accept="image/*" hidden></label>` : ""}</div>
    <div class="grow">
      <h1>${esc(u.displayName)}</h1>
      <div class="muted">@${esc(u.username)}${together && together.total ? ` · You've played ${together.total} game${together.total > 1 ? "s" : ""} together (${together.same} as teammates)` : ""}</div>
      ${mine ? "" : `<div class="ph-actions">${friendButton(id)}</div>`}
      <div class="ph-stats">
        <div><b>${s.games.length}</b><small>Games</small></div>
        <div><b>${s.wins}-${s.losses}${s.draws ? "-" + s.draws : ""}</b><small>W-L${s.draws ? "-D" : ""}</small></div>
        <div><b>${s.motms}</b><small>MOTM</small></div>
        <div><b>${theirFriends.length}</b><small>Friends</small></div>
        ${s.reffed ? `<div><b>${fmt(s.refAvg)}</b><small>Ref rating (${s.reffed})</small></div>` : ""}
      </div>
    </div>
    <div class="ovr">${badge(s.avg, "xxl")}<small>Overall</small></div>
  </section>

  ${mine ? `
  <section class="card">
    <h3>Your account</h3>
    <div class="photo-row">${avatar(id, "lg")}
      <label class="btn">📷 ${u.avatar ? "Change profile pic" : "Upload a profile pic"}<input type="file" id="avatar-file-2" accept="image/*" hidden></label>
      <span class="muted small">Square crop, any photo from your phone works.</span></div>
    <form id="profile-form" class="inline">
      <input id="p-name" value="${esc(u.displayName)}" maxlength="30" aria-label="Display name">
      <button class="btn">Save name</button>
      <button type="button" class="btn ghost danger" id="signout">Log out</button>
    </form>
  </section>` : ""}

  <div class="two-col">
    <section class="card">
      <h3>Form</h3>
      <div class="form-strip">${s.games.slice(0, 5).reverse().map((x) => `<a href="#/g/${x.g.id}" title="${esc(relDate(x.g.date))}">${badge(x.rating)}<small class="res ${x.res}">${x.res}</small></a>`).join("") || `<span class="muted">No games yet</span>`}</div>
      ${trend.length > 1 ? `<h4 class="mt">Rating trend</h4>${sparkline(trend)}` : ""}
    </section>
    <section class="card">
      <h3>Best game</h3>
      ${s.best ? `<a class="best" href="#/g/${s.best.g.id}">${badge(s.best.rating, "xl")}<div><b>${sportOf(s.best.g).icon} ${esc(s.best.g.teamA.name)} ${s.best.g.teamA.score}–${s.best.g.teamB.score} ${esc(s.best.g.teamB.name)}</b>
        <small class="muted">${esc(relDate(s.best.g.date))}${statLine(s.best.g.sport, s.best.stats) ? " · " + esc(statLine(s.best.g.sport, s.best.stats)) : ""}</small></div></a>` : `<p class="muted">Needs a rated game first.</p>`}
    </section>
  </div>
  ${sportRows ? `<section class="card"><h3>By sport</h3>${sportRows}</section>` : ""}
  ${comingUp.length ? `
  <section class="card">
    <h3>Coming up</h3>
    ${comingUp.map((g) => `
      <a class="log-row" href="#/g/${g.id}">
        <span class="res-pill up">${sportOf(g).icon}</span>
        <div class="grow"><b>${esc(g.teamA.name)} vs ${g.teamB ? esc(g.teamB.name) : "open spot"}</b>
        <small class="muted">${esc(relDate(g.date))}${g.time ? " · " + fmtTime(g.time) : ""}${g.location ? " · " + esc(g.location) : ""}${g.ref?.userId === id ? " · Reffing" : captainOf(g, id) ? " · Captain" : ""}</small></div>
        <span class="status ${g.status}">${g.status === "open" ? "Needs opponent" : "Upcoming"}</span>
      </a>`).join("")}
  </section>` : ""}
  ${theirFriends.length ? `
  <section class="card">
    <h3>Friends</h3>
    <div class="friend-row">${theirFriends.slice(0, 24).map((f) => `<a href="#/p/${f}" title="${esc(uname(f))}">${avatar(f)}<small>${esc(uname(f).split(" ")[0])}</small></a>`).join("")}</div>
  </section>` : ""}
  <section class="card">
    <h3>Past games <span class="muted small">${s.games.length}</span></h3>
    ${s.games.map((x) => `
      <a class="log-row" href="#/g/${x.g.id}">
        <span class="res-pill ${x.res}">${x.res}</span>
        <div class="grow"><b>${sportOf(x.g).icon} ${esc(x.g.teamA.name)} ${x.g.teamA.score}–${x.g.teamB.score} ${esc(x.g.teamB.name)}</b>
        <small class="muted">${esc(relDate(x.g.date))} · ${formatLabel(x.g)}${x.captain ? " · Captain" : ""}${statLine(x.g.sport, x.stats) ? " · " + esc(statLine(x.g.sport, x.stats)) : ""}</small></div>
        ${x.motm ? '<span class="motm-inline">MOTM</span>' : ""}${badge(x.rating)}
      </a>`).join("") || `<p class="muted">No finished games yet.</p>`}
  </section>`;
}

function bindProfile(id) {
  bindFriendButtons($("#main"));
  const uploadPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    act(null, async () => {
      await store.uploadAvatar(id, file);
      await reload();
      render();
      toast("Looking good");
    });
  };
  $("#avatar-file")?.addEventListener("change", uploadPhoto);
  $("#avatar-file-2")?.addEventListener("change", uploadPhoto);
  $("#profile-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    act(null, async () => {
      await store.updateProfile(id, { displayName: $("#p-name").value });
      await reload();
      render();
      toast("Saved");
    });
  });
  $("#signout")?.addEventListener("click", async () => {
    await store.signOut();
    await reload();
    location.hash = "#/";
    render();
  });
}

/* ============================================================
   Leaderboard
   ============================================================ */

function viewLeaders() {
  const sport = state.leadersSport;
  const cfg = sport === "all" ? null : SPORTS[sport];
  const rows = state.users
    .map((u) => {
      const s = playerSummary(u.id, sport);
      const d = cfg && s.bySport[sport];
      return { u, s, key: d ? (d.totals[cfg.key] || 0) / d.games : null };
    })
    .filter((r) => r.s.games.length)
    .sort((a, b) => (b.s.avg ?? -1) - (a.s.avg ?? -1) || b.s.motms - a.s.motms);
  const refs = state.users
    .map((u) => ({ u, s: playerSummary(u.id) }))
    .filter((r) => r.s.reffed)
    .sort((a, b) => (b.s.refAvg ?? -1) - (a.s.refAvg ?? -1));

  return `
  <h1 class="page-title">Leaderboard</h1>
  ${sportChips(sport, "lsport")}
  <section class="card flush">
    <div class="table-wrap"><table class="leaders">
      <thead><tr><th>#</th><th>Player</th><th>GP</th><th>W-L</th><th>MOTM</th>${cfg ? `<th>${cfg.keyLabel}</th>` : ""}<th>Rating</th></tr></thead>
      <tbody>${rows.map((r, i) => `
        <tr data-href="#/p/${r.u.id}" class="${r.u.id === meId() ? "me" : ""}">
          <td class="rank r${i + 1}">${i + 1}</td>
          <td><span class="pcell">${avatar(r.u.id, "sm")}${esc(r.u.displayName)}</span></td>
          <td>${r.s.games.length}</td><td>${r.s.wins}-${r.s.losses}</td><td>${r.s.motms}</td>
          ${cfg ? `<td>${fmt(r.key)}</td>` : ""}
          <td>${badge(r.s.avg)}</td>
        </tr>`).join("") || `<tr><td colspan="7" class="muted center pad">No finished games in this sport yet.</td></tr>`}</tbody>
    </table></div>
  </section>
  ${refs.length ? `
  <div class="section-head"><h3>🟨 Refs</h3><span class="muted small">Rated by the players</span></div>
  <section class="card flush"><div class="table-wrap"><table class="leaders">
    <thead><tr><th>Ref</th><th>Games</th><th>Rating</th></tr></thead>
    <tbody>${refs.map((r) => `<tr data-href="#/p/${r.u.id}"><td><span class="pcell">${avatar(r.u.id, "sm")}${esc(r.u.displayName)}</span></td><td>${r.s.reffed}</td><td>${badge(r.s.refAvg)}</td></tr>`).join("")}</tbody>
  </table></div></section>` : ""}
  <p class="muted small center">Ratings come from teammates only. Nobody rates the other team.</p>`;
}

function bindLeaders() {
  $$("[data-lsport]").forEach((b) => b.addEventListener("click", () => { state.leadersSport = b.dataset.lsport; render(); }));
  $$("tr[data-href]").forEach((tr) => tr.addEventListener("click", () => (location.hash = tr.dataset.href)));
}

/* ============================================================
   Router
   ============================================================ */

let lastKey = null;

function render() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [, route, param, sub] = hash.split("/");
  const main = $("#main");
  document.body.classList.toggle("signed-out", !state.me);

  if (!state.me) {
    main.innerHTML = viewAuth();
    bindAuth();
    return;
  }
  if (state.me.needsSetup) {
    document.body.classList.add("signed-out");
    main.innerHTML = viewSetup();
    bindSetup();
    return;
  }

  // (Re)start the team editor when entering an editor route.
  const editorKey = route === "new" ? "new" : route === "g" && (sub === "join" || sub === "edit") ? `${param}/${sub}` : null;
  if (editorKey && editorKey !== lastKey) startEditor(route === "new" ? "create" : sub, param);
  lastKey = editorKey;

  let html, bind;
  if (route === "new") [html, bind] = [viewEditor(), bindEditor];
  else if (route === "g" && (sub === "join" || sub === "edit")) [html, bind] = [viewEditor(), bindEditor];
  else if (route === "g" && sub === "result") [html, bind] = [viewResult(param), () => bindResult(param)];
  else if (route === "g") [html, bind] = [viewGame(param), () => bindGame(param)];
  else if (route === "squad") [html, bind] = [viewSquad(), bindSquad];
  else if (route === "p") [html, bind] = [viewProfile(param), () => bindProfile(param)];
  else if (route === "leaders") [html, bind] = [viewLeaders(), bindLeaders];
  else [html, bind] = [viewFeed(), bindFeed];

  main.innerHTML = html;
  bind();

  $$(".nav a").forEach((a) => {
    const r = a.getAttribute("href").split("/")[1] || "";
    a.classList.toggle("active", r === (route || "") || (r === "squad" && route === "p" && param !== meId()) || (r === "p" && route === "p" && param === meId()));
  });
  $("#nav-me").setAttribute("href", `#/p/${meId()}`);
  $("#nav-me-avatar").innerHTML = avatar(meId(), "xs");
  const pending = pendingGames().length;
  $("#rate-dot").hidden = !pending;
  $("#rate-dot").textContent = pending;
  const reqs = incomingRequests().length;
  $("#squad-dot").hidden = !reqs;
  $("#squad-dot").textContent = reqs;
}

let prevRoute = null;
window.addEventListener("hashchange", () => {
  const r = location.hash.split("/").slice(0, 3).join("/");
  if (r !== prevRoute) window.scrollTo(0, 0);
  prevRoute = r;
  render();
});

(async function boot() {
  $("#brand-icon").src = IMG.icon;
  $("#brand-icon").onerror = (e) => (e.target.style.visibility = "hidden");
  $("link[rel=icon]").href = IMG.icon;
  try {
    await store.init();
    await reload();
  } catch (err) {
    $("#main").innerHTML = `<div class="empty">Couldn't connect to the league database.<br><small class="muted">${esc(err.message)}</small></div>`;
    return;
  }
  render();
})();
