import { capPlugin } from "./native.js";
// Subscriptions through RevenueCat.
//   iPhone app: Apple in-app purchase (RevenueCat Capacitor plugin, talked to through the native bridge)
//   Website:    Stripe checkout (RevenueCat Web Billing JS SDK)
// Both use the Supabase user id as the RevenueCat app user id, so one subscription unlocks both.
//
// Plans live in RevenueCat as the "default" offering with the standard package ids:
//   $rc_monthly, $rc_annual (each with a 7-day free trial) and $rc_lifetime (one-time).
//
// The app is free. Pro (entitlement "pro") unlocks extra stats: rating trend, best game,
// per-sport breakdown, season recaps and head-to-head.

const cfg = window.BUT_CONFIG || {};
const ENTITLEMENT = cfg.REVENUECAT_ENTITLEMENT || "pro";

export const PLANS = [
  { id: "$rc_monthly", label: "Monthly", price: "$5", per: "month", trial: true, popular: true },
  { id: "$rc_annual", label: "Yearly", price: "$30", per: "year", trial: true, note: "Save 50% vs monthly" },
  { id: "$rc_lifetime", label: "Lifetime", price: "$50", per: "once", trial: false, note: "Pay once, keep it forever" },
];

export const isNative = () => !!window.Capacitor?.isNativePlatform?.();

class Billing {
  constructor() {
    this.native = isNative();
    this.key = this.native ? cfg.REVENUECAT_IOS_KEY : cfg.REVENUECAT_WEB_KEY;
    this.enabled = !!this.key; // without keys the paywall is off (demo / not set up yet)
    this.ready = false;
    this.userId = null;
    this.packages = {};
    this.info = null;
  }

  async start(userId) {
    if (!this.enabled || this.userId === userId) return;
    this.userId = userId;
    if (this.native) {
      this.P = capPlugin("Purchases");
      if (!this.ready) await this.P.configure({ apiKey: this.key, appUserID: userId });
      else await this.P.logIn({ appUserID: userId });
    } else {
      const mod = await import("https://cdn.jsdelivr.net/npm/@revenuecat/purchases-js@1/+esm");
      const Purchases = mod.Purchases || mod.default?.Purchases;
      this.P = Purchases.configure.length >= 2 ? Purchases.configure(this.key, userId) : Purchases.configure({ apiKey: this.key, appUserId: userId });
    }
    this.ready = true;
    await this.refresh();
  }

  async refresh() {
    if (!this.enabled || !this.ready) return;
    const res = await this.P.getCustomerInfo();
    this.info = res?.customerInfo || res;
  }

  // Before payments are switched on, Pro can be previewed per browser so it can be tested.
  get previewPro() { try { return localStorage.getItem("wc.previewPro") === "1"; } catch (_) { return false; } }
  set previewPro(on) { try { on ? localStorage.setItem("wc.previewPro", "1") : localStorage.removeItem("wc.previewPro"); } catch (_) {} }

  isPro() {
    if (!this.enabled) return this.previewPro;
    return !!this.info?.entitlements?.active?.[ENTITLEMENT];
  }

  activeLabel() {
    const e = this.info?.entitlements?.active?.[ENTITLEMENT];
    if (!e) return null;
    const pid = e.productIdentifier || "";
    const plan = /life/i.test(pid) ? "Lifetime" : /week/i.test(pid) ? "Weekly" : /month/i.test(pid) ? "Monthly" : /year|annual/i.test(pid) ? "Yearly" : "Pro";
    return { plan, renews: e.willRenew, expires: e.expirationDate || e.expiresDate || null, trial: e.periodType === "TRIAL" || e.periodType === "trial" };
  }

  async loadPlans() {
    if (!this.enabled || !this.ready) return PLANS;
    try {
      const res = await this.P.getOfferings();
      const current = res?.current || res?.offerings?.current;
      for (const p of current?.availablePackages || []) this.packages[p.identifier] = p;
    } catch (_) {}
    return PLANS.map((plan) => {
      const pkg = this.packages[plan.id];
      if (!pkg) return plan;
      const price = pkg.product?.priceString || pkg.rcBillingProduct?.currentPrice?.formattedPrice || pkg.webBillingProduct?.currentPrice?.formattedPrice;
      return { ...plan, price: price || plan.price, available: true };
    });
  }

  async purchase(planId, email) {
    if (!this.enabled) throw new Error("Payments aren't switched on yet.");
    const pkg = this.packages[planId];
    if (!pkg) throw new Error("That plan isn't available right now. Try again in a minute.");
    try {
      const res = this.native
        ? await this.P.purchasePackage({ aPackage: pkg })
        : await this.P.purchase({ rcPackage: pkg, customerEmail: email || undefined });
      this.info = res?.customerInfo || this.info;
      await this.refresh();
      return this.isPro();
    } catch (err) {
      if (err?.userCancelled || err?.code === "1" || /cancel/i.test(err?.message || "")) return false;
      throw err;
    }
  }

  async restore() {
    if (!this.enabled) return true;
    if (this.native) {
      const res = await this.P.restorePurchases();
      this.info = res?.customerInfo || this.info;
    } else {
      await this.refresh();
    }
    return this.isPro();
  }

  manageUrl() {
    if (this.native) return "https://apps.apple.com/account/subscriptions";
    return this.info?.managementURL || null;
  }

  async logOut() {
    if (!this.enabled || !this.ready) return;
    try { if (this.native) await this.P.logOut(); } catch (_) {}
    this.userId = null;
    this.info = null;
  }
}

export const billing = new Billing();
