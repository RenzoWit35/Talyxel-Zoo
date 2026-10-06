import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Heart, MessageCircle, MessageCircleQuestion, Send, TrendingUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { HABITAT_STATUSES, KIND_META, type HabitatKind } from '../../shared/constants';
import { api } from '../api/client';
import { useMe } from '../auth';
import { KindIcon } from '../components/KindIcon';
import { StatusChip } from '../components/map/HoverCard';
import { ParkBadge } from '../components/ParkType';
import { useToast } from '../components/toast';
import { ZooThumbnail } from '../components/ZooThumbnail';
import { DEMO_SHAPES } from '../lib/demo';
import { setPlannerTourSeen } from './planner/PlannerTour';

const SECTIONS = [
  ['start', 'Your first park'],
  ['draw', 'Drawing the map'],
  ['things', 'What you can add'],
  ['details', 'Details and photos'],
  ['board', 'The planning board'],
  ['stats', 'Park statistics'],
  ['publish', 'Publishing and surveys'],
  ['feed', 'Posts, likes and answers'],
  ['people', 'Following and notifications'],
  ['privacy', 'Who sees what'],
] as const;

const ADDABLE: { kind: HabitatKind; text: string }[] = [
  { kind: 'habitat', text: 'Animal enclosures in a zoo. Give each its species and biome; the area shows how much room the animals get.' },
  { kind: 'coaster', text: 'Roller coasters, flat rides and water rides in a theme park, with their ride type and theme.' },
  { kind: 'utility', text: 'Behind-the-scenes buildings: power, water treatment, staff rooms, workshops, vets, quarantine and research.' },
  { kind: 'route', text: 'A line instead of an area — guest walks, safari tours, keeper and staff routes, queue lines. Arrows show the direction; the length and walking time are worked out for you.' },
  { kind: 'interest', text: 'Places worth a visit: viewpoints, photo spots, keeper talks, shows and playgrounds. They get a pin on the map.' },
  { kind: 'path', text: 'Paths and plazas sit underneath everything else. Water, scenery, facilities and themed areas complete the picture.' },
];

function Palette({ kinds }: { kinds: HabitatKind[] }) {
  return (
    <div className="guide-palette" aria-hidden="true">
      {kinds.map((k) => (
        <span key={k} className="palette-chip" style={{ ['--c' as string]: KIND_META[k].color }}>
          <KindIcon kind={k} />
          <span>{KIND_META[k].label}</span>
        </span>
      ))}
    </div>
  );
}

const Keys = ({ k }: { k: string[] }) => (
  <span className="guide-keys">
    {k.map((x) => (
      <kbd key={x}>{x}</kbd>
    ))}
  </span>
);

