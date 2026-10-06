import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, ChartColumn, Heart, PenLine, RollerCoaster, Users } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../api/client';
import { DoodleArrow, Leaves } from '../components/decor';
import { IsoPark } from '../components/IsoPark';
import { ZooCard } from '../components/ZooCard';

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
              <IsoPark className="lp-iso-map" />
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

    </div>
  );
}
