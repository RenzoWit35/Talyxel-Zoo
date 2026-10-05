import { Images, Lock, PenLine, Vote } from 'lucide-react';
import { Link } from 'react-router';
import type { ZooSummary } from '../../shared/types';
import { plural, timeAgo } from '../lib/format';
import { Avatar } from './ui';
import { ZooThumbnail } from './ZooThumbnail';

interface Props {
  zoo: ZooSummary;
  /** Link to the planner instead of the public page (for the owner's own list). */
  editable?: boolean;
  showOwner?: boolean;
}

export function ZooCard({ zoo, editable, showOwner = true }: Props) {
  const href = editable || zoo.status === 'draft' ? `/zoos/${zoo.id}/edit` : `/z/${zoo.id}`;
  return (
    <Link to={href} className="zoo-card card">
      <div className="zoo-card-map">
        <ZooThumbnail width={zoo.width} height={zoo.height} shapes={zoo.shapes} />
        {zoo.coverUrl && <img className="zoo-card-cover" src={zoo.coverUrl} alt="" loading="lazy" />}
        <div className="zoo-card-badges">
          {zoo.status === 'draft' && (
            <span className="chip">
              <Lock /> Draft
            </span>
          )}
          {zoo.hasOpenSurvey && (
            <span className="chip chip-accent">
              <Vote /> Survey open
            </span>
          )}
        </div>
      </div>
      <div className="zoo-card-body">
        <h3>{zoo.title}</h3>
        {zoo.description && <p className="zoo-card-desc">{zoo.description}</p>}
        <div className="zoo-card-meta">
          {showOwner && (
            <span className="row">
              <Avatar user={zoo.owner} size={22} />
              <span>{zoo.owner.displayName}</span>
            </span>
          )}
          <span className="spacer" />
          <span>{plural(zoo.habitatCount, 'area')}</span>
          {zoo.photoCount > 0 && (
            <span className="row" style={{ gap: 4 }}>
              <Images size={14} /> {zoo.photoCount}
            </span>
          )}
        </div>
        <div className="subtle">
          {zoo.status === 'published' && zoo.publishedAt ? `Published ${timeAgo(zoo.publishedAt)}` : `Edited ${timeAgo(zoo.updatedAt)}`}
          {editable && (
            <span className="zoo-card-edit">
              <PenLine size={13} /> Open planner
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
