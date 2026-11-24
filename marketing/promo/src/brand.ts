import {staticFile} from 'remotion';

export const cream = '#f6f2e9';
export const creamDeep = '#ece5d6';
export const ink = '#17181a';
export const deepMint = '#236b47';
export const mint = '#6fd08c';

export const FPS = 30;

const font = new FontFace('Funnel Display', `url(${staticFile('funnel-display-latin.woff2')}) format('woff2')`, {weight: '300 800'});
document.fonts.add(font);
export const fontReady = font.load();

import {continueRender, delayRender} from 'remotion';
import {useState} from 'react';

export const useBrandFont = () => {
  const [handle] = useState(() => {
    const h = delayRender('font');
    fontReady.then(() => continueRender(h));
    return h;
  });
  return handle;
};
