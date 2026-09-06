# DECISIONS.md — assumptions logged during the build

## Phase 1

- **Google OAuth is a manual authorization-code flow**, not Passport. The brief
  allowed either; manual keeps the dependency surface to zero extra packages
  and the whole flow is three readable requests in
  `server/src/services/googleOAuth.ts`.
- **Refresh tokens are single-use and rotated.** A SHA-256 hash of the current
  refresh token is stored on the User (`refreshTokenHash`, select: false). On
  refresh, a mismatch (reuse/theft) revokes the session entirely. Trade-off:
  one active session per user for now; a `Session` collection can replace this
  in a later phase if multi-device sessions matter.
- **Refresh cookie is path-scoped to `/api/auth`** so it is only sent to auth
  endpoints, `sameSite: lax`, `secure` in production.
- **Avatar upload is deferred to Phase 2**, where the `StorageProvider`
  (S3/local) abstraction lands. Google-provided avatars work now; local
  accounts show a flat monogram. Logged here rather than half-implementing an
  upload path with nowhere durable to store files.
- **Admin seeding runs on every server boot** (idempotent) *and* is available
  as `npm run seed:admin`, satisfying "zero manual DB edits."
- **Design tokens:** accent is a deep laurel green `#1C5A3F` (graduation
  laurel; deliberately not Tailwind's default indigo/blue/purple). Cool
  off-white paper `#F6F7F4`, near-black ink `#161D18`. Display face Young
  Serif, body Public Sans. Zero border-radius, flat colors only, no gradients,
  no emojis. Recurring motif: the "signature line" — a short flat rule under
  headings, echoing the line a name is signed on.
- **Zod chosen over Joi** (brief allowed either) — better TypeScript inference.
- **`bcryptjs` over native `bcrypt`** to avoid node-gyp build failures on
  Windows dev machines; cost factor 12.
- **Client state via React Context** (brief allowed Zustand or Context). Auth
  is the only global state in Phase 1; Zustand can be introduced when the
  ceremony studio's state warrants it.

## Phases 2-8 (full build)

- **Export renders client-side, not on the server.** The brief's API surface listed
  `GET /export/png|pdf` server routes, but Section 7 specifies the export as a
  high-res render of the same 2D panel canvas used for the live texture. Rendering
  in the browser with the shared `drawPanel()` module guarantees WYSIWYG (identical
  code path to what the owner sees on screen) and avoids the node-canvas native
  build headache. The server keeps the authority that matters:
  `GET /api/ceremonies/:id/export/access` decides whether the watermark applies
  and returns the payment gate. Watermark drawing happens inside `drawPanel()` per
  the server's answer.
- **Coordinates are resolution-independent.** `x`,`y` are 0..1 (item center relative
  to the panel), `scale` and `fontSize` are fractions of panel width, `rotation` is
  degrees. The panel ratio is fixed at 5:6 (width:height). The same data draws
  identically on the 1024px live texture and the 3000x3600 print render.
- ~~**Procedural shirt mesh** (silhouette Shape, extruded body + front/back textured
  panels) instead of a downloaded .glb: no licensing questions, no binary in the
  repo, and the signing surface stays a flat canvas exactly as prescribed.~~
  **Reversed — see "Garment system" below.**
- **`invite` visibility = unlisted link** (anyone with the URL). `group` visibility
  requires a signed-in group member. True per-person invites need outbound email,
  which is out of scope until an email provider is chosen.
- **Group email invite adds existing accounts only.** Without an email provider we
  cannot send invitations; unknown emails get a clear "share the join link" response.
- **`ceremony_creation` payments fulfill as a credit** (`User.ceremonyCredits += 1`),
  consumed automatically on the next over-limit creation — the payment necessarily
  happens before the ceremony exists.
- **100%-off promo codes skip the gateway** entirely: recorded as a `gateway:
  'promo'` transaction and fulfilled immediately.
- **Flutterwave webhook verification** uses the dashboard "secret hash" compared
  against the `verif-hash` header (their scheme), so `FLUTTERWAVE_WEBHOOK_HASH` was
  added to the env contract. Paystack uses HMAC-SHA512 of the raw body.
- **Client-side verify endpoint** (`GET /api/payments/verify/:reference`) exists
  alongside webhooks because webhooks cannot reach localhost in dev; both paths
  converge on one idempotent `fulfill()` guarded by a `fulfilledAt` compare-and-set.
- **Custom ~70-line DrawPad** instead of react-signature-canvas: pointer events +
  quadratic smoothing, one fewer dependency.
- **In-memory rate limiter** (no Redis dependency) — swap for a shared store when
  running more than one server process.
- **Signature text capped at 60 chars**, fonts restricted to a curated list of six
  (server-enforced), drawn/uploaded signature images normalized to <=1200px PNG via
  sharp; base assets to <=1600px PNG.

## Garment system (supersedes the procedural mesh decision)

- **The extruded silhouette was reversed.** `ExtrudeGeometry` on a 2D outline
  produces a flat cutout with a bevelled edge — recognisably a shirt, but not
  close to what a customer compares us against (VirtualThreads and similar use
  real garment meshes with simulated wrinkles). The licensing and repo-size
  arguments were sound; the visual result was not acceptable. Models now load
  from `client/public/models/*.glb`, which are gitignored assets rather than
  committed binaries, so the "no binary in the repo" concern still holds.

- **`drawPanel()` was deliberately left untouched.** A real garment's UVs are
  spread across the whole mesh, not a flat 5:6 rectangle, so the obvious move —
  teaching the panel renderer about 3D — would have broken the WYSIWYG export
  guarantee that the whole print pipeline rests on. Instead `composeAtlas()`
  composites the two flat panel canvases into a declared rectangle of each
  garment's UV atlas (`GarmentDef.panels`). The export path still renders the
  exact same canvas at 3000x3600 and is still pixel-identical to the preview.

- **Panel rects are per-model data, not code.** Every garment's UV layout
  differs, so `garments.ts` carries `{x, y, w, h, flipX}` per side and the
  viewer ships a calibration overlay (`?uvdebug=1`) that draws a labelled grid
  into those rects. Dialling in a new model is editing four numbers, not
  writing a mapping function.

- **A missing .glb degrades to the old procedural mesh** rather than a blank
  canvas, and says so under the viewer. This keeps the app runnable before any
  models are purchased, and keeps a bad CDN response from breaking the studio.

- **The fabric normal map is generated in code** (`fabricNormalMap()`: a weave
  height field plus fibre noise, differentiated into tangent-space normals)
  rather than shipped as a texture. Flat cloth reads as plastic regardless of
  mesh quality, and this avoids another licensed binary. Models that ship their
  own normal/roughness maps keep them; the generated one is only the fallback.

- **Lighting is an in-scene `<Lightformer>` softbox rig**, not a drei
  `<Environment preset>`. The presets fetch an HDRI from a CDN at runtime,
  which is a third-party dependency on the critical render path for a
  self-hosted app. The rig costs a few lines and works offline.

- **`Ceremony.garment` is an enum mirrored from `GARMENTS`** in
  `client/src/three/garments.ts`. Adding a garment means adding its id in both
  places — deliberate duplication, so an unknown id is rejected at the API
  boundary instead of silently rendering the default.

- **The garment picker is owner-only.** `ShirtViewer` renders it only when
  `onGarmentChange` is passed, so the public sign page shows the owner's choice
  read-only. Signers pick a signature, not a garment.
