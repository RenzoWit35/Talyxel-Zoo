import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, ChartColumn, Heart, PenLine, Users } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../api/client';
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
    text: 'Post screenshots of what you built or ask your followers what to do next. They like with a double-tap and answer in the comments.',
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

export function Landing() {
  const explore = useQuery({ queryKey: ['zoos', 'explore', ''], queryFn: () => api.explore() });
  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="chip chip-brand">For Planet Zoo & Planet Coaster builders</span>
            <h1>
              Plan your dream park.
              <br />
              <em>Let your friends pick what's next.</em>
            </h1>
            <p>
              Talyxel Park is a planning board for your zoos and theme parks: sketch every habitat, ride, utility and walk route from above, fill it
              with screenshots, notes and stats, then share updates and questions with the builders you follow.
            </p>
            <div className="row row-wrap">
              <Link to="/register" className="btn btn-primary btn-lg">
                Start planning <ArrowRight />
              </Link>
              <Link to="/explore" className="btn btn-lg">
                Explore parks
              </Link>
              <Link to="/guide" className="btn btn-lg btn-ghost">
                <BookOpen /> How it works
              </Link>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <ZooThumbnail width={300} height={200} shapes={DEMO} className="hero-map" />
            <div className="hero-hover card">
              <div className="hero-hover-photo" />
              <strong>Savanna Pride</strong>
              <span className="subtle">West African Lion · 8,120 m²</span>
              <div className="row" style={{ gap: 6 }}>
                <span className="chip chip-dot" style={{ ['--dot' as string]: '#d38a2e' }}>
                  Building
                </span>
                <span className="chip">Grassland</span>
              </div>
            </div>
            <div className="hero-survey card">
              <strong>What should I add next?</strong>
              <div className="hero-bar" style={{ ['--w' as string]: '62%' }}>
                <span>Red Panda</span>
                <span>62%</span>
              </div>
              <div className="hero-bar" style={{ ['--w' as string]: '38%' }}>
                <span>Aquarium</span>
                <span>38%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page">
        <div className="features">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature">
              <div className="empty-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p className="muted">{f.text}</p>
            </div>
          ))}
        </div>

        {!!explore.data?.length && (
          <>
            <div className="page-header" style={{ marginTop: 56 }}>
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
          </>
        )}
      </section>
    </>
  );
}
