import { CoachTour, type TourStep } from '../../components/tutorial/CoachTour';

const KEY = 'talyxel.tour.planner.v1';

/** Whether this browser has seen the planner tour. Storage can be blocked, so failures count as "seen". */
export function plannerTourSeen() {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return true;
  }
}

export function setPlannerTourSeen(seen: boolean) {
  try {
    if (seen) localStorage.setItem(KEY, 'done');
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the tour simply shows again next time */
  }
}

const STEPS: TourStep[] = [
  {
    target: '[data-tour="palette"]',
    title: 'Add things to your map',
    body: 'Pick what to add — a habitat or ride, a utility, a walk route or an area of interest — then click on the map to draw it.',
  },
  {
    target: '[data-tour="tools"]',
    title: 'Your tools',
    body: (
      <>
        Select (V), freeform (P), rectangle (R) and walk route (L), plus snapping, layers, undo, redo and duplicate. Press <kbd>?</kbd> any time to see every
        shortcut.
      </>
    ),
  },
  {
    target: '[data-tour="map"]',
    title: 'Draw on the map',
    body: 'Click to place corners and double-click (or press Enter) to finish. Drag a shape to move it and its white dots to reshape it. Scroll or pinch to zoom.',
  },
  {
    target: '[data-tour="panel"], [data-tour="panel-toggle"]',
    title: 'Details and photos',
    body: 'Select a shape to name it, choose its species, ride or utility type, set its status and colour, and add screenshots. With nothing selected you see the plan overview.',
  },
  {
    target: '[data-tour="stats"]',
    title: 'Park statistics',
    body: 'Copy guests, ratings and money from the game whenever you play — your park page shows what changed since last time.',
  },
  {
    target: '[data-tour="publish"]',
    title: 'Publish and share',
    body: 'Publishing makes your plan public and shows it to your followers. Ask them what to build next with a survey, then share updates from your feed.',
  },
];

export function PlannerTour({ onClose }: { onClose: () => void }) {
  return (
    <CoachTour
      steps={STEPS}
      onClose={() => {
        setPlannerTourSeen(true);
        onClose();
      }}
    />
  );
}
