// Native plugin lookup that works however the Capacitor bridge exposes plugins.
export const capPlugin = (name) => {
  const C = window.Capacitor;
  if (!C) throw new Error("Capacitor not available");
  if (typeof C.registerPlugin === "function") return C.registerPlugin(name);
  if (C.Plugins?.[name]) return C.Plugins[name];
  throw new Error(`Native plugin ${name} not available`);
};
