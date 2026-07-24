# SignedOut

Your class, one shirt, everyone's signature — a virtual graduation shirt that ends as a real, print-ready file.

Stack: Node + Express + TypeScript, MongoDB + Mongoose, React + TypeScript + Vite, Tailwind, Three.js (@react-three/fiber + drei), JWT (httpOnly cookies) + Google OAuth, Paystack + Flutterwave behind a gateway-agnostic interface, S3 or local disk behind a StorageProvider interface.

## Quick start

Prerequisites: Node 20+, a running MongoDB (local `mongod` or Atlas).

```bash
# 1. Server
cd server
cp ../.env.example .env        # then edit values (at minimum the JWT secrets)
npm install
npm run dev                    # http://localhost:4000

# 2. Client (second terminal)
cd client
npm install
npm run dev                    # http://localhost:5173
```

On first boot the server seeds/promotes the admin account from `ADMIN_SEED_EMAIL`. If `ADMIN_SEED_PASSWORD` is set and no account exists with that email, the account is created; otherwise an existing account with that email is promoted to admin.

Uploads land in `server/uploads/` (served at `/uploads`) until the four AWS variables are filled in, at which point the S3 provider takes over automatically. No code changes.

## Payments setup (test mode)

1. **Paystack** — grab the test secret key (`sk_test_...`) from the Paystack dashboard and set `PAYSTACK_SECRET_KEY`. Test card: `4084 0840 8408 4081`, any future expiry, CVV `408`, PIN `0000`, OTP `123456`.
2. **Flutterwave** — set `FLUTTERWAVE_SECRET_KEY` (`FLWSECK_TEST-...`). In the Flutterwave dashboard set a **Secret hash** under Settings -> Webhooks and mirror it in `FLUTTERWAVE_WEBHOOK_HASH`.
3. **Webhooks** (needed in production; in dev the client-side verify covers you): point the dashboards at
   - `POST https://your-domain/api/payments/webhook/paystack`
   - `POST https://your-domain/api/payments/webhook/flutterwave`
   To test webhooks locally, tunnel with `ngrok http 4000` and use the ngrok URL.
4. A gateway only activates if its secret key is present — with both keys blank, checkout attempts fail loudly with "not configured", nothing is faked.
5. Monetization is **off by default**. Turn it on in Admin -> Monetization; every price, gate, free limit, and currency route is editable at runtime.

## Where things live

```
server/src
  models/        User, Ceremony, Signature, Group, Transaction, PromoCode, SiteSettings
  controllers/   auth, users, ceremonies (+assets/lock/export-access), signatures, groups, payments, admin
  services/      storage (local|S3), payments (Paystack|Flutterwave|registry), pricing, fulfillment, googleOAuth
  middleware/    auth (require/optional/admin), validate (Zod), upload (multer), rateLimiter, sanitize, errorHandler
client/src
  three/         drawPanel.ts (the one canvas renderer), ShirtScene.tsx (3D viewer)
  features/      signing (PlacementPanel, DrawPad), payments (checkout, CheckoutPanel)
  pages/         Landing, Login, Register, Profile, Dashboard, CeremonyNew, CeremonyStudio,
                 SignPage (public), Groups, GroupDetail, JoinGroup, PayCallback, Admin
  lib/           api.ts (auto-refresh fetch), types.ts, exportShirt.ts (PNG + PDF)
```

One deliberate architecture note: the print export renders **in the browser** with the exact `drawPanel()` module that paints the live 3D texture, so the download is pixel-identical to the preview. The server stays the authority on whether the watermark applies (`GET /api/ceremonies/:id/export/access`). All placements are stored resolution-independent (positions 0..1, sizes as fractions of panel width). See `DECISIONS.md` for every judgment call.

## Verification checklists

This code was written and compiler-parsed in an offline environment: it has **not** been executed against a live MongoDB or the gateway sandboxes. Run these end-to-end before trusting each phase.

### Phase 1 — Auth and profiles
- [ ] Register, refresh the page — still signed in (refresh cookie rotation works)
- [ ] Wrong password rejected with a clear message; suspended account blocked at login
- [ ] Google sign-in round-trips (with OAuth env set); profile shows the Google avatar
- [ ] `ADMIN_SEED_EMAIL` account has the Admin link in the dashboard header

### Phase 2 — Ceremonies
- [ ] Create a ceremony; it appears on the dashboard with its color swatch
- [ ] Upload a PNG crest to the front; it renders on the 3D shirt and survives reload
- [ ] Remove the asset; change the shirt color from the studio
- [ ] The share link opens the public sign page in a private/incognito window

### Phase 3 — 3D shirt
- [ ] Shirt rotates by drag, zooms by scroll; Front/Back buttons ease the shirt around
- [ ] Base assets show on the correct side at the placed position/scale/rotation

### Phase 4 — Signing
- [ ] As a signed-out guest: name required; typed signature with each of the six fonts lands where placed
- [ ] Drawn signature (mouse and touch) appears on the shirt with transparency
- [ ] Uploaded image signature is resized and placed correctly
- [ ] A second browser polling the sign page sees new signatures within ~8s
- [ ] Owner removes a signature from the studio; closing the ceremony blocks new ones (HTTP 423)
- [ ] 11 rapid signature posts from one IP hit the rate limit (HTTP 429)

### Phase 5 — Export
- [ ] Front/Back PNG download at 3000x3600 and match the on-screen shirt exactly
- [ ] PDF has both panels, crop marks, and the "print at 100% scale" footer
- [ ] With monetization on + download gate on: exports carry the diagonal watermark until unlocked

### Phase 6 — Groups
- [ ] Create a group; join link works from a second account
- [ ] Owner promotes a member to editor; the editor can edit a group ceremony, a plain member cannot
- [ ] Email-invite an existing account (added) and an unknown email (told to share the link)
- [ ] With the member gate on and the free limit reached, joining returns the upgrade prompt

### Phase 7 — Monetization
- [ ] With monetization OFF nothing anywhere asks for money
- [ ] Turn it on + ceremony gate (free limit 1): second ceremony creation shows checkout; pay with the Paystack test card; after the redirect the creation succeeds using the credit
- [ ] Download unlock via Flutterwave test flow removes the watermark
- [ ] 100%-off promo code skips the gateway entirely and fulfills instantly
- [ ] Webhook signature check: a forged POST to the webhook URLs returns 401
- [ ] Admin -> Revenue shows the test transactions grouped by currency and gateway

### Phase 8 — Admin and hardening
- [ ] Admin routes 403 for non-admins (try the API directly, not just the UI)
- [ ] Suspending a user kills their session on next refresh and blocks re-login
- [ ] Price change in Admin -> Monetization reflects at the next checkout without a restart
- [ ] Request bodies containing `$`-prefixed keys are stripped (Mongo operator injection)
- [ ] Non-image files rejected on every upload endpoint; 6MB file rejected (5MB cap)
