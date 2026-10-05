import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Images, PenLine, Users, Vote } from 'lucide-react';
import { Link } from 'react-router';
import type { ZooShape } from '../../shared/types';
import { api } from '../api/client';
import { ZooCard } from '../components/ZooCard';
import { ZooThumbnail } from '../components/ZooThumbnail';

const DEMO: ZooShape[] = [
  { kind: 'path', color: '#bfa98a', points: [[0, 92], [300, 92], [300, 108], [0, 108]] },
  { kind: 'path', color: '#bfa98a', points: [[142, 0], [158, 0], [158, 200], [142, 200]] },
  { kind: 'habitat', color: '#c79a3c', points: [[12, 10], [128, 12], [134, 80], [60, 84], [14, 70]] },
  { kind: 'water', color: '#4c98cc', points: [[70, 40], [100, 34], [112, 54], [86, 66], [66, 58]] },
  { kind: 'habitat', color: '#5f9e5c', points: [[170, 12], [288, 10], [290, 82], [172, 80]] },
  { kind: 'habitat', color: '#3e7a5a', points: [[14, 120], [128, 118], [130, 190], [70, 192], [16, 176]] },
  { kind: 'facility', color: '#8a78c4', points: [[172, 122], [214, 122], [214, 152], [172, 152]] },
  { kind: 'exhibit', color: '#d9733f', points: [[226, 120], [288, 122], [286, 188], [228, 186]] },
  { kind: 'scenery', color: '#93b85c', points: [[172, 162], [214, 162], [214, 190], [172, 190]] },
  { kind: 'interest', color: '#d6517d', points: [[226, 30], [270, 30], [270, 64], [226, 64]] },
  { kind: 'route', color: '#e0a526', points: [[20, 100], [96, 100], [120, 112], [150, 100], [230, 100], [250, 50]] },
];

const FEATURES = [
  { icon: <PenLine />, title: 'Draw it top-down', text: 'Trace habitats, coasters and themed areas on a grid — or over a screenshot of your park — with snapping, rectangles and freeform shapes.' },
  { icon: <Images />, title: 'Hover for the story', text: 'Every habitat or ride holds its own photo collection, species or ride type, biome or theme, and notes. Hover a shape to see it all.' },
  { icon: <Vote />, title: 'Publish with a survey', text: 'Share your plan and ask the community what to build next. Visitors vote or suggest their own ideas.' },
  { icon: <Users />, title: 'Follow your friends', text: 'Follow other builders and get a feed of their new habitats, rides, photos and surveys as they happen.' },
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
              Talyxel Park is a planning board for your zoos and theme parks: sketch every habitat, coaster and themed area from above, fill it with
              screenshots and notes, then publish it with a survey and follow the builds of the people you like.
            </p>
            <div className="row row-wrap">
              <Link to="/register" className="btn btn-primary btn-lg">
                Start planning <ArrowRight />
              </Link>
              <Link to="/explore" className="btn btn-lg">
                Explore parks
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
