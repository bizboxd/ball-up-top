// Maps: the pin picker for public games and the nearby-games map. Leaflet loads only when a map is shown.
let leaflet = null;
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return (leaflet ||= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.append(css);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => resolve(window.L);
    s.onerror = () => { leaflet = null; reject(new Error("Couldn't load the map. Check your connection.")); };
    document.head.append(s);
  }));
}

const tiles = (L) => L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  subdomains: "abcd", maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
});

const pinIcon = (L, cls = "") => L.divIcon({ className: `wc-pin ${cls}`, html: "<span></span>", iconSize: [28, 36], iconAnchor: [14, 34], popupAnchor: [0, -30] });

let lastFix = null;
export function myLocation({ timeout = 8000 } = {}) {
  if (lastFix && Date.now() - lastFix.at < 5 * 60e3) return Promise.resolve(lastFix);
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location isn't available on this device."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve((lastFix = { lat: p.coords.latitude, lng: p.coords.longitude, at: Date.now() })),
      (e) => reject(new Error(e.code === 1 ? "Location is off for Who Cooked. You can turn it on in Settings." : "Couldn't get your location.")),
      { enableHighAccuracy: false, timeout, maximumAge: 300000 }
    );
  });
}

// Address and place search (OpenStreetMap data via Photon, no key needed).
export async function searchPlaces(q, near) {
  const p = new URLSearchParams({ q, limit: "6" });
  if (near) { p.set("lat", near.lat); p.set("lon", near.lng); }
  const res = await fetch(`https://photon.komoot.io/api/?${p}`);
  if (!res.ok) throw new Error("Search isn't working right now. Drop the pin by tapping the map.");
  const data = await res.json();
  return (data.features || []).map((f) => {
    const pr = f.properties || {};
    const line2 = [pr.street && (pr.housenumber ? `${pr.housenumber} ${pr.street}` : pr.street), pr.city || pr.town || pr.village, pr.state].filter(Boolean).join(", ");
    return { name: pr.name || line2 || "Pinned spot", detail: pr.name ? line2 : "", lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
  });
}

export function distanceKm(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const usesMiles = () => /^en-(US|GB|LR|MM)/.test(navigator.language || "en-US");
export function fmtDistance(km) {
  if (usesMiles()) { const mi = km * 0.621371; return mi < 0.1 ? "Right here" : `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`; }
  return km < 0.1 ? "Right here" : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const DEFAULT_CENTER = { lat: 39.5, lng: -98.35 }; // middle of the US

/*
  Pin picker. root contains: [data-pp-map], [data-pp-q], [data-pp-me], [data-pp-results], [data-pp-note].
  onChange({lat, lng, name?}) runs whenever the pin moves. Returns a cleanup function.
*/
export async function mountPicker(root, initial, onChange) {
  const L = await loadLeaflet();
  if (!root.isConnected) return () => {};
  const el = root.querySelector("[data-pp-map]");
  const has = initial && initial.lat != null;
  const map = L.map(el, { zoomControl: true, attributionControl: true }).setView(has ? [initial.lat, initial.lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], has ? 16 : 4);
  tiles(L).addTo(map);
  let marker = null;
  const note = root.querySelector("[data-pp-note]");
  const place = (lat, lng, name, pan = true) => {
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true, icon: pinIcon(L) }).addTo(map);
      marker.on("dragend", () => { const p = marker.getLatLng(); onChange({ lat: p.lat, lng: p.lng }); });
    } else marker.setLatLng([lat, lng]);
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 16));
    if (note) note.textContent = "Pin set. Drag it to fine-tune.";
    onChange({ lat, lng, name });
  };
  if (has) place(initial.lat, initial.lng, null, false);
  else myLocation({ timeout: 6000 }).then((p) => { if (!marker) map.setView([p.lat, p.lng], 14); }).catch(() => {});
  map.on("click", (e) => place(e.latlng.lat, e.latlng.lng, null, false));

  root.querySelector("[data-pp-me]")?.addEventListener("click", async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { const p = await myLocation(); place(p.lat, p.lng); } catch (err) { if (note) note.textContent = err.message; }
    finally { b.disabled = false; }
  });
  const q = root.querySelector("[data-pp-q]"), out = root.querySelector("[data-pp-results]");
  let timer = null;
  q?.addEventListener("input", () => {
    clearTimeout(timer);
    const text = q.value.trim();
    if (text.length < 3) { out.innerHTML = ""; return; }
    timer = setTimeout(async () => {
      try {
        const c = map.getCenter();
        const list = await searchPlaces(text, map.getZoom() > 6 ? { lat: c.lat, lng: c.lng } : lastFix);
        out.innerHTML = list.map((r, i) => `<button type="button" data-i="${i}"><b>${esc(r.name)}</b>${r.detail ? `<small>${esc(r.detail)}</small>` : ""}</button>`).join("") || `<span class="muted small">No matches. Tap the map instead.</span>`;
        out.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => {
          const r = list[Number(b.dataset.i)];
          out.innerHTML = ""; q.value = r.name;
          place(r.lat, r.lng, r.name);
        }));
      } catch (err) { out.innerHTML = `<span class="muted small">${esc(err.message)}</span>`; }
    }, 350);
  });
  q?.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
  setTimeout(() => map.invalidateSize(), 50);
  return () => map.remove();
}

/*
  Nearby map. games: [{ g, html }] with g.lat/g.lng. Returns { map, focus(lat,lng) }.
*/
export async function mountNearby(el, games, center) {
  const L = await loadLeaflet();
  if (!el.isConnected) return null;
  const map = L.map(el).setView(center ? [center.lat, center.lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], center ? 11 : 4);
  tiles(L).addTo(map);
  const pts = [];
  for (const { g, html } of games) {
    L.marker([g.lat, g.lng], { icon: pinIcon(L, g.sport) }).addTo(map).bindPopup(html, { className: "wc-popup", maxWidth: 260 });
    pts.push([g.lat, g.lng]);
  }
  let meDot = null;
  const showMe = (p) => {
    if (meDot) meDot.setLatLng([p.lat, p.lng]);
    else meDot = L.circleMarker([p.lat, p.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#2f6bff", fillOpacity: 1 }).addTo(map);
  };
  if (center) showMe(center);
  else if (pts.length) map.fitBounds(pts, { padding: [36, 36], maxZoom: 13 });
  setTimeout(() => map.invalidateSize(), 50);
  return { map, showMe, focus: (lat, lng) => map.setView([lat, lng], 14) };
}
