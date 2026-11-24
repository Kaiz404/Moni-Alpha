import {useLayoutEffect, useMemo, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import {continueRender, delayRender, useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {deepMint, ink} from './brand';
import {useClipTexture} from './film/useClipTexture';

export const SCREEN_W = 1;
export const SCREEN_H = 2400 / 1080;
const BEZEL = 0.045;
const BODY_W = SCREEN_W + BEZEL * 2;
export const BODY_H = SCREEN_H + BEZEL * 2;
export const DEPTH = 0.09;

const roundedRect = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

const screenGeometry = () => {
  const g = new THREE.ShapeGeometry(roundedRect(SCREEN_W, SCREEN_H, 0.1), 16);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / SCREEN_W + 0.5, pos.getY(i) / SCREEN_H + 0.5);
  }
  return g;
};

export const Phone = ({clip, time}: {clip: string; time: number}) => {
  const {texture, ready} = useClipTexture(clip, time);
  const body = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedRect(BODY_W - 0.04, BODY_H - 0.04, 0.13), {
      depth: DEPTH - 0.04,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 6,
      curveSegments: 24,
    });
    g.translate(0, 0, -(DEPTH - 0.04) / 2);
    return g;
  }, []);
  const screen = useMemo(screenGeometry, []);
  const back = useMemo(() => new THREE.ShapeGeometry(roundedRect(BODY_W - 0.06, BODY_H - 0.06, 0.12), 16), []);
  const frame = useCurrentFrame();
  const advance = useThree((s) => s.advance);
  const pending = useRef<number | null>(null);
  useLayoutEffect(() => {
    pending.current = delayRender(`screen frame ${frame}`);
  }, [frame]);
  useLayoutEffect(() => {
    if (!texture) return;
    advance(performance.now());
    if (!ready || pending.current === null) return;
    const h = pending.current;
    pending.current = null;
    requestAnimationFrame(() => continueRender(h));
  }, [texture, ready, advance, frame]);

  return (
    <group>
      <mesh geometry={body}>
        <meshStandardMaterial color={ink} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh geometry={screen} position={[0, 0, DEPTH / 2 + 0.001]}>
        {texture ? <meshBasicMaterial key="video" map={texture} toneMapped={false} /> : <meshBasicMaterial key="empty" color="black" />}
      </mesh>
      <mesh geometry={back} position={[0, 0, -DEPTH / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial color={deepMint} metalness={0.2} roughness={0.5} />
      </mesh>
    </group>
  );
};
