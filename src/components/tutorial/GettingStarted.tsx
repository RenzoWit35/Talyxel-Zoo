import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router';
import { ONBOARDING_STEPS, type Onboarding, type OnboardingStep } from '../../../shared/types';
import { api } from '../../api/client';
import { useMe } from '../../auth';

interface StepCopy {
  title: string;
  hint: string;
  action: string;
  to: (o: Onboarding, username: string) => string;
}

const planner = (o: Onboarding) => (o.parkId ? `/zoos/${o.parkId}/edit` : '/zoos?new=1');

export const STEP_COPY: Record<OnboardingStep, StepCopy> = {
  park: { title: 'Create your first park', hint: 'Pick a zoo or a theme park and give it a name.', action: 'New plan', to: () => '/zoos?new=1' },
  shape: { title: 'Draw a habitat or a ride', hint: 'Pick it in the Add bar above the map and click out its corners.', action: 'Open planner', to: planner },
  mapDetails: {
    title: 'Add a walk route, utility or area of interest',
    hint: 'Show how guests walk, where the power and staff rooms are, and the best views.',
    action: 'Open planner',
    to: planner,
  },
  stats: { title: 'Fill in your park statistics', hint: 'Copy guests, ratings and money from the game.', action: 'Add stats', to: (o) => (o.parkId ? `/zoos/${o.parkId}/edit?stats=1` : '/zoos?new=1') },
  publish: { title: 'Publish your park', hint: 'Make it public so followers see it — you can add a survey.', action: 'Open planner', to: planner },
  follow: { title: 'Follow another builder', hint: 'Their updates and questions appear in your feed.', action: 'Find people', to: () => '/people' },
  post: { title: 'Share an update or ask a question', hint: 'Screenshots, progress, or what to build next.', action: 'Write a post', to: () => '/?compose=1' },
  profile: { title: 'Tell people about yourself', hint: 'A short bio and a colour for your avatar.', action: 'Edit profile', to: (_o, u) => `/u/${u}?edit=1` },
};

/** Checklist card for new builders; each step ticks itself off from what they've actually done. */
export function GettingStarted() {
  const { me } = useMe();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['onboarding'], queryFn: api.onboarding, staleTime: 0 });
  const dismiss = useMutation({
    mutationFn: () => api.setOnboardingDismissed(true),
    onSuccess: (o) => qc.setQueryData(['onboarding'], o),
  });
  const o = query.data;
  if (!o || o.dismissed || !me) return null;
  const done = ONBOARDING_STEPS.filter((s) => o.steps[s]).length;
  const next = ONBOARDING_STEPS.find((s) => !o.steps[s]);
  const finished = !next;

  return (
    <section className="getting-started card" aria-labelledby="gs-title">
      <div className="gs-head">
        <div className="spacer">
          <h2 id="gs-title">{finished ? 'You’re all set' : 'Get your park going'}</h2>
          <p className="subtle">
            {finished ? 'You’ve tried everything Talyxel Park has. Happy building!' : `${done} of ${ONBOARDING_STEPS.length} done`}
          </p>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label="Hide the checklist" title="Hide (you can bring it back from the guide)" onClick={() => dismiss.mutate()}>
          <X />
        </button>
      </div>
      <div className="gs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={ONBOARDING_STEPS.length} aria-valuenow={done} aria-label="Getting started progress">
        <span style={{ width: `${(done / ONBOARDING_STEPS.length) * 100}%` }} />
      </div>
      {!finished && (
        <ol className="gs-steps">
          {ONBOARDING_STEPS.map((s) => {
            const copy = STEP_COPY[s];
            const isDone = o.steps[s];
            return (
              <li key={s} className={`gs-step${isDone ? ' done' : ''}${s === next ? ' next' : ''}`}>
                <span className="gs-check" aria-hidden="true">
                  {isDone && <Check />}
                </span>
                {isDone ? (
                  <span className="gs-title">
                    {copy.title}
                    <span className="sr-only"> (done)</span>
                  </span>
                ) : (
                  <Link to={copy.to(o, me.username)} className="gs-link">
                    <span className="gs-text">
                      <span className="gs-title">{copy.title}</span>
                      {s === next && <span className="gs-hint">{copy.hint}</span>}
                    </span>
                    <span className={s === next ? 'btn btn-sm btn-primary' : 'gs-go'}>
                      {s === next ? copy.action : <ChevronRight />}
                    </span>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <Link to="/guide" className="gs-guide subtle">
        Read the full guide
      </Link>
    </section>
  );
}
