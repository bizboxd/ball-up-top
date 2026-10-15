// Data layer with two interchangeable backends sharing one async API:
//   - LocalStore    : demo mode, everything in this browser's localStorage
//   - SupabaseStore : real accounts (Supabase Auth), shared database + avatar storage
//
// Shapes used by the app
//   user   { id, username, displayName, avatar, color }
//   team   { captainId, name, playerIds:[], formation:"2-3-1", gk:true,
//            slots:{ slotKey: playerId }, positions:{ playerId: "PG" }, score:null|number }
//   game   { id, sport, date, time, location, createdBy, createdAt,
//            status:"open"|"ready"|"final", teamA:team, teamB:team|null,
//            ref:{ userId:string|null, name:string }|null, stats:{ playerId:{...} } }
//   rating { id, gameId, raterId, target: playerId | "ref", score, note }

const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

const PALETTE = ["#c6ff3d", "#38bdf8", "#f97316", "#a78bfa", "#f472b6", "#facc15", "#2dd4bf", "#fb7185", "#818cf8", "#4ade80"];
export const colorFor = (i) => PALETTE[i % PALETTE.length];

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Shrink an uploaded photo to a square JPEG so it's light to store and fast to load.
export async function squareImage(file, size = 384) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("That file isn't an image we can read."));
      i.src = url;
    });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    c.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    return { blob, dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const publicUser = (u) => ({ id: u.id, username: u.username, displayName: u.displayName, avatar: u.avatar || null, color: u.color });

/* =====================================================================
   Local (demo) store
   ===================================================================== */

const KEY = "ballUpTop.v2";
const SESSION_KEY = "ballUpTop.session";

class LocalStore {
  constructor() {
    this.mode = "local";
    this.db = null;
  }
  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.db));
    } catch (e) {
      throw new Error("Browser storage is full. Try a smaller profile photo.");
    }
  }
  async init() {
    try { this.db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
    if (!this.db || this.db.version !== 2) {
      this.db = await seedData();
      this.#save();
    }
  }

  /* auth */
  async currentUser() {
    let id = null;
    try { id = localStorage.getItem(SESSION_KEY); } catch (_) {}
    const u = this.db.users.find((x) => x.id === id);
    return u ? publicUser(u) : null;
  }
  async signUp({ username, displayName, password }) {
    username = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) throw new Error("Username: 3–20 letters, numbers, _ or .");
    if (password.length < 6) throw new Error("Password needs at least 6 characters.");
    if (this.db.users.some((u) => u.username === username)) throw new Error("That username is taken.");
    const salt = uid();
    const u = {
      id: uid(), username, displayName: displayName.trim() || username, salt,
      passHash: await sha256(salt + password), avatar: null,
      color: colorFor(this.db.users.length), createdAt: new Date().toISOString(),
    };
    this.db.users.push(u);
    this.#save();
    try { localStorage.setItem(SESSION_KEY, u.id); } catch (_) {}
    return publicUser(u);
  }
  async signIn({ login, password }) {
    const u = this.db.users.find((x) => x.username === login.trim().toLowerCase());
    if (!u || (await sha256(u.salt + password)) !== u.passHash) throw new Error("Wrong username or password.");
    try { localStorage.setItem(SESSION_KEY, u.id); } catch (_) {}
    return publicUser(u);
  }
  async signOut() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  /* users */
  async listUsers() { return this.db.users.map(publicUser); }
  async updateProfile(id, patch) {
    const u = this.db.users.find((x) => x.id === id);
    if (patch.displayName != null) u.displayName = patch.displayName.trim() || u.username;
    this.#save();
  }
  async uploadAvatar(id, file) {
    const { dataUrl } = await squareImage(file, 256);
    const u = this.db.users.find((x) => x.id === id);
    const prev = u.avatar;
    u.avatar = dataUrl;
    try { this.#save(); } catch (e) { u.avatar = prev; throw e; }
    return dataUrl;
  }

  /* games */
  async listGames() { return structuredClone(this.db.games); }
  async createGame(g) {
    const game = { ...structuredClone(g), id: uid(), createdAt: new Date().toISOString() };
    this.db.games.push(game);
    this.#save();
    return game;
  }
  async updateGame(id, patch) {
    const g = this.db.games.find((x) => x.id === id);
    if (!g) throw new Error("Game not found.");
    Object.assign(g, structuredClone(patch));
    this.#save();
    return structuredClone(g);
  }
  async deleteGame(id) {
    this.db.games = this.db.games.filter((g) => g.id !== id);
    this.db.ratings = this.db.ratings.filter((r) => r.gameId !== id);
    this.#save();
  }

  /* ratings */
  async listRatings() { return structuredClone(this.db.ratings); }
  async upsertRatings(list) {
    for (const { gameId, raterId, target, score, note = "" } of list) {
      const ex = this.db.ratings.find((r) => r.gameId === gameId && r.raterId === raterId && r.target === target);
      if (ex) Object.assign(ex, { score, note });
      else this.db.ratings.push({ id: uid(), gameId, raterId, target, score, note });
    }
    this.#save();
  }

  /* demo-only helpers */
  async reset(withDemo) {
    this.db = withDemo ? await seedData() : { version: 2, users: [], games: [], ratings: [] };
    this.#save();
    await this.signOut();
  }
}

