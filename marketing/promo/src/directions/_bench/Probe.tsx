import {useState} from 'react';
import {AbsoluteFill, continueRender, delayRender} from 'remotion';

const probe = () => {
  const c = document.createElement('canvas');
  const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
  if (!gl) return 'NO WEBGL CONTEXT';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const v = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  return `${v} | ${r}`;
};

export const Probe = () => {
  const [h] = useState(() => delayRender('probe'));
  const [text] = useState(() => {
    const t = probe();
    console.log('GLPROBE ' + t);
    continueRender(h);
    return t;
  });
  return <AbsoluteFill style={{background: 'white', fontSize: 28, padding: 40}}>{text}</AbsoluteFill>;
};
