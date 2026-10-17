"""App Store screenshots (6.9" iPhone, 1290x2796) of the demo league, as the iPhone app shows it.

Run by .github/workflows/screenshots.yml. Serves a copy of the site in demo mode and pretends to be
the native app (so Pro, which is hidden in the app until payments are live, doesn't show).
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "appstore/screenshots"
os.makedirs(OUT, exist_ok=True)

NATIVE_STUB = """
window.Capacitor = {
  isNativePlatform: () => true,
  getPlatform: () => 'ios',
  registerPlugin: () => new Proxy({}, { get: () => async () => ({}) }),
};
"""

async def settle(pg, ms=1500):
    await pg.wait_for_load_state("networkidle")
    await pg.evaluate("document.fonts.ready")
    await pg.wait_for_timeout(ms)

DEVICES = {
    # 6.9" iPhone: 1290x2796
    "": {"viewport": {"width": 430, "height": 932}, "device_scale_factor": 3, "is_mobile": True, "has_touch": True},
    # 13" iPad: 2064x2752
    "ipad-": {"viewport": {"width": 1032, "height": 1376}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True},
}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for prefix, opts in DEVICES.items():
            await shoot(b, prefix, opts)
        await b.close()

async def shoot(b, prefix, opts):
        ctx = await b.new_context(**opts)
        await ctx.add_init_script(NATIVE_STUB)
        pg = await ctx.new_page()
        await pg.goto(BASE)
        await settle(pg)

        inputs = await pg.query_selector_all("#auth-form input")
        await inputs[0].fill("marcus")
        await inputs[1].fill("demo123")
        await pg.keyboard.press("Enter")
        await pg.wait_for_timeout(3500)  # let the welcome toast clear
        await settle(pg, 500)
        await pg.screenshot(path=f"{OUT}/{prefix}02-feed.png")

        db = json.loads(await pg.evaluate("localStorage.getItem('ballUpTop.v2')"))
        games = [g for g in db["games"] if g["status"] == "final"]
        games.sort(key=lambda g: g.get("finalAt") or "", reverse=True)
        voting, revealed = games[0], next(g for g in games[1:] if g["sport"] == "soccer")

        await pg.goto(BASE + f"#/g/{revealed['id']}")
        await settle(pg)
        await pg.screenshot(path=f"{OUT}/{prefix}03-match.png")

        await pg.goto(BASE + f"#/g/{voting['id']}")
        await settle(pg, 800)
        await pg.evaluate("document.getElementById('rate')?.scrollIntoView({block: 'start'}); window.scrollBy(0, -70)")
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=f"{OUT}/{prefix}04-rate.png")

        me = await pg.evaluate("document.getElementById('nav-me').getAttribute('href')")
        await pg.goto(BASE + me)
        await settle(pg)
        await pg.screenshot(path=f"{OUT}/{prefix}05-profile.png")

        await pg.goto(BASE + "#/leaders")
        await settle(pg)
        await pg.screenshot(path=f"{OUT}/{prefix}06-leaders.png")
        await ctx.close()

asyncio.run(main())
