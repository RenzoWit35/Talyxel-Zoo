import { Link } from 'react-router';
import { LogoMark } from './ui';

/** A hand-drawn arrow pointing at a call to action. */
export function DoodleArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 150 70" aria-hidden="true">
      <path d="M8 12 C 30 4, 64 6, 86 22 C 104 35, 114 48, 128 58" />
      <path d="M112 56 L 130 60 L 124 42" />
    </svg>
  );
}

/** Leaf silhouettes for the bottom corners of a navy band. */
export function Leaves({ className }: { className: string }) {
  const leaf = 'M0 0 C 30 -46, 96 -62, 150 -58 C 128 -10, 70 22, 0 0 Z';
  const vein = 'M0 0 C 50 -24, 100 -40, 148 -57';
  return (
    <svg className={className} viewBox="0 0 260 220" aria-hidden="true">
      <g transform="translate(10 210) rotate(-58)">
        <path d={leaf} />
        <path d={vein} className="vein" />
      </g>
      <g transform="translate(40 214) rotate(-24)">
        <path d={leaf} />
        <path d={vein} className="vein" />
      </g>
      <g transform="translate(0 200) rotate(-88) scale(0.8)">
        <path d={leaf} />
        <path d={vein} className="vein" />
      </g>
      <g transform="translate(70 220) rotate(4) scale(0.7)">
        <path d={leaf} />
      </g>
    </svg>
  );
}

/** Roller coasters, a drop tower, a tent and a Ferris wheel along the bottom of the page. */
function Skyline() {
  const spokes = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);
  const supports: [number, number][] = [
    [40, 128],
    [90, 64],
    [150, 44],
    [200, 70],
    [250, 112],
    [300, 104],
    [350, 78],
    [400, 74],
    [450, 112],
  ];
  const trees: [number, number, number][] = [
    [1240, 136, 22],
    [1272, 128, 30],
    [1310, 140, 18],
    [1350, 132, 26],
    [1400, 138, 22],
    [1430, 130, 28],
    [660, 138, 18],
    [690, 142, 14],
    [880, 140, 16],
    [990, 136, 22],
    [1020, 142, 16],
  ];
  return (
    <svg className="lp-skyline" viewBox="0 0 1440 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M0 132 C 60 132, 90 40, 150 40 C 210 40, 220 118, 270 118 C 320 118, 330 70, 380 70 C 430 70, 440 128, 520 128" className="track" />
      {supports.map(([x, y]) => (
        <line key={x} x1={x} x2={x} y1={y} y2="160" className="support" />
      ))}
      <path d="M560 160 L 560 96 C 560 40, 640 40, 640 96 C 640 128, 600 132, 590 110 L 700 110" className="track" />
      <path d="M720 160 L 740 112 L 790 88 L 840 112 L 860 160 Z" />
      <line x1="790" x2="790" y1="88" y2="70" className="support" />
      <path d="M790 70 L 806 76 L 790 82 Z" />
      <rect x="930" y="26" width="12" height="134" />
      <rect x="918" y="70" width="36" height="12" rx="3" />
      <path d="M926 26 L 936 6 L 946 26 Z" />
      <g transform="translate(1130 82)">
        <circle r="66" className="wheel" />
        <circle r="54" className="wheel thin" />
        {spokes.map((a) => (
          <line key={a} x1="0" y1="0" x2={Math.cos(a) * 66} y2={Math.sin(a) * 66} className="spoke" />
        ))}
        {spokes.map((a) => (
          <rect key={`g${a}`} x={Math.cos(a) * 66 - 6} y={Math.sin(a) * 66 + 2} width="12" height="10" rx="2" />
        ))}
        <circle r="8" />
        <path d="M0 0 L -40 78 L -30 78 L 0 14 L 30 78 L 40 78 Z" />
      </g>
      {trees.map(([x, y, r]) => (
        <circle key={x} cx={x} cy={y} r={r} />
      ))}
      <rect x="0" y="156" width="1440" height="14" />
    </svg>
  );
}

/** The footer on every page: a skyline of rides above a navy bar. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Skyline />
      <div className="site-footer-bar">
        <span className="site-footer-brand">
          <LogoMark className="site-footer-logo" /> Talyxel Park
        </span>
        <nav aria-label="Footer">
          <Link to="/explore">Explore</Link>
          <Link to="/people">Builders</Link>
          <Link to="/guide">How it works</Link>
        </nav>
      </div>
    </footer>
  );
}
