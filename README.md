# Ball Up Top

**Pickup, rated.** Log your pickup soccer, basketball and volleyball runs, set your formation, and rate your teammates out of 10, Sofascore-style.

## How a game works

1. **Start a game.** Whoever creates it is captain of the first side. They pick the sport, time, place, an optional ref, their players and their formation.
2. **Second captain claims the other side.** A game needs two captains. Share the invite link; the second captain picks their own players and sets their own formation. Teams don't have to be even (7v8, 4v5, whatever showed up).
3. **Final whistle.** Either captain posts the score and an optional box score.
4. **Ratings.** Every player rates their **own teammates only** (never the other team, never themselves) plus **the ref**, from 1 to 10.
5. **Man of the match** goes to the highest-rated player across both teams.

**Friends.** Send, accept and decline friend requests from the Squad page or anyone's profile. The feed defaults to games involving you and your friends (switch to Everyone any time), and when you build a team your friends are listed first.

**Ratings** go in 0.1 steps: drag the slider or tap − / + to fine-tune.

Player profiles show overall rating, form, rating trend, best game, MOTMs, per-sport stats and (for refs) a ref rating. The leaderboard ranks players by sport and lists refs separately.

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
