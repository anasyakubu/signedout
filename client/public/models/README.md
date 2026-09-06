# Garment models

Drop `.glb` files here with the filenames listed in `client/src/three/garments.ts`:

```
classic-tee.glb   oversized-tee.glb   boxy-tee.glb   long-sleeve.glb
crewneck.glb      hoodie.glb          polo.glb
```

Any garment without a file falls back to the old placeholder shape and says so
under the viewer. Nothing breaks.

## What to buy or download

You need a t-shirt mesh that is already UV-unwrapped with the front and back as
flat islands. Sources, cheapest first:

- **Sketchfab**, filtered to downloadable + CC0 or "CC-BY". Search "t-shirt
  lowpoly". Free, quality varies, check the UV layout in the preview.
- **Poly Haven / Quaternius** — CC0, small catalogues, worth a look first.
- **TurboSquid / CGTrader**, roughly $15–60 per garment. Read the licence: you
  need one that permits use in a commercial web app. "Editorial use only" is
  no good.
- **Marvelous Designer** if you want to simulate your own and own them
  outright. Steep learning curve, but it is what the mockup sites use, and the
  simulated wrinkles are most of the realism.

## Preparing a model

1. Open in Blender. Delete lights, cameras, and any mannequin.
2. Centre it at the origin, scale so the shoulders span about 2 units, feet of
   the hem at roughly y = -1. Apply the transforms.
3. Check the UV layout. You want front and back as separate flat islands.
4. Decimate to under ~40k triangles. Above that, mobile devices start to stutter.
5. Export glTF Binary. Tick **+Y up**, **Apply modifiers**, **Compression**
   (Draco). Aim for under 3 MB per garment.

## Calibrating the print panel

Load the studio with `?uvdebug=1` appended to the URL. A green grid marked
FRONT and BACK is drawn into the panel rectangles. Edit the numbers in
`garments.ts` until the grid sits square on the chest, filling the printable
area without spilling over the seams. Takes a couple of minutes per garment.

If the back grid reads mirrored, flip `flipX` on that rect.
