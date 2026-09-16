# MediVault — MVP

Emergency medical identity app. Create a real account, fill in your
medical details (and your family's), upload a report for an AI summary,
then scan a QR → see verified blood group, allergies, conditions,
medications, and emergency contact — no login needed for the responder.
Full profile management stays behind your own sign-in.

**🔗 Live demo:** https://medivault-roan.vercel.app

## Workflow — how a user moves through the app

```mermaid
flowchart TD
    A[New user opens app] --> B[Create your MediVault ID<br/>3-step signup]
    B --> B1[Step 1: Account<br/>name, email, phone, password]
    B1 --> B2[Step 2: Medical details<br/>blood group, allergies,<br/>conditions, medications]
    B2 --> B3[Step 3: Optional report upload<br/>+ AI summary]
    B3 --> C[Dashboard]
    C --> D[Add family member profiles]
    D --> C
    C --> E[Open a profile]
    E --> F[Real QR code generated<br/>encodes data + emergency link]

    G[Returning user opens app] --> H[Sign in<br/>account persists in this browser]
    H --> C

    F --> I{Responder scans QR<br/>at the scene}
    I -->|No signal| J[Phone's camera / any scanner<br/>shows blood group, allergies,<br/>conditions, meds, contact<br/>as plain text — instantly]
    I -->|Has signal| K[Taps through to<br/>Emergency Mode webpage]
    K --> L[Live location sharing]
    K --> M[Nearby hospitals]
    K --> N[One-tap 112 dial]
    K --> O[AI report summary]
```

**In short:**
1. **Sign up once** → fill your own + family medical details → optionally upload a report for an AI summary.
2. **Every profile gets a QR code** the moment it's created — no extra step.
3. **At the scene**, anyone can scan that QR:
   - **No internet needed** — the critical fields are encoded directly in the QR as text, so any camera or scanner shows them immediately.
   - **If the responder's phone has signal**, the same QR also opens the full Emergency Mode page — live location, nearby hospitals, one-tap emergency dialing, and the AI summary.
4. **Managing profiles** (editing details, adding family members, viewing the AI summary again) always stays behind your own sign-in — only the emergency snapshot is public.

## Run locally

```
npm install
npm run dev
```

Opens at `http://localhost:5173`. First run: you'll land on **Create your
MediVault ID** — a 3-step signup (account → your medical details →
optional report upload). Finishing it logs you straight into the
dashboard. Next time you open the app, you'll land on **Sign in** instead
(your account persists in this browser). Open any profile to see a real
QR code pointing at `http://localhost:5173/emergency/<token>` — open
that link in a new tab to see the public responder view.

## Deploy to Vercel (so the QR opens a real, public link)

1. Push this folder to a GitHub repo (or use `vercel` CLI directly from
   this folder without git — see step 4).
2. Go to https://vercel.com → **Add New → Project** → import the repo.
   Framework preset: **Vite** (auto-detected). Leave build command
   (`vite build`) and output directory (`dist`) as default.
3. Deploy. Vercel gives you a URL like `https://medivault-xyz.vercel.app`.
4. **CLI alternative** (no GitHub needed):
   ```
   npm install -g vercel
   vercel login
   vercel        # deploy a preview
   vercel --prod # deploy to your real production URL
   ```
5. Open the deployed URL, create your account, open a profile — the QR
   now encodes your real Vercel URL. Scanning it with any phone opens
   that exact page.

## Signing in and accounts — how it actually works

- Your account (name, email, phone, password) and every family profile
  you add are stored in **this browser's `localStorage`**, hashed
  password included (SHA-256 — good enough to keep a casual look from
  working, not a substitute for a real backend's auth).
- That means: same phone, same browser → you stay signed in and your
  data is there. A different device → it's a fresh install, no account
  yet, because there's no shared server behind it.
- "Sign out" clears just the session flag — your account and profiles
  stay saved, so signing back in picks up right where you left off.

## Installing on Android (and iOS) as a real app

`public/manifest.json` and `public/sw.js` make this an installable PWA:
open the deployed site in Chrome on Android → menu → **Add to Home
screen**. It launches full-screen with its own icon, like an installed
app — no Play Store needed. Safari on iOS has the same option under the
Share sheet.

## Turning on the AI report summary (optional but recommended)

The "Generate AI summary" button (in signup step 3, and again from any
profile's dashboard) calls a serverless function (`api/summarize.js`)
that talks to Anthropic's API. Your API key must live on the server,
never in the browser:

1. Get a key from https://console.anthropic.com (Settings → API Keys).
2. In your Vercel project → **Settings → Environment Variables**, add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key
   - Environment: Production (and Preview, if you want it there too)
3. Redeploy (Vercel → Deployments → ⋯ → Redeploy) so the function picks
   up the new variable.

Without this key set, the upload button still works but shows a message
telling you the key isn't configured — it won't crash the app.

**Testing the AI summary locally:** plain `npm run dev` does not run the
`api/` serverless function (that's a Vercel feature). To test it on your
machine, install the Vercel CLI and run `vercel dev` instead — it emulates
both the frontend and the function together, reading `ANTHROPIC_API_KEY`
from a local `.env` file (see `.env.example`).

## Works with zero internet at the scene

Accidents often happen where there's no signal. So the QR code does not
just point at a URL — it encodes the critical fields (blood group,
allergies, conditions, medications, emergency contact) directly as plain
text, with the link to the full app riding along at the end. This means:

- **Offline**: any QR scanner — the phone's own camera, Google Lens, any
  third-party app — shows the life-saving info immediately as text. No
  page load, no server, no data connection required at all.
- **Online**: if the responder's phone does have signal, the same code
  also carries `https://.../emergency/<token>`, so they can tap through
  to the full Emergency Mode — live location sharing, nearby hospitals,
  one-tap 112 dial, and the AI report summary.

This is why the QR looks a bit denser than a typical "just a link" QR —
it's carrying the actual data, which is the whole point.

## Important limitation — read before demoing

This MVP keeps your account and family data in the browser's
`localStorage`, not in a shared database. That means:

- Signing in and scanning a QR **on the same phone/browser** works
  perfectly — data is right there.
- Signing in from a **different device** starts a brand-new account
  (nothing to sign into yet), and scanning a QR from a different device
  shows a friendly "not found on this device" screen.

For real multi-device accounts and cross-device QR resolution, the next
step is a proper backend + database (Node/Express + MongoDB, matching
the original architecture). Happy to build that next if you want to take
this past the current stage.

## Project structure

```
index.html            entry HTML + PWA meta tags
public/manifest.json   PWA manifest (installable on Android/iOS)
public/sw.js            minimal service worker (app-shell caching)
public/icon-*.png       app icons
src/main.jsx            React bootstrap + service worker registration
src/App.jsx             all UI: signup wizard, login, dashboard, profile+QR, uploads, responder view
api/summarize.js        serverless function → Anthropic API (report → summary)
vercel.json             routes /emergency/:token to the SPA, leaves /api alone
```
