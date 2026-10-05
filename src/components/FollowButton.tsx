import { useMutation } from '@tanstack/react-query';
import { UserCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api/client';
import { useInvalidateSocial, useMe } from '../auth';
import { useToast } from './toast';

interface Props {
  username: string;
  isFollowing: boolean;
  followsYou?: boolean;
  size?: 'sm' | 'md';
  /** Keep the label to one word (for narrow sidebars). */
  short?: boolean;
  /** A small outlined pill without an icon. */
  plain?: boolean;
}

/** Follow / unfollow toggle. Mutual follows are shown as "Friends". */
export function FollowButton({ username, isFollowing, followsYou, size = 'md', short, plain }: Props) {
  const { me } = useMe();
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateSocial();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const following = optimistic ?? isFollowing;

  const mutation = useMutation({
    mutationFn: (follow: boolean) => (follow ? api.follow(username) : api.unfollow(username)),
    onMutate: (follow) => setOptimistic(follow),
    onError: (err) => {
      setOptimistic(null);
      toast.error(err);
    },
    onSuccess: (_d, follow) => {
      if (follow) toast.ok(followsYou ? `You and @${username} are now friends` : `Following @${username}`);
      invalidate();
    },
    onSettled: () => setOptimistic(null),
  });

  if (me?.username.toLowerCase() === username.toLowerCase()) return null;
  const cls = plain ? `btn btn-xs follow-plain${following ? ' is-following' : ''}` : `btn ${size === 'sm' ? 'btn-sm' : ''} ${following ? '' : 'btn-primary'}`;
  const label = following ? (followsYou ? 'Friends' : 'Following') : followsYou && !short ? 'Follow back' : 'Follow';

  return (
    <button
      className={cls}
      disabled={mutation.isPending}
      onClick={() => (me ? mutation.mutate(!following) : navigate('/login'))}
      title={following ? 'Click to unfollow' : undefined}
    >
      {!plain && (following ? <UserCheck /> : <UserPlus />)}
      {label}
    </button>
  );
}
