// Game reminders (iPhone local notifications), add-to-calendar and share links.
import { capPlugin } from "./native.js";

const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const SITE = "https://whocooked.gg/";
export const gameUrl = (id) => `${SITE}#/g/${id}`;

// Local start time of a game. Games without a kickoff time count as 9am.
export function gameStart(g) {
  const [y, m, d] = (g.date || "").split("-").map(Number);
  const [hh, mm] = (g.time || "09:00").split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

// Stable positive 31-bit id per game for the notification.
function idFor(gameId) {
  let h = 7;
  for (const c of gameId) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % 2000000000) + 1;
}

let lastSig = null;
export const reminders = {
  // Called once at startup: tapping a reminder opens its game.
  init() {
    if (!isNative()) return;
    try {
      capPlugin("LocalNotifications").addListener("localNotificationActionPerformed", (e) => {
        const id = e?.notification?.extra?.gameId;
        if (id) location.hash = `#/g/${id}`;
      });
    } catch (err) { console.warn("Reminders unavailable", err); }
  },
  // items: [{ g, body }] for every upcoming game the player is confirmed for.
  // ask=true may show the iPhone permission prompt (only after the player taps "I'm in").
  async sync(items, ask = false) {
    if (!isNative()) return;
    const sig = items.map(({ g, body }) => `${g.id}|${g.date}|${g.time}|${body}`).join(";");
    if (sig === lastSig && !ask) return;
    try {
      const LN = capPlugin("LocalNotifications");
      let perm = await LN.checkPermissions();
      if (perm.display !== "granted") {
        if (!ask || perm.display === "denied") return;
        perm = await LN.requestPermissions();
        if (perm.display !== "granted") return;
      }
      const pending = (await LN.getPending())?.notifications || [];
      const ours = pending.filter((n) => n.extra?.wc).map((n) => ({ id: n.id }));
      if (ours.length) await LN.cancel({ notifications: ours });
      const now = Date.now();
      const list = [];
      for (const { g, body } of items) {
        const start = gameStart(g);
        const at = g.time ? new Date(start.getTime() - 2 * 3600e3) : new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9, 0);
        if (at.getTime() <= now + 60e3) continue;
        list.push({ id: idFor(g.id), title: g.time ? "Game in 2 hours" : "Game today", body, schedule: { at }, extra: { wc: 1, gameId: g.id } });
      }
      if (list.length) await LN.schedule({ notifications: list.slice(0, 60) });
      lastSig = sig;
    } catch (err) { console.warn("Couldn't schedule reminders", err); }
  },
};

const icsDate = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
const icsText = (s) => String(s || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

// iPhone app: the system "Add Event" sheet. Website: an .ics file (Apple, Google, Outlook all open it).
export async function addToCalendar(g, title) {
  const start = gameStart(g);
  const end = new Date(start.getTime() + 2 * 3600e3);
  if (isNative()) {
    try {
      await capPlugin("CapacitorCalendar").createEventWithPrompt({ title, location: g.location || "", startDate: start.getTime(), endDate: end.getTime(), url: gameUrl(g.id), description: gameUrl(g.id) });
      return "native";
    } catch (err) {
      console.warn("Calendar plugin unavailable", err);
      window.open(googleCalUrl(g, title, start, end), "_blank");
      return "google";
    }
  }
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Who Cooked//EN", "BEGIN:VEVENT",
    `UID:${g.id}@whocooked.gg`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")}`,
    `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${icsText(title)}`, `LOCATION:${icsText(g.location)}`,
    `DESCRIPTION:${icsText(gameUrl(g.id))}`, `URL:${gameUrl(g.id)}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${icsText(title)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = "who-cooked-game.ics";
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return "ics";
}

function googleCalUrl(g, title, start, end) {
  const p = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${icsDate(start)}/${icsDate(end)}`, location: g.location || "", details: gameUrl(g.id) });
  return `https://calendar.google.com/calendar/render?${p}`;
}

// Share sheet when available, otherwise copy the link.
export async function shareLink(url, title, text) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return "shared"; }
    catch (err) { if (err?.name === "AbortError") return "cancelled"; }
  }
  try { await navigator.clipboard.writeText(url); return "copied"; } catch (_) { return "failed"; }
}
