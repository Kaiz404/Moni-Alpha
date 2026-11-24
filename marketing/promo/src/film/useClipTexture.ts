import {useEffect, useLayoutEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {NoReactInternals} from 'remotion/no-react';
import * as THREE from 'three';

const loader = new THREE.TextureLoader();

/** The clip's frame at `time` seconds as a texture. Unlike useOffthreadVideoTexture it takes an explicit time, so shots can cut, speed up and freeze. */
export const useClipTexture = (clip: string, time: number) => {
  const url = NoReactInternals.getOffthreadVideoSource({
    src: staticFile(`clips/${clip}.mp4`),
    currentTime: Math.round(time * 60) / 60,
    transparent: false,
    toneMapped: true,
  });
  const [loaded, setLoaded] = useState<{url: string; texture: THREE.Texture} | null>(null);

  useLayoutEffect(() => {
    const handle = delayRender(`clip ${clip} at ${time.toFixed(3)}`);
    let cancelled = false;
    loader
      .loadAsync(url)
      .then((t) => {
        if (cancelled) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        setLoaded({url, texture: t});
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      cancelled = true;
      continueRender(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => () => loaded?.texture.dispose(), [loaded]);
  return {texture: loaded?.texture ?? null, ready: loaded?.url === url};
};