export function GuidePage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const showChecklist = useMutation({
    mutationFn: () => api.setOnboardingDismissed(false),
    onSuccess: (o) => {
      qc.setQueryData(['onboarding'], o);
      navigate('/');
    },
  });

  return (
    <div className="page guide">
      <header className="guide-hero">
        <div className="guide-hero-text">
          <h1>How Talyxel Park works</h1>
          <p>
            Talyxel Park is a planning board for your Planet Zoo zoos and Planet Coaster theme parks. You draw your park from above, keep every screenshot and idea
            next to the spot it belongs to, and share your progress with friends who can like, comment and vote on what you build next.
          </p>
          {me ? (
            <div className="row row-wrap">
              <Link to="/zoos?new=1" className="btn btn-primary">
                Plan a park
              </Link>
              <Link to="/?welcome=1" className="btn">
                Replay the welcome
              </Link>
            </div>
          ) : (
            <div className="row row-wrap">
              <Link to="/register" className="btn btn-primary">
                Create an account
              </Link>
              <Link to="/explore" className="btn">
                See what others built
              </Link>
            </div>
          )}
        </div>
        <ZooThumbnail width={300} height={200} shapes={DEMO_SHAPES} className="guide-hero-map" fit="meet" />
      </header>

      <div className="guide-layout">
        <nav className="guide-toc" aria-label="Guide contents">
          <strong>In this guide</strong>
          <ol>
            {SECTIONS.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ol>
          {me && (
            <div className="guide-refresh">
              <button
                className="btn btn-sm btn-block"
                onClick={() => {
                  setPlannerTourSeen(false);
                  toast.ok('The planner tour starts the next time you open a plan');
                  navigate('/zoos');
                }}
              >
                Replay the planner tour
              </button>
              <button className="btn btn-sm btn-block" onClick={() => showChecklist.mutate()} disabled={showChecklist.isPending}>
                Show my checklist
              </button>
            </div>
          )}
        </nav>

        <article className="guide-body">
          <section id="start">
            <h2>Your first park</h2>
            <p>
              Open <strong>My parks</strong> and choose <strong>New plan</strong>. Pick what you're building — each type has its own shapes, lists and statistics:
            </p>
            <ul className="guide-types">
              <li>
                <ParkBadge type="zoo" />
                <span className="subtle">habitats, exhibits, species and biomes</span>
              </li>
              <li>
                <ParkBadge type="theme_park" />
                <span className="subtle">coasters, rides, ride types and themes</span>
              </li>
            </ul>
            <p>
              Give it a name and a size in metres — new plans start at the standard 1,000 × 990 m. Matching your in-game map keeps areas and walking times
              realistic. You can resize the map later, and you can upload
              a top-down screenshot of your park to trace over — set its opacity in the side panel.
            </p>
            <p className="guide-tip">The first time you open the planner, a short tour points out everything. Restart it any time with the question-mark button.</p>
          </section>

          <section id="draw">
            <h2>Drawing the map</h2>
            <p>
              Above the map is the <strong>Add</strong> bar. Pick what to add and the right tool is chosen for you:
            </p>
            <Palette kinds={['habitat', 'utility', 'route', 'interest', 'water']} />
            <ul>
              <li>
                <strong>Freeform</strong> <Keys k={['P']} /> — click to place each corner, then click the first corner, double-click or press <Keys k={['Enter']} />.
              </li>
              <li>
                <strong>Rectangle</strong> <Keys k={['R']} /> — drag from one corner to the other.
              </li>
              <li>
                <strong>Walk route</strong> <Keys k={['L']} /> — click along the way and double-click or press <Keys k={['Enter']} /> at the end.
              </li>
              <li>
                <strong>Select</strong> <Keys k={['V']} /> — drag a shape to move it, drag its white dots to reshape it, click a small dot to add a corner and
                right-click a corner to remove it.
              </li>
            </ul>
            <p>
              Points snap to the grid and to the corners of other shapes so neighbours line up; hold <Keys k={['Alt']} /> to place a point freely or press{' '}
              <Keys k={['S']} /> to turn snapping off. Nudge a selected shape with the arrow keys, duplicate it with <Keys k={['Ctrl', 'D']} />, copy and paste with{' '}
              <Keys k={['Ctrl', 'C']} /> and <Keys k={['Ctrl', 'V']} />, and undo or redo moves with <Keys k={['Ctrl', 'Z']} /> and{' '}
              <Keys k={['Ctrl', 'Shift', 'Z']} />. Press <Keys k={['?']} /> in the planner to see every shortcut.
            </p>
            <p>
              The <strong>Layers</strong> button hides shape types you don't need right now — handy for checking your walk routes or utilities on their own.
              Visitors can do the same with the chips under your map.
            </p>
          </section>

          <section id="things">
            <h2>What you can add</h2>
            <div className="guide-cards">
              {ADDABLE.map(({ kind, text }) => (
                <div key={kind} className="guide-card" style={{ ['--c' as string]: KIND_META[kind].color }}>
                  <span className="guide-card-icon">
                    <KindIcon kind={kind} />
                  </span>
                  <div>
                    <strong>{KIND_META[kind].label}</strong>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="details">
            <h2>Details and photos</h2>
            <p>
              Select a shape to open its details. Name it, pick its species, ride, utility or route type from the suggestions, choose a biome or theme, a colour and
              a status, and describe it. Drop screenshots onto the photo area (up to 40 per shape) or paste an image link.
            </p>
            <p>
              Use <strong>Why it’s built this way</strong> to note the thinking behind a shape — why the path bends there, why the wall is low. Visitors see it when
              they open the shape on your park page. For the park as a whole, add a one-sentence <strong>design principle</strong> in the park panel.
            </p>
            <p>Visitors hover a shape to see its photos and facts, and click it to open its photos, description and the reason behind it.</p>
          </section>

          <section id="board">
            <h2>The planning board</h2>
            <p>Switch from <strong>Map</strong> to <strong>Board</strong> to see every shape as a card in one of four columns:</p>
            <div className="row row-wrap guide-figure">
              {HABITAT_STATUSES.map((s) => (
                <StatusChip key={s} status={s} />
              ))}
            </div>
            <p>Drag cards between columns as you build. Jot quick ideas straight into the Idea column and place them on the map later.</p>
          </section>

          <section id="stats">
            <h2>Park statistics</h2>
            <p>
              Press <strong>Stats</strong> in the planner and copy the numbers from the game: guests, happiness and ratings, animals or rides, money and staff. Add
              anything else as an extra stat, and note the in-game date.
            </p>
            <div className="guide-figure guide-stats">
              <div className="stat-tile headline">
                <span className="stat-label">Guests</span>
                <strong className="stat-value">1,250</strong>
                <span className="stat-change up">
                  <TrendingUp /> +200
                </span>
              </div>
              <div className="stat-tile">
                <span className="stat-label">Monthly profit</span>
                <strong className="stat-value">$8,400</strong>
              </div>
            </div>
            <p>Saving again on a later day keeps the earlier numbers, so your park page shows what went up or down.</p>
          </section>

          <section id="publish">
            <h2>Publishing and surveys</h2>
            <p>
              Plans start as private drafts. <strong>Publish</strong> makes a plan public, lists it on Explore and your profile, and tells your followers. You can
              attach a survey such as “What should I build next?” — the options are pre-filled from your ideas, visitors can suggest their own, and results stay
              hidden until someone votes. Unpublish any time to make it private again.
            </p>
          </section>

          <section id="feed">
            <h2>Posts, likes and answers</h2>
            <p>
              <strong>Social</strong> shows posts from you and the builders you follow, plus what happens in their published parks. Narrow it down to friends,
              the people you follow, or questions. Press <strong>Share an update</strong> to post your own:
            </p>
            <ul>
              <li>
                <strong>Update</strong> — what you built, with up to 10 screenshots. A short first line becomes the title. Link one of your published parks to show where it is.
              </li>
              <li>
                <strong>Question</strong> <MessageCircleQuestion className="guide-inline-icon" /> — ask your followers for advice; their comments show as answers.
              </li>
            </ul>
            <p>
              Like a post with <Heart className="guide-inline-icon" /> or a double-tap on its picture, comment with <MessageCircle className="guide-inline-icon" />,
              and copy its link with <Send className="guide-inline-icon" />. Click the time on a post to open it with every comment. When a park is published with a
              survey, you can vote right in the post.
            </p>
          </section>

          <section id="people">
            <h2>Following and notifications</h2>
            <p>
              Find builders on the <strong>People</strong> page and follow them; when you follow each other you're friends. Your profile shows your parks from above
              and a grid of your posts.
            </p>
            <p>
              The bell <Bell className="guide-inline-icon" /> tells you when someone follows you, likes or comments on your posts, or suggests something in your
              surveys.
            </p>
          </section>

          <section id="privacy">
            <h2>Who sees what</h2>
            <ul>
              <li>Drafts are only visible to you — nothing about them appears in feeds, profiles or notifications.</li>
              <li>Published parks, their stats and surveys are public. Posts are public too and appear in your followers' feeds.</li>
              <li>If you unpublish a park, posts that linked to it stay but no longer show the park.</li>
            </ul>
            {me ? (
              <Link to="/zoos?new=1" className="btn btn-primary">
                Start planning
              </Link>
            ) : (
              <Link to="/register" className="btn btn-primary">
                Create an account
              </Link>
            )}
          </section>
        </article>
      </div>
    </div>
  );
}
