import { encode } from 'uqr';
import { Cat } from '@/components/brand';

const FINDER = 7;

/**
 * The sign-in link as a QR, drawn the W2-Auth way: rounded finder eyes, square modules, the Moni tile in
 * the middle. Error correction H leaves room for the tile.
 */
export function QrCode({ value, size }: { value: string; size: number }) {
  const { data, size: n } = encode(value, { ecc: 'H', border: 0 });
  const logo = Math.ceil(n * 0.24) | 1;
  const lo = (n - logo) / 2;
  const inFinder = (x: number, y: number) =>
    (x < FINDER && y < FINDER) || (x >= n - FINDER && y < FINDER) || (x < FINDER && y >= n - FINDER);
  const inLogo = (x: number, y: number) => x >= lo && x < lo + logo && y >= lo && y < lo + logo;

  let modules = '';
  data.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on && !inFinder(x, y) && !inLogo(x, y)) modules += `M${x} ${y}h1v1h-1z`;
    }),
  );
  const eyes = [
    [0, 0],
    [n - FINDER, 0],
    [0, n - FINDER],
  ];

  return (
    <div className="qr-box" style={{ width: size, height: size }} data-qr-value={value}>
      <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="Sign-in code">
        <path d={modules} fill="currentColor" />
        {eyes.map(([x, y]) => (
          <g key={`${x}-${y}`} fill="none" stroke="currentColor" shapeRendering="geometricPrecision">
            <rect x={x! + 0.5} y={y! + 0.5} width={6} height={6} rx={1.6} strokeWidth={1} />
            <rect x={x! + 2} y={y! + 2} width={3} height={3} rx={0.8} fill="currentColor" stroke="none" />
          </g>
        ))}
      </svg>
      <span className="qr-logo">
        <Cat size={Math.round((size * logo) / n) - 8} ground="deep" tile id="qr-logo" />
      </span>
    </div>
  );
}
