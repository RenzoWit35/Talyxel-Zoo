import type { ZooSummary } from '../../shared/types';
import { parkProgress } from '../lib/parks';

/** "Built 45%" with a bar: shapes marked done out of all shapes. Pink for theme parks. */
export function BuildProgress({ zoo }: { zoo: Pick<ZooSummary, 'title' | 'parkType' | 'habitatCount' | 'doneCount'> }) {
  const progress = parkProgress(zoo);
  const coaster = zoo.parkType === 'theme_park';
  return (
    <div className="project-progress">
      <div className="row">
        <span className="spacer">Built</span>
        <strong className={coaster ? 'is-coaster' : ''}>{progress}%</strong>
      </div>
      <div className={`bar${coaster ? ' is-coaster' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`${zoo.title} is ${progress}% built`}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