/* =====================================================================
   Supabase store (real accounts)
   ===================================================================== */

class SupabaseStore {
  constructor(url, key) {
    this.mode = "shared";
    this.url = url;
    this.key = key;
  }
  async init() {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    this.sb = createClient(this.url, this.key);
  }
  #ok({ data, error }) {
    if (error) throw new Error(error.message);
    return data;
  }
  #user(r) {
    return { id: r.id, username: r.username, displayName: r.display_name, avatar: r.avatar_url, color: r.color };
  }
  #game(r) {
    return {
      id: r.id, sport: r.sport, date: r.played_on, time: r.kickoff || "", location: r.location || "",
      createdBy: r.created_by, createdAt: r.created_at, status: r.status,
      teamA: r.team_a, teamB: r.team_b, ref: r.ref, stats: r.stats || {},
    };
  }

  /* auth */
  async currentUser() {
    const { data } = await this.sb.auth.getUser();
    if (!data?.user) return null;
    const rows = this.#ok(await this.sb.from("profiles").select("*").eq("id", data.user.id));
    if (rows[0]) return this.#user(rows[0]);
    // Profile row missing (e.g. email confirmation flow) – create it from signup metadata.
    const meta = data.user.user_metadata || {};
    const count = (await this.listUsers()).length;
    const row = this.#ok(
      await this.sb.from("profiles").insert({
        id: data.user.id,
        username: meta.username || data.user.email.split("@")[0],
        display_name: meta.display_name || meta.username || "Player",
        color: colorFor(count),
      }).select().single()
    );
    return this.#user(row);
  }
  async signUp({ username, displayName, password, email }) {
    username = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) throw new Error("Username: 3–20 letters, numbers, _ or .");
    const taken = this.#ok(await this.sb.from("profiles").select("id").eq("username", username));
    if (taken.length) throw new Error("That username is taken.");
    const res = this.#ok(
      await this.sb.auth.signUp({
        email: email.trim(), password,
        options: { data: { username, display_name: displayName.trim() || username } },
      })
    );
    if (!res.session) throw new Error("Check your email to confirm your account, then log in.");
    return this.currentUser();
  }
  async signIn({ login, password }) {
    this.#ok(await this.sb.auth.signInWithPassword({ email: login.trim(), password }));
    return this.currentUser();
  }
  async signOut() { await this.sb.auth.signOut(); }

  /* users */
  async listUsers() {
    return this.#ok(await this.sb.from("profiles").select("*").order("created_at")).map((r) => this.#user(r));
  }
  async updateProfile(id, patch) {
    this.#ok(await this.sb.from("profiles").update({ display_name: patch.displayName }).eq("id", id));
  }
  async uploadAvatar(id, file) {
    const { blob } = await squareImage(file, 384);
    const path = `${id}/${Date.now()}.jpg`;
    this.#ok(await this.sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true }));
    const url = this.sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    this.#ok(await this.sb.from("profiles").update({ avatar_url: url }).eq("id", id));
    return url;
  }

  /* games */
  async listGames() {
    return this.#ok(await this.sb.from("games").select("*").order("played_on", { ascending: false })).map((r) => this.#game(r));
  }
  #row(g) {
    const out = {};
    if ("sport" in g) out.sport = g.sport;
    if ("date" in g) out.played_on = g.date;
    if ("time" in g) out.kickoff = g.time || null;
    if ("location" in g) out.location = g.location;
    if ("createdBy" in g) out.created_by = g.createdBy;
    if ("status" in g) out.status = g.status;
    if ("teamA" in g) out.team_a = g.teamA;
    if ("teamB" in g) out.team_b = g.teamB;
    if ("ref" in g) out.ref = g.ref;
    if ("stats" in g) out.stats = g.stats;
    return out;
  }
  async createGame(g) {
    return this.#game(this.#ok(await this.sb.from("games").insert(this.#row(g)).select().single()));
  }
  async updateGame(id, patch) {
    return this.#game(this.#ok(await this.sb.from("games").update(this.#row(patch)).eq("id", id).select().single()));
  }
  async deleteGame(id) { this.#ok(await this.sb.from("games").delete().eq("id", id)); }

  /* ratings */
  async listRatings() {
    return this.#ok(await this.sb.from("ratings").select("*")).map((r) => ({
      id: r.id, gameId: r.game_id, raterId: r.rater_id, target: r.target, score: Number(r.score), note: r.note || "",
    }));
  }
  async upsertRatings(list) {
    if (!list.length) return;
    this.#ok(
      await this.sb.from("ratings").upsert(
        list.map((r) => ({ game_id: r.gameId, rater_id: r.raterId, target: r.target, score: r.score, note: r.note || "" })),
        { onConflict: "game_id,rater_id,target" }
      )
    );
  }
}

