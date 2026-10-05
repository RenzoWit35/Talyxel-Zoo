import { Link } from 'react-router';
import type { UserListItem } from '../../shared/types';
import { plural } from '../lib/format';
import { FollowButton } from './FollowButton';
import { Avatar } from './ui';

export function UserRow({ user, compact }: { user: UserListItem; compact?: boolean }) {
  const friends = user.isFollowing && user.followsYou;
  return (
    <div className={`user-row${compact ? ' compact' : ''}`}>
      <Link to={`/u/${user.username}`} className="user-row-main">
        <Avatar user={user} size={compact ? 36 : 44} />
        <div className="user-row-text">
          <div className="row" style={{ gap: 6, minWidth: 0 }}>
            <strong>{user.displayName}</strong>
            {!compact && (friends ? <span className="chip chip-brand">Friends</span> : user.followsYou && <span className="chip">Follows you</span>)}
          </div>
          <span className="subtle">
            {compact
              ? `${friends ? 'Friend' : user.followsYou ? 'Follows you' : `@${user.username}`} · ${plural(user.publishedZoos, 'zoo')}`
              : `@${user.username} · ${plural(user.publishedZoos, 'zoo')} · ${plural(user.followers, 'follower')}`}
          </span>
          {!compact && user.bio && <p className="user-row-bio">{user.bio}</p>}
        </div>
      </Link>
      <FollowButton username={user.username} isFollowing={user.isFollowing} followsYou={user.followsYou} size="sm" short={compact} />
    </div>
  );
}
