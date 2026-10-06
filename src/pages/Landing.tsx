import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, ChartColumn, Heart, PenLine, RollerCoaster, Users } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../api/client';
import { LogoMark } from '../components/ui';
import { ZooCard } from '../components/ZooCard';
import { ZooThumbnail } from '../components/ZooThumbnail';
import { DEMO_SHAPES as DEMO } from '../lib/demo';

const FEATURES = [
  {
    icon: <PenLine />,
    title: 'Draw it top-down',
    text: 'Habitats, rides, utilities, walk routes and areas of interest on a metre grid — or traced over a screenshot of your park. Every shape keeps its photos and notes.',
  },
  {
    icon: <Heart />,
    title: 'Share and ask',
    text: 'Post screenshots of what you built or ask your followers what to do next. They like with a double-click and answer in the comments.',
  },
  {
    icon: <ChartColumn />,
    title: 'Publish, poll and track',
    text: 'Publish your plan with a survey about what to build next, and keep your in-game stats so friends can watch the park grow.',
  },
  {
    icon: <Users />,
    title: 'Follow your friends',
    text: 'A feed of the builders you follow, their parks from above on every profile, and a bell for new likes, answers and followers.',
  },
];

/** A hand-drawn arrow pointing at the main button. */
function DoodleArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 150 70" aria-hidden="true">
      <path d="M8 12 C 30 4, 64 6, 86 22 C 104 35, 114 48, 128 58" />
      <path d="M112 56 L 130 60 L 124 42" />
    </svg>
  );
}

