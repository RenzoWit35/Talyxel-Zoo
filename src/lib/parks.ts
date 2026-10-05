import type { ZooSummary } from '../../shared/types';

/** How much of the plan is built: shapes marked done out of all shapes, in percent. */
export const parkProgress = (z: Pick<ZooSummary, 'habitatCount' | 'doneCount'>) => (z.habitatCount ? Math.round((z.doneCount / z.habitatCount) * 100) : 0);
