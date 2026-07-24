import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { drawPanel, ensureFontsLoaded, PANEL_RATIO } from './drawPanel';
import { BaseAsset, SignatureData } from '../lib/types';

// Procedural shirt: a silhouette Shape extruded for the body (flat shirt
// color) with two shaped panel meshes floating just off the front and back
// faces carrying the CanvasTextures. No licensed .glb needed — recognizably a
// shirt, freely rotatable, and the signing surface stays a plain 2D canvas
// exactly as the brief's Section 7 prescribes.

const TEX_W = 1024;
const TEX_H = Math.round(TEX_W * PANEL_RATIO);

function shirtSilhouette(): THREE.Shape {
  const s = new THREE.Shape();
  // Units roughly in "shirt widths"; origin at chest center.
  s.moveTo(-0.5, 0.72); // left neck-shoulder
  s.lineTo(-0.98, 0.55); // left shoulder tip
  s.lineTo(-0.8, 0.18); // left underarm (sleeve edge)
  s.lineTo(-0.55, 0.3); // armpit
  s.lineTo(-0.55, -0.85); // left hem
  s.lineTo(0.55, -0.85); // right hem
  s.lineTo(0.55, 0.3); // right armpit
  s.lineTo(0.8, 0.18); // right underarm
  s.lineTo(0.98, 0.55); // right shoulder tip
  s.lineTo(0.5, 0.72); // right neck-shoulder
  s.quadraticCurveTo(0, 0.5, -0.5, 0.72); // neckline scoop
  s.closePath();
  return s;
}

function panelShape(): THREE.Shape {
  // The printable panel: torso rectangle inset from the silhouette, matching
  // the 5:6 canvas the signatures are placed on.
  const w = 0.98; // width 0.98 shirt units => panel height 0.98 * 6/5
  const h = w * PANEL_RATIO;
  const top = 0.42;
  const s = new THREE.Shape();
  s.moveTo(-w / 2, top);
  s.lineTo(w / 2, top);
  s.lineTo(w / 2, top - h);
  s.lineTo(-w / 2, top - h);
  s.closePath();
  return s;
}

/** ShapeGeometry UVs live in shape coordinates; remap them to 0..1. */
function normalizeUVs(geometry: THREE.BufferGeometry, flipX = false): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    let u = (pos.getX(i) - box.min.x) / size.x;
    const v = (pos.getY(i) - box.min.y) / size.y;
    if (flipX) u = 1 - u;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geometry;
}

interface ShirtProps {
  shirtColor: string;
  frontTexture: THREE.CanvasTexture;
  backTexture: THREE.CanvasTexture;
  targetRotation: number;
}

function Shirt({ shirtColor, frontTexture, backTexture, targetRotation }: ShirtProps) {
  const group = useRef<THREE.Group>(null);

  const bodyGeometry = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(shirtSilhouette(), {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -0.11);
    return geo;
  }, []);

  const frontGeometry = useMemo(() => normalizeUVs(new THREE.ShapeGeometry(panelShape())), []);
  const backGeometry = useMemo(() => normalizeUVs(new THREE.ShapeGeometry(panelShape()), true), []);

  useFrame(() => {
    if (!group.current) return;
    // Ease toward the requested side; free drag still works via OrbitControls
    // on the camera, this only turns the shirt itself for the toggle buttons.
    group.current.rotation.y += (targetRotation - group.current.rotation.y) * 0.12;
  });

  return (
    <group ref={group}>
      <mesh geometry={bodyGeometry}>
        <meshStandardMaterial color={shirtColor} roughness={0.85} metalness={0} />
      </mesh>
      <mesh geometry={frontGeometry} position={[0, 0, 0.145]}>
        <meshStandardMaterial map={frontTexture} roughness={0.85} metalness={0} />
      </mesh>
      <mesh geometry={backGeometry} position={[0, 0, -0.145]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial map={backTexture} roughness={0.85} metalness={0} />
      </mesh>
    </group>
  );
}

export interface ShirtViewerProps {
  shirtColor: string;
  assets: BaseAsset[];
  signatures: SignatureData[];
  className?: string;
}

export default function ShirtViewer({
  shirtColor,
  assets,
  signatures,
  className,
}: ShirtViewerProps) {
  const [side, setSide] = useState<'front' | 'back'>('front');

  const canvases = useMemo(() => {
    const make = () => {
      const c = document.createElement('canvas');
      c.width = TEX_W;
      c.height = TEX_H;
      return c;
    };
    return { front: make(), back: make() };
  }, []);

  const textures = useMemo(() => {
    const front = new THREE.CanvasTexture(canvases.front);
    const back = new THREE.CanvasTexture(canvases.back);
    front.colorSpace = THREE.SRGBColorSpace;
    back.colorSpace = THREE.SRGBColorSpace;
    return { front, back };
  }, [canvases]);

  // Redraw both panel canvases whenever the design or signatures change, then
  // flag the textures — the 3D view updates instantly, no raycasting anywhere.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFontsLoaded();
      for (const s of ['front', 'back'] as const) {
        await drawPanel(canvases[s], { shirtColor, assets, signatures, side: s });
        if (cancelled) return;
        textures[s].needsUpdate = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shirtColor, assets, signatures, canvases, textures]);

  return (
    <div className={className}>
      <div className="relative aspect-[4/5] w-full border border-line bg-white">
        <Canvas camera={{ position: [0, 0, 3.1], fov: 40 }}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 3, 4]} intensity={0.9} />
          <directionalLight position={[-2, 1, -4]} intensity={0.5} />
          <Shirt
            shirtColor={shirtColor}
            frontTexture={textures.front}
            backTexture={textures.back}
            targetRotation={side === 'front' ? 0 : Math.PI}
          />
          <OrbitControls enablePan={false} minDistance={1.8} maxDistance={5} />
        </Canvas>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 border border-line bg-white">
          {(['front', 'back'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`px-4 py-1.5 text-sm font-semibold ${
                side === s ? 'bg-laurel text-white' : 'text-ink hover:text-laurel'
              }`}
            >
              {s === 'front' ? 'Front' : 'Back'}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-stone">Drag to rotate. Scroll to zoom.</p>
    </div>
  );
}
