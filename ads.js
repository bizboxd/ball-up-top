// Light ads for free players. Pro removes them.
//
// Rules: only on the Feed and the Leaderboard, never full-screen, never on the rating,
// game or plans screens. Non-personalized (no tracking prompt needed).
// Everything stays off until the ad IDs are filled in config.js:
//   Website:    ADSENSE_CLIENT ("ca-pub-...") + ADSENSE_SLOT  -> one inline "Sponsored" card
//   iPhone app: ADMOB_BANNER_ID ("ca-app-pub-.../...")        -> a slim banner above the bottom nav
// (The iPhone build also needs the ADMOB_APP_ID repo variable; see .github/workflows/ios.yml.)

import { billing, isNative } from "./billing.js";

const cfg = window.BUT_CONFIG || {};
const AD_ROUTES = new Set(["", "leaders"]);

class Ads {
  constructor() {
    this.native = isNative();
    this.webOn = !this.native && !!cfg.ADSENSE_CLIENT && !!cfg.ADSENSE_SLOT;
    this.nativeOn = this.native && !!cfg.ADMOB_BANNER_ID;
    this.bannerUp = false;
    this.scriptLoaded = false;
  }

  get active() { return (this.webOn || this.nativeOn) && !billing.isPro(); }

  // Inline card for the website. Returns "" when ads are off, on the app, or for Pro.
  slot() {
    if (!this.webOn || !this.active) return "";
    return `<aside class="ad-slot" aria-label="Sponsored">
      <div class="ad-label"><span>Sponsored</span><a href="#/plans">Remove ads with Pro</a></div>
      <ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.ADSENSE_CLIENT}" data-ad-slot="${cfg.ADSENSE_SLOT}" data-ad-format="auto" data-full-width-responsive="true"></ins>
    </aside>`;
  }

  // Called after every screen renders.
  async afterRender(route) {
    try {
      if (this.webOn) this.#fillWeb();
      if (this.nativeOn) await this.#banner(this.active && AD_ROUTES.has(route || ""));
    } catch (err) {
      console.warn("Ads unavailable", err);
    }
  }

  #fillWeb() {
    const slots = [...document.querySelectorAll("ins.adsbygoogle:not([data-adsbygoogle-status])")];
    if (!slots.length) return;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.requestNonPersonalizedAds = 1;
    if (!this.scriptLoaded) {
      const s = document.createElement("script");
      s.async = true;
      s.crossOrigin = "anonymous";
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.ADSENSE_CLIENT)}`;
      document.head.appendChild(s);
      this.scriptLoaded = true;
    }
    slots.forEach(() => window.adsbygoogle.push({}));
  }

  async #banner(want) {
    if (want === this.bannerUp) return;
    if (!this.P) {
      this.P = window.Capacitor.registerPlugin("AdMob");
      await this.P.initialize({});
    }
    if (want) {
      await this.P.showBanner({ adId: cfg.ADMOB_BANNER_ID, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER", margin: 64, npa: true });
      document.body.classList.add("has-banner");
    } else {
      await this.P.removeBanner();
      document.body.classList.remove("has-banner");
    }
    this.bannerUp = want;
  }
}

export const ads = new Ads();
