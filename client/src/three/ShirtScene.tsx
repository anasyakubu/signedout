import {
  Component,
  ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Lightformer, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { drawPanel, ensureFontsLoaded, PANEL_RATIO } from './drawPanel';
import { GARMENTS, GarmentDef, GarmentId, getGarment } from './garments';
import { composeAtlas, fabricNormalMap } from './garmentTexture';
import { BaseAsset, SignatureData } from '../lib/types';

const TEX_W = 1024;
const TEX_H = Math.round(TEX_W * PANEL_RATIO);

// ---------------------------------------------------------------------------
// Fallback mesh
// ---------------------------------------------------------------------------
// The old extruded silhouette, kept only for when a .glb is missing or fails
// to load. It is deliberately plain: it should read as "model not installed",
// not as a shipping product.

function shirtSilhouette(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0.72);
  s.lineTo(-0.98, 0.55);
  s.lineTo(-0.8, 0.18);
  s.lineTo(-0.55, 0.3);
  s.lineTo(-0.55, -0.85);
  s.lineTo(0.55, -0.85);
  s.lineTo(0.55, 0.3);
  s.lineTo(0.8, 0.18);
  s.lineTo(0.98, 0.55);
  s.lineTo(0.5, 0.72);
  s.quadraticCurveTo(0, 0.5, -0.5, 0.72);
  s.closePath();
  return s;
}

function ProceduralGarment({ texture }: { texture: THREE.CanvasTexture }) {
  const geometry = useMemo(() => {
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

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        map={texture}
        normalMap={fabricNormalMap()}
        normalScale={new THREE.Vector2(0.4, 0.4)}
        roughness={0.82}
        metalness={0}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Real garment
// ---------------------------------------------------------------------------

function GarmentModel({ def, texture }: { def: GarmentDef; texture: THREE.CanvasTexture }) {
  const { scene } = useGLTF(def.model as string);

  // Clone so two viewers on one page (studio + preview) never fight over
  // materials, and so we can dispose ours without touching drei's cache.
  const model = useMemo(() => scene.clone(true), [scene]);

  const materials = useMemo(() => {
    const made: THREE.MeshStandardMaterial[] = [];
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = (
        Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      ) as THREE.MeshStandardMaterial | undefined;

      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        // Keep the model's own baked fabric detail when the artist supplied
        // it; fall back to the generated weave when they didn't.
        normalMap: source?.normalMap ?? fabricNormalMap(),
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughnessMap: source?.roughnessMap ?? null,
        aoMap: source?.aoMap ?? null,
        aoMapIntensity: 0.8,
        roughness: source?.roughnessMap ? 1 : 0.78,
        metalness: 0,
        side: THREE.DoubleSide,
      });

      mesh.material = mat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      made.push(mat);
    });
    return made;
  }, [model, texture]);

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  return <primitive object={model} scale={def.fit} />;
}

/** A missing or corrupt .glb drops to the fallback mesh instead of a blank canvas. */
class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Turntable({ target, children }: { target: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y += (target - group.current.rotation.y) * 0.12;
  });
  return <group ref={group}>{children}</group>;
}

// ---------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------

export interface ShirtViewerProps {
  shirtColor: string;
  assets: BaseAsset[];
  signatures: SignatureData[];
  className?: string;
  /** Defaults to the classic tee when the ceremony has no garment saved yet. */
  garment?: GarmentId;
  /** Omit to hide the picker — the public sign page shows the owner's choice, read-only. */
  onGarmentChange?: (id: GarmentId) => void;
}

export default function ShirtViewer({
  shirtColor,
  assets,
  signatures,
  className,
  garment,
  onGarmentChange,
}: ShirtViewerProps) {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [modelMissing, setModelMissing] = useState(false);

  const def = getGarment(garment);
  const debugUV = useMemo(
    () => new URLSearchParams(window.location.search).has('uvdebug'),
    []
  );

  useEffect(() => setModelMissing(false), [def.id]);

  const canvases = useMemo(() => {
    const make = (w: number, h: number) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };
    return {
      front: make(TEX_W, TEX_H),
      back: make(TEX_W, TEX_H),
      atlas: make(def.atlas, def.atlas),
    };
  }, [def.atlas]);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvases.atlas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = true;
    t.anisotropy = 8;
    return t;
  }, [canvases]);

  useEffect(() => () => texture.dispose(), [texture]);

  // Repaint both panels, composite them into the atlas, flag the texture.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFontsLoaded();
      for (const s of ['front', 'back'] as const) {
        await drawPanel(canvases[s], { shirtColor, assets, signatures, side: s });
        if (cancelled) return;
      }
      composeAtlas(canvases.atlas, def, canvases, shirtColor, debugUV);
      texture.needsUpdate = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [shirtColor, assets, signatures, canvases, texture, def, debugUV]);

  return (
    <div className={className}>
      <div className="relative aspect-[4/5] w-full border border-line bg-white">
        <Canvas
          shadows
          camera={{ position: def.camera.position, fov: def.camera.fov }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          {/* Softbox rig built in-scene: no HDRI download, works offline. */}
          <Environment resolution={256}>
            <Lightformer intensity={2.2} position={[0, 2, 3]} scale={[6, 4, 1]} />
            <Lightformer intensity={1.1} position={[-4, 1, 2]} scale={[4, 6, 1]} />
            <Lightformer intensity={0.9} position={[4, 0, -2]} scale={[4, 6, 1]} />
            <Lightformer intensity={0.4} position={[0, -3, 0]} scale={[8, 4, 1]} />
          </Environment>
          <ambientLight intensity={0.25} />
          <directionalLight
            position={[2.5, 4, 3]}
            intensity={1.4}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />

          <Turntable target={side === 'front' ? 0 : Math.PI}>
            <Suspense fallback={<ProceduralGarment texture={texture} />}>
              {def.model && !modelMissing ? (
                <ModelBoundary
                  fallback={<ProceduralGarment texture={texture} />}
                  onError={() => setModelMissing(true)}
                >
                  <GarmentModel def={def} texture={texture} />
                </ModelBoundary>
              ) : (
                <ProceduralGarment texture={texture} />
              )}
            </Suspense>
          </Turntable>

          <ContactShadows
            position={[0, -1.05, 0]}
            opacity={0.35}
            scale={6}
            blur={2.4}
            far={2}
          />
          <OrbitControls
            enablePan={false}
            minDistance={1.8}
            maxDistance={5}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI - Math.PI / 6}
            target={def.camera.target}
          />
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

      {onGarmentChange && (
        <div className="mt-3 flex flex-wrap gap-2">
          {GARMENTS.map((g) => (
            <button
              key={g.id}
              onClick={() => onGarmentChange(g.id)}
              title={g.hint}
              className={`border px-3 py-1.5 text-sm ${
                g.id === def.id
                  ? 'border-laurel bg-laurel text-white'
                  : 'border-line text-ink hover:border-laurel'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-center text-xs text-stone">
        {modelMissing
          ? `No model installed for ${def.label} — showing the placeholder shape. Drop the .glb into client/public/models/.`
          : 'Drag to rotate. Scroll to zoom.'}
      </p>
    </div>
  );
}

GARMENTS.forEach((g) => {
  if (g.model) useGLTF.preload(g.model);
});