export function createStore() {
  const cfg = window.BUT_CONFIG || {};
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) return new SupabaseStore(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  return new LocalStore();
}

/* =====================================================================
   Demo league
   ===================================================================== */

const AV = "https://d8j0ntlcm91z4.cloudfront.net/user_3APYC1QfmdVhtIeeTSVdRpRxODl/hf_";

async function seedData() {
  const people = [
    ["marcus", "Marcus", AV + "20261015_020406_78355916-25ea-45e7-8e22-461b0b6e55df_min.webp"],
    ["dre", "Dre", AV + "20261015_020405_d1860ab0-598b-41b8-8c19-224c6b764366_min.webp"],
    ["sofia", "Sofia", AV + "20261015_020406_c04af587-0cd8-49a2-802e-8b1563b0c9e0_min.webp"],
    ["jay", "Jay", AV + "20261015_020406_efd93652-1fda-4c59-b029-a0abca0bd80e_min.webp"],
    ["kev", "Kev", AV + "20261015_020407_f7aef140-b478-4acc-b064-a88c64c49fa2_min.webp"],
    ["tasha", "Tasha", AV + "20261015_020407_5e4b80c7-8ea9-4daa-86a9-da4d3e26d872_min.webp"],
    ["luis", "Luis", AV + "20261015_020407_eef99f41-e768-471a-b165-fda179bd5157_min.webp"],
    ["nina", "Nina", AV + "20261015_020406_bb0e062c-e66e-41f3-8c37-d099b63b7df5_min.webp"],
    ["omar", "Omar", null],
    ["benji", "Benji", null],
    ["zeke", "Zeke", null],
    ["mo", "Mo", null],
    ["ty", "Ty", null],
    ["cam", "Cam", null],
    ["rico", "Rico", null],
    ["coach_ray", "Ray (Ref)", null],
  ];
  const users = [];
  for (const [i, [username, displayName, avatar]] of people.entries()) {
    const salt = uid();
    users.push({
      id: uid(), username, displayName, salt, passHash: await sha256(salt + "demo123"),
      avatar, color: colorFor(i), createdAt: new Date(Date.now() - (30 - i) * 864e5).toISOString(),
    });
  }
  const U = Object.fromEntries(users.map((u) => [u.username, u.id]));
  const day = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  };
  const games = [];
  const ratings = [];

  const team = (captain, name, players, formation, gk, score, positions = {}) => {
    const ids = players.map((p) => U[p]);
    const slots = {};
    if (formation) {
      let i = 0;
      if (gk) slots.gk = ids[i++];
      formation.split("-").map(Number).forEach((n, li) => { for (let j = 0; j < n; j++) slots[`${li}-${j}`] = ids[i++]; });
    }
    return { captainId: U[captain], name, playerIds: ids, formation, gk, slots, positions, score };
  };

  const rateGame = (g, base, refBase) => {
    const jit = (a, b) => (((a.charCodeAt(0) + b.charCodeAt(2)) % 5) - 2) * 0.25;
    for (const t of [g.teamA, g.teamB]) {
      for (const r of t.playerIds) {
        for (const e of t.playerIds) {
          if (r === e) continue;
          const name = users.find((u) => u.id === e).username;
          const score = Math.max(1, Math.min(10, Math.round(((base[name] ?? 6.5) + jit(r, e)) * 2) / 2));
          ratings.push({ id: uid(), gameId: g.id, raterId: r, target: e, score, note: "" });
        }
        if (g.ref && refBase) {
          ratings.push({ id: uid(), gameId: g.id, raterId: r, target: "ref", score: Math.round((refBase + jit(r, "ref")) * 2) / 2, note: "" });
        }
      }
    }
  };

  // 7v8 soccer, final
  const g1 = {
    id: uid(), sport: "soccer", date: day(1), time: "19:30", location: "Slater Park turf",
    createdBy: U.marcus, createdAt: new Date(Date.now() - 2 * 864e5).toISOString(), status: "final",
    teamA: team("marcus", "Night Shift", ["luis", "marcus", "omar", "sofia", "kev", "tasha", "nina"], "2-3-1", true, 5),
    teamB: team("jay", "Cage FC", ["benji", "zeke", "mo", "ty", "dre", "cam", "rico", "jay"], "3-3-1", true, 4),
    ref: { userId: U.coach_ray, name: "Ray (Ref)" },
    stats: {
      [U.sofia]: { goals: 2, assists: 1 }, [U.marcus]: { goals: 1, assists: 2 }, [U.nina]: { goals: 1 }, [U.tasha]: { goals: 1, assists: 1 },
      [U.luis]: { saves: 6 }, [U.jay]: { goals: 3 }, [U.dre]: { goals: 1, assists: 2 }, [U.benji]: { saves: 4 }, [U.rico]: { assists: 1 },
    },
  };
  games.push(g1);
  rateGame(g1, { sofia: 8.5, marcus: 8, nina: 7, omar: 6.5, luis: 7.5, kev: 6.5, tasha: 7, jay: 9, dre: 7.5, benji: 6.5, zeke: 6.5, mo: 6, ty: 6.5, cam: 6.5, rico: 7 }, 7);

  // 4v4 soccer, final, no ref
  const g2 = {
    id: uid(), sport: "soccer", date: day(4), time: "18:00", location: "Hope High cage",
    createdBy: U.dre, createdAt: new Date(Date.now() - 5 * 864e5).toISOString(), status: "final",
    teamA: team("dre", "Bibs", ["kev", "dre", "jay", "nina"], "2-1", true, 6),
    teamB: team("sofia", "No Bibs", ["omar", "sofia", "luis", "marcus"], "1-2", true, 6),
    ref: null,
    stats: { [U.jay]: { goals: 3 }, [U.dre]: { goals: 2, assists: 3 }, [U.nina]: { goals: 1 }, [U.sofia]: { goals: 3, assists: 1 }, [U.marcus]: { goals: 2 }, [U.luis]: { goals: 1, assists: 2 }, [U.kev]: { saves: 5 }, [U.omar]: { saves: 3 } },
  };
  games.push(g2);
  rateGame(g2, { kev: 7, dre: 8.5, jay: 8, nina: 6.5, omar: 6.5, sofia: 9, luis: 7, marcus: 7.5 });

  // 3v3 basketball, final, with a ref
  const g3 = {
    id: uid(), sport: "basketball", date: day(6), time: "20:00", location: "Slater Park courts",
    createdBy: U.jay, createdAt: new Date(Date.now() - 7 * 864e5).toISOString(), status: "final",
    teamA: team("jay", "Shirts", ["jay", "tasha", "kev"], null, false, 21, {}),
    teamB: team("marcus", "Skins", ["marcus", "dre", "benji"], null, false, 17, {}),
    ref: { userId: null, name: "Big Mike" },
    stats: { [U.jay]: { pts: 9, reb: 4, ast: 3 }, [U.tasha]: { pts: 7, ast: 5 }, [U.kev]: { pts: 5, reb: 8, blk: 2 }, [U.marcus]: { pts: 8, reb: 3 }, [U.dre]: { pts: 7, ast: 4, stl: 2 }, [U.benji]: { pts: 2, reb: 6 } },
  };
  g3.teamA.positions = { [U.jay]: "SG", [U.tasha]: "PG", [U.kev]: "C" };
  g3.teamB.positions = { [U.marcus]: "SF", [U.dre]: "PG", [U.benji]: "C" };
  games.push(g3);
  rateGame(g3, { jay: 8, tasha: 8, kev: 7.5, marcus: 7, dre: 7.5, benji: 6 }, 5.5);

  // Open game waiting for an opposing captain
  games.push({
    id: uid(), sport: "soccer", date: day(-2), time: "19:00", location: "Slater Park turf",
    createdBy: U.sofia, createdAt: new Date().toISOString(), status: "open",
    teamA: team("sofia", "Sofia's Squad", ["luis", "sofia", "nina", "omar", "tasha"], "2-1-1", true, null),
    teamB: null,
    ref: { userId: U.coach_ray, name: "Ray (Ref)" },
    stats: {},
  });

  return { version: 2, users, games, ratings };
}
