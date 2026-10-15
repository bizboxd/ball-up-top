# Ball Up Top

**Pickup, rated.** Log your pickup soccer, basketball and volleyball runs, set your formation, and rate your teammates out of 10, Sofascore-style.

## How a game works

1. **Start a game.** Whoever creates it is captain of the first side. They pick the sport, time, place, an optional ref, their players and their formation.
2. **RSVP.** Anyone can tap *I'm in* or *Can't make it* on an upcoming run. Captains see the people who are in at the top of their player list.
3. **Second captain claims the other side.** A game needs two captains. Teams don't have to be even (7v8, 4v5, whatever showed up).
4. **Final whistle.** Either captain posts the score. That opens **24 hours of voting**. Each player adds **only their own stats** (goals, assists, points...) from the game page; stats lock when voting closes.
5. **Ratings.** Every player rates their **own teammates only** (never the other team, never themselves) plus **the ref**, from 0.1 to 10.0 in 0.1 steps.
6. **The reveal.** Ratings stay hidden until voting closes, or earlier if every vote is in. A game rating only counts once **at least 2 people** have rated you.
7. **Man of the match** goes to the highest-rated player across both teams.

## Everything else

- **Inbox** with friend requests, games you're added to, RSVPs to your runs, rating reminders, reveals and banter.
- **Banter**: comments on every game, with replies to specific comments.
- **Friends**: requests, accept/decline, a friends-only feed, friends listed first when picking teams.
- **Profiles**: profile pic upload, overall and season ratings, badges, form, rating trend, best game, per-sport stats, upcoming games, past games.
- **Leaders**: monthly seasons plus all-time, podium, per-sport tables and a ref table.
- **Badges**: Hat-trick, Playmaker, The wall, Bucket getter, Elite night, Back to back, Heater, Skipper, Regular, Trusted whistle.
- **Match card**: one tap turns a result into a 1080×1350 image for stories or the group chat.

## Membership

After a 7-day free trial, Ball Up Top needs a membership: **$2/week, $5/month, $30/year, or $50 once (lifetime)**.
Payments run through RevenueCat: Apple in-app purchase in the iPhone app, Stripe on the website, one membership for both.
Put the RevenueCat public keys in `config.js` to switch the paywall on. Without them the app is free to use.

| Plan | App Store product ID | Price | Trial | RevenueCat package |
| --- | --- | --- | --- | --- |
| Weekly | `com.bizboxd.balluptop.weekly` | $2.00 / week | 7 days free | `$rc_weekly` |
| Monthly | `com.bizboxd.balluptop.monthly` | $5.00 / month | 7 days free | `$rc_monthly` |
| Yearly | `com.bizboxd.balluptop.yearly` | $30.00 / year | 7 days free | `$rc_annual` |
| Lifetime | `com.bizboxd.balluptop.lifetime` | $50.00 once | none | `$rc_lifetime` |

All four unlock the RevenueCat entitlement `pro`. App Store app: "Ball Up Top - Rate Your Run" (bundle `com.bizboxd.balluptop`, Apple ID 6823302773). Subscription group: "Ball Up Top Membership".

## iPhone app

The iPhone app wraps this same site with Capacitor. `.github/workflows/ios.yml` builds it on GitHub's Macs:
without App Store secrets it runs a test build; with them it signs and uploads to TestFlight. See the comments at the top of that file for the four secrets.

## Run it

It's a static site with no build step. Serve the folder with any static server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Opening `index.html` directly from disk won't work because browsers block ES modules on `file://`.

### Demo mode (default)

With `config.js` left empty, everything (accounts, games, ratings, profile pics) is stored in your browser. A demo league is preloaded. Log in as `marcus` / `demo123` (every demo player uses `demo123`), or create your own account.

### Real accounts for your crew (Supabase)

Real accounts support email + password, **Continue with Google**, and **Continue with phone** (texted code). Google and phone users pick a username and add a profile pic the first time they log in.


1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in `supabase/schema.sql`, and run it. This creates the tables, the "only rate your teammates" security rules, and the `avatars` storage bucket for profile pics.
3. Under **Authentication → Providers → Email**, decide whether to require email confirmation (turning it off makes sign-up instant for friends).
4. **Google sign-in:** in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an OAuth client (type *Web application*) and add `https://<your-project>.supabase.co/auth/v1/callback` as an authorized redirect URI. Paste the client ID and secret into **Authentication → Providers → Google** and enable it.
5. **Phone sign-in:** enable **Authentication → Providers → Phone** and connect an SMS provider (Twilio, MessageBird or Vonage). Texting codes costs a little per message on their side.
6. Under **Authentication → URL Configuration**, set the Site URL to your live site (e.g. `https://bizboxd.github.io/ball-up-top/`) and add it to the redirect allow list.
7. Copy your **Project URL** and **anon public key** from **Project Settings → API** into `config.js`.

The rating rules are enforced in the database too, not just the UI, so nobody can rate the other team by poking the API.

## Deploy

Any static host works. For GitHub Pages: **Settings → Pages → Deploy from branch → `main` / root**.

## Images

Brand imagery and the demo profile pics were generated with Higgsfield and are currently loaded from Higgsfield's CDN (URLs at the top of `app.js` and in `store.js`). To self-host them, download each one into an `assets/` folder and update those URLs.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | All styling |
| `app.js` | Views, routing, game rules, formations, ratings |
| `store.js` | Data layer: demo (localStorage) or Supabase |
| `config.js` | Supabase keys (empty = demo mode) |
| `supabase/schema.sql` | Database tables and security rules |
