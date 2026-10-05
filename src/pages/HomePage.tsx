import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  ExternalLink,
  Heart,
  Map as MapIcon,
  MessageCircle,
  MessagesSquare,
  PawPrint,
  Plus,
  RollerCoaster,
  Sparkles,
  UserPlus,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ONBOARDING_STEPS, type NotificationType, type ZooSummary } from '../../shared/types';
import { api } from '../api/client';
import { useMe } from '../auth';
import { describeNotification } from '../components/NotificationBell';
import { STEP_COPY } from '../components/tutorial/steps';
import { WelcomeDialog } from '../components/tutorial/WelcomeDialog';
import { Avatar, PageLoader } from '../components/ui';
import { ZooThumbnail } from '../components/ZooThumbnail';
import { timeAgo } from '../lib/format';
import { parkProgress } from '../lib/parks';

function greeting(date: Date) {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}


function ProjectCard({ zoo }: { zoo: ZooSummary }) {
  const progress = parkProgress(zoo);
  const coaster = zoo.parkType === 'theme_park';
  return (
    <article className="project-card card">
      <Link to={`/zoos/${zoo.id}/edit`} className="project-cover" aria-label={`Open ${zoo.title} in the planner`}>
        {zoo.coverUrl ? (
          <img src={zoo.coverUrl} alt="" loading="lazy" />
        ) : (
          <ZooThumbnail width={zoo.width} height={zoo.height} shapes={zoo.shapes} className="project-cover-map" />
        )}
        <span className={`chip project-type ${coaster ? 'is-coaster' : 'is-zoo'}`}>
          {coaster ? <RollerCoaster /> : <PawPrint />} {coaster ? 'Theme park' : 'Zoo'}
        </span>
      </Link>
      <div className="project-info">
        <div className="project-title-row">
          <div className="spacer">
            <h3>
              <Link to={`/zoos/${zoo.id}/edit`}>{zoo.title}</Link>
            </h3>
            <p className="project-meta">
              {zoo.status === 'published' ? 'Published' : 'Draft'} · edited {timeAgo(zoo.updatedAt)}
            </p>
          </div>
          {zoo.status === 'published' && (
            <Link to={`/z/${zoo.id}`} className="icon-link" aria-label={`View the public page of ${zoo.title}`} title="View public page">
              <ExternalLink />
            </Link>
          )}
        </div>
        <div className="project-progress">
          <div className="row">
            <span className="spacer">Park layout</span>
            <strong className={coaster ? 'is-coaster' : ''}>{progress}%</strong>
          </div>
          <div className={`bar${coaster ? ' is-coaster' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`${zoo.title} is ${progress}% built`}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </article>
  );
}

const ACTIVITY_ICON: Record<NotificationType, React.ReactNode> = {
  follow: <UserPlus />,
  like: <Heart />,
  comment: <MessageCircle />,
  suggestion: <Vote />,
};

function ActivityCard() {
  const query = useQuery({ queryKey: ['notifications'], queryFn: api.notifications, refetchInterval: 60_000 });
  const items = query.data?.items.slice(0, 4) ?? [];
  return (
    <section className="card side-card activity-card" aria-labelledby="activity-title">
      <div className="side-card-head">
        <h2 id="activity-title">Activity</h2>
        {!!query.data?.unread && <span className="chip chip-mint">{query.data.unread} new</span>}
      </div>
      {items.length ? (
        <ul className="activity-list">
          {items.map((n) => (
            <li key={n.id}>
              <Link to={n.link} className="activity-item">
                <Avatar user={n.actor} size={34} />
                <span className="spacer">
                  <span className="activity-text">{describeNotification(n)}</span>
                  <span className="activity-time">{timeAgo(n.createdAt)}</span>
                </span>
                <span className="activity-type" aria-hidden="true">
                  {ACTIVITY_ICON[n.type]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="side-card-empty">
          <Bell /> When builders follow you, like or answer your posts, it shows up here.
        </p>
      )}
      <Link to="/activity" className="side-card-link">
        See all activity
      </Link>
    </section>
  );
}

/** The dark "next step" card: the getting-started checklist, one step at a time. */
function NextStepCard() {
  const { me } = useMe();
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const query = useQuery({ queryKey: ['onboarding'], queryFn: api.onboarding, staleTime: 0 });
  const dismiss = useMutation({ mutationFn: () => api.setOnboardingDismissed(true), onSuccess: (o) => qc.setQueryData(['onboarding'], o) });
  const o = query.data;
  if (!o || o.dismissed || !me) return null;
  const done = ONBOARDING_STEPS.filter((s) => o.steps[s]).length;
  const next = ONBOARDING_STEPS.find((s) => !o.steps[s]);
  const copy = next ? STEP_COPY[next] : null;
  return (
    <section className="next-step" aria-labelledby="next-step-title">
      <div className="row">
        <span className="next-step-label spacer">
          <Sparkles /> {copy ? 'Your next step' : 'All done'}
        </span>
        <button className="next-step-close" aria-label="Hide the checklist" title="Hide (bring it back from the guide)" onClick={() => dismiss.mutate()}>
          <X />
        </button>
      </div>
      <h2 id="next-step-title">{copy ? copy.title : 'You’re all set'}</h2>
      <p>{copy ? copy.hint : 'You’ve tried everything Talyxel Park has. Happy building!'}</p>
      <div className="bar is-lime" role="progressbar" aria-valuemin={0} aria-valuemax={ONBOARDING_STEPS.length} aria-valuenow={done} aria-label="Getting started progress">
        <span style={{ width: `${(done / ONBOARDING_STEPS.length) * 100}%` }} />
      </div>
      <div className="row next-step-foot">
        <span className="spacer">
          {done} of {ONBOARDING_STEPS.length} steps done
        </span>
        <button className="next-step-toggle" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
          {showAll ? 'Hide steps' : 'All steps'}
        </button>
      </div>
      {copy && next && (
        <Link to={copy.to(o, me.username)} className="btn next-step-go">
          {copy.action} <ArrowRight />
        </Link>
      )}
      {showAll && (
        <ol className="next-step-list">
          {ONBOARDING_STEPS.map((s) => (
            <li key={s} className={o.steps[s] ? 'done' : ''}>
              {o.steps[s] ? (
                <span>{STEP_COPY[s].title}</span>
              ) : (
                <Link to={STEP_COPY[s].to(o, me.username)}>{STEP_COPY[s].title}</Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Home for signed-in builders: what they're working on, what's new and what to do next. */
export function HomePage() {
  const { me } = useMe();
  const [params, setParams] = useSearchParams();
  const mine = useQuery({ queryKey: ['zoos', 'mine'], queryFn: api.myZoos });
  const now = new Date();
  const projects = mine.data ?? [];

  return (
    <div className="home">
      <section className="home-hero">
        <span className="home-hero-shape a" aria-hidden="true" />
        <span className="home-hero-shape b" aria-hidden="true" />
        <div className="home-hero-inner">
          <div className="home-hero-text">
            <span className="chip chip-cream">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <h1>
              {greeting(now)}, {me?.displayName.split(' ')[0]}. What are we building today?
            </h1>
            <p>Keep working on a park, share an update or see how other builders bring their ideas to life.</p>
          </div>
          <div className="home-hero-actions">
            <Link to="/zoos?new=1" className="btn btn-primary">
              <Plus /> New park
            </Link>
            <Link to="/social" className="btn">
              <Users /> Go to Social
            </Link>
          </div>
        </div>
      </section>

      <div className="home-body">
        <div className="home-main">
          <section aria-labelledby="projects-title">
            <div className="section-head">
              <div>
                <h2 id="projects-title">Recent projects</h2>
                <p>Your latest plans, ready to keep building.</p>
              </div>
              {projects.length > 3 && (
                <Link to="/zoos" className="section-link">
                  All {projects.length} projects →
                </Link>
              )}
            </div>
            {mine.isPending ? (
              <PageLoader />
            ) : projects.length ? (
              <div className="project-grid">
                {projects.slice(0, 3).map((z) => (
                  <ProjectCard key={z.id} zoo={z} />
                ))}
              </div>
            ) : (
              <Link to="/zoos?new=1" className="project-empty card">
                <span className="tile-icon">
                  <Plus />
                </span>
                <span>
                  <strong>Plan your first park</strong>
                  <span>Pick a zoo or a theme park and draw it from above.</span>
                </span>
              </Link>
            )}
          </section>

          <section aria-labelledby="start-title">
            <h2 id="start-title" className="section-head-title">
              Get started
            </h2>
            <div className="quick-tiles">
              <Link to="/social" className="quick-tile is-lavender">
                <span className="tile-icon">
                  <MessagesSquare />
                </span>
                <span className="spacer">
                  <strong>Social</strong>
                  <span>See updates, answer building questions and tell builders what you would add.</span>
                </span>
                <ArrowUpRight className="quick-tile-arrow" />
              </Link>
              <Link to="/zoos" className="quick-tile is-mint">
                <span className="tile-icon">
                  <MapIcon />
                </span>
                <span className="spacer">
                  <strong>Park layout</strong>
                  <span>Draw areas, add habitats or rides, walk routes and utilities, and note why you built them.</span>
                </span>
                <ArrowUpRight className="quick-tile-arrow" />
              </Link>
            </div>
          </section>
        </div>

        <aside className="home-side">
          <ActivityCard />
          <NextStepCard />
        </aside>
      </div>
      {params.get('welcome') === '1' && <WelcomeDialog onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}
