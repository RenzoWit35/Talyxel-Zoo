import type { Onboarding, OnboardingStep } from '../../../shared/types';

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
  post: { title: 'Share an update or ask a question', hint: 'Screenshots, progress, or what to build next.', action: 'Write a post', to: () => '/social?compose=1' },
  profile: { title: 'Tell people about yourself', hint: 'A short bio and a colour for your avatar.', action: 'Edit profile', to: (_o, u) => `/u/${u}?edit=1` },
};