/** Leaf silhouettes for the bottom corners of the hero. */
function Leaves({ className }: { className: string }) {
  const leaf = 'M0 0 C 30 -46, 96 -62, 150 -58 C 128 -10, 70 22, 0 0 Z';
  return (
    <svg className={className} viewBox="0 0 260 220" aria-hidden="true">
      <g transform="translate(10 210) rotate(-58)">
        <path d={leaf} />
        <path d="M0 0 C 50 -24, 100 -40, 148 -57" className="vein" />
      </g>
      <g transform="translate(40 214) rotate(-24)">
        <path d={leaf} />
        <path d="M0 0 C 50 -24, 100 -40, 148 -57" className="vein" />
      </g>
      <g transform="translate(0 200) rotate(-88) scale(0.8)">
        <path d={leaf} />
        <path d="M0 0 C 50 -24, 100 -40, 148 -57" className="vein" />
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
  return (
    <svg className="lp-skyline" viewBox="0 0 1440 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {/* coaster: track, then supports down to the ground */}
      <path d="M0 132 C 60 132, 90 40, 150 40 C 210 40, 220 118, 270 118 C 320 118, 330 70, 380 70 C 430 70, 440 128, 520 128" className="track" />
      {[40, 90, 150, 200, 250, 300, 350, 400, 450].map((x) => (
        <line key={x} x1={x} x2={x} y1={x === 150 ? 44 : x === 90 ? 64 : x === 200 ? 70 : x === 250 ? 112 : x === 300 ? 104 : x === 350 ? 78 : x === 400 ? 74 : x === 450 ? 112 : 128} y2="160" className="support" />
      ))}
      {/* loop */}
      <path d="M560 160 L 560 96 C 560 40, 640 40, 640 96 C 640 128, 600 132, 590 110 L 700 110" className="track" />
      {/* circus tent */}
      <path d="M720 160 L 740 112 L 790 88 L 840 112 L 860 160 Z" />
      <line x1="790" x2="790" y1="88" y2="70" className="support" />
      <path d="M790 70 L 806 76 L 790 82 Z" />
      {/* drop tower */}
      <rect x="930" y="26" width="12" height="134" />
      <rect x="918" y="70" width="36" height="12" rx="3" />
      <path d="M926 26 L 936 6 L 946 26 Z" />
      {/* ferris wheel */}
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
      {/* trees */}
      {[[1240, 136, 22], [1272, 128, 30], [1310, 140, 18], [1350, 132, 26], [1400, 138, 22], [1430, 130, 28], [660, 138, 18], [690, 142, 14], [880, 140, 16], [990, 136, 22], [1020, 142, 16]].map(([x, y, r]) => (
        <circle key={`${x}`} cx={x} cy={y} r={r} />
      ))}
      <rect x="0" y="156" width="1440" height="14" />
    </svg>
  );
}

export function Landing() {
  const explore = useQuery({ queryKey: ['zoos', 'explore', ''], queryFn: () => api.explore() });
  return (
    <div className="lp">
      <section className="lp-hero">
        <Leaves className="lp-leaves left" />
        <Leaves className="lp-leaves right" />
        <div className="lp-hero-inner">
          <div className="lp-copy">
            <span className="lp-pill">For Planet Zoo &amp; Planet Coaster builders</span>
            <h1>
              Plan your dream park.
              <br />
              Let your friends pick what's next.
            </h1>
            <p>
              Talyxel Park is a planning board for your zoos and theme parks: sketch every habitat, ride, utility and walk route from above, fill it
              with screenshots, notes and stats, then share updates and questions with the builders you follow.
            </p>
            <div className="lp-actions">
              <DoodleArrow className="lp-doodle" />
              <Link to="/register" className="btn btn-lg lp-cta">
                Start planning <ArrowRight />
              </Link>
              <Link to="/explore" className="btn btn-lg lp-secondary">
                Explore parks
              </Link>
              <Link to="/guide" className="btn btn-lg btn-ghost lp-ghost">
                <BookOpen /> How it works
              </Link>
            </div>
          </div>

          <div className="lp-art" aria-hidden="true">
            <div className="lp-iso">
              <ZooThumbnail width={300} height={200} shapes={DEMO} className="lp-iso-map" fit="meet" />
            </div>
            <div className="lp-glass lp-tag">
              <span className="lp-tag-dot" />
              <span>
                <strong>Savanna Pride</strong>
                <small>West African Lion · 8,120 m²</small>
              </span>
              <span className="lp-chip">Building</span>
            </div>
            <div className="lp-glass lp-coaster">
              <span className="lp-coaster-icon">
                <RollerCoaster />
              </span>
              <span>
                <strong>Thunderbolt</strong>
                <small>Wooden coaster · test runs</small>
              </span>
              <span className="lp-progress">
                <span style={{ width: '82%' }} />
              </span>
            </div>
            <div className="lp-glass lp-poll">
              <strong>What should I add next?</strong>
              <div className="lp-bar is-mine" style={{ ['--w' as string]: '62%' }}>
                <span>Red Panda</span>
                <span>62%</span>
              </div>
              <div className="lp-bar" style={{ ['--w' as string]: '38%' }}>
                <span>Aquarium</span>
                <span>38%</span>
              </div>
              <small>24 builders voted</small>
            </div>
          </div>
        </div>

        <div className="lp-features">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="lp-feature">
              <span className={`lp-feature-icon${i % 2 ? ' is-lime' : ''}`}>{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {!!explore.data?.length && (
        <section className="page lp-fresh">
          <div className="page-header">
            <div>
              <h2>Freshly published</h2>
              <p>Zoos and theme parks the community shared recently.</p>
            </div>
            <Link to="/explore" className="btn btn-sm">
              See all <ArrowRight />
            </Link>
          </div>
          <div className="grid-cards">
            {explore.data.slice(0, 6).map((z) => (
              <ZooCard key={z.id} zoo={z} />
            ))}
          </div>
        </section>
      )}

      <footer className="lp-footer">
        <Skyline />
        <div className="lp-footer-bar">
          <span className="lp-footer-brand">
            <LogoMark className="lp-footer-logo" /> Talyxel Park
          </span>
          <nav aria-label="Footer">
            <Link to="/explore">Explore</Link>
            <Link to="/people">Builders</Link>
            <Link to="/guide">How it works</Link>
            <Link to="/register">Start your park</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
