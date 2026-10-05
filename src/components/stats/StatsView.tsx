import { ChartColumn, PenLine, TrendingDown, TrendingUp } from 'lucide-react';
import type { ParkType } from '../../../shared/constants';
import { formatStat, formatStatChange, HEADLINE_STATS, statFields } from '../../../shared/stats';
import type { ParkStats } from '../../../shared/types';
import { formatDate, timeAgo } from '../../lib/format';

/** Fields that have a value, in the order the park type defines them. */
export function filledStats(stats: ParkStats, parkType: ParkType) {
  return statFields(parkType).filter((f) => stats.values[f.key] !== undefined);
}

function Change({ stats, field }: { stats: ParkStats; field: ReturnType<typeof statFields>[number] }) {
  const before = stats.previous?.[field.key];
  if (before === undefined) return null;
  const diff = stats.values[field.key] - before;
  const text = formatStatChange(field.type, diff);
  if (!text) return <span className="stat-change">no change</span>;
  return (
    <span className={`stat-change ${diff > 0 ? 'up' : 'down'}`} title={stats.previousAt ? `Since ${formatDate(stats.previousAt)}` : undefined}>
      {diff > 0 ? <TrendingUp /> : <TrendingDown />}
      {text}
    </span>
  );
}

interface Props {
  stats: ParkStats | null;
  parkType: ParkType;
  isOwner: boolean;
  onEdit: () => void;
}

/** "Park statistics" section on a park page. Hidden from visitors until the owner adds numbers. */
export function StatsView({ stats, parkType, isOwner, onEdit }: Props) {
  const filled = stats ? filledStats(stats, parkType) : [];
  const hasAny = !!stats && (filled.length > 0 || stats.custom.length > 0);
  if (!hasAny && !isOwner) return null;

  return (
    <section className="park-stats" aria-labelledby="park-stats-title">
      <div className="park-stats-head">
        <div className="spacer">
          <h2 id="park-stats-title" className="section-title">
            Park statistics
          </h2>
          {hasAny && (
            <p className="subtle">
              {stats.gameDate ? `In-game ${stats.gameDate} · ` : ''}updated {timeAgo(stats.updatedAt)}
              {stats.previousAt && ` · changes since ${formatDate(stats.previousAt)}`}
            </p>
          )}
        </div>
        {isOwner && hasAny && (
          <button className="btn btn-sm" onClick={onEdit}>
            <PenLine /> Update stats
          </button>
        )}
      </div>
      {hasAny ? (
        <div className="stat-tiles">
          {filled.map((f) => (
            <div key={f.key} className={`stat-tile${HEADLINE_STATS.includes(f.key) ? ' headline' : ''}`}>
              <span className="stat-label">{f.label}</span>
              <strong className={`stat-value${stats.values[f.key] < 0 ? ' negative' : ''}`}>{formatStat(f.type, stats.values[f.key])}</strong>
              <Change stats={stats} field={f} />
            </div>
          ))}
          {stats.custom.map((row, i) => (
            <div key={`c${i}`} className="stat-tile">
              <span className="stat-label">{row.label}</span>
              <strong className="stat-value stat-value-text">{row.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <button className="stats-empty card" onClick={onEdit}>
          <ChartColumn />
          <span>
            <strong>Add your in-game stats</strong>
            <span className="subtle">Guests, ratings, money and more — copy them from the game so visitors can follow your park's progress.</span>
          </span>
        </button>
      )}
    </section>
  );
}

/** Up to four headline numbers for compact places (planner panel). */
export function StatsSummary({ stats, parkType }: { stats: ParkStats; parkType: ParkType }) {
  const fields = filledStats(stats, parkType);
  const shown = [...fields.filter((f) => HEADLINE_STATS.includes(f.key)), ...fields.filter((f) => !HEADLINE_STATS.includes(f.key))].slice(0, 4);
  if (!shown.length) return <p className="subtle">Only extra stats so far.</p>;
  return (
    <div className="stat-mini">
      {shown.map((f) => (
        <div key={f.key}>
          <span>{f.label}</span>
          <strong>{formatStat(f.type, stats.values[f.key])}</strong>
          <Change stats={stats} field={f} />
        </div>
      ))}
    </div>
  );
}
