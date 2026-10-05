import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Map, PenLine, Users } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { AVATAR_COLORS } from '../../shared/constants';
import type { Me, Profile } from '../../shared/types';
import { api, ApiError, errorMessage } from '../api/client';
import { FollowButton } from '../components/FollowButton';
import { useToast } from '../components/toast';
import { Avatar, EmptyState, Modal, PageLoader } from '../components/ui';
import { UserRow } from '../components/UserRow';
import { ZooCard } from '../components/ZooCard';
import { formatDate } from '../lib/format';
import { NotFound } from './NotFound';

type Tab = 'zoos' | 'followers' | 'following';

function EditProfileDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor);
  const save = useMutation({
    mutationFn: () => api.updateProfile({ displayName, bio, avatarColor }),
    onSuccess: (me: Me) => {
      qc.setQueryData(['me'], me);
      void qc.invalidateQueries({ queryKey: ['profile'] });
      toast.ok('Profile saved');
      onClose();
    },
  });
  return (
    <Modal
      title="Edit profile"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending || !displayName.trim()}>
            Save
          </button>
        </>
      }
    >
      {save.error && <div className="form-error">{errorMessage(save.error)}</div>}
      <div className="row" style={{ gap: 14 }}>
        <Avatar user={{ displayName, avatarColor }} size={56} />
        <div className="swatches" role="radiogroup" aria-label="Avatar colour">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              className="swatch"
              style={{ background: c }}
              role="radio"
              aria-checked={c === avatarColor}
              aria-label={c}
              onClick={() => setAvatarColor(c)}
            />
          ))}
        </div>
      </div>
      <label className="field">
        <span>Display name</span>
        <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
      </label>
      <label className="field">
        <span>Bio</span>
        <textarea
          className="textarea"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={300}
          placeholder="Favourite animals or rides, how you build, what you're working on…"
        />
        <small>{300 - bio.length} characters left</small>
      </label>
    </Modal>
  );
}

function PeopleTab({ username, kind }: { username: string; kind: 'followers' | 'following' }) {
  const list = useQuery({ queryKey: [kind, username], queryFn: () => (kind === 'followers' ? api.followers(username) : api.following(username)) });
  if (list.isPending) return <PageLoader />;
  if (!list.data?.length)
    return (
      <EmptyState icon={<Users />} title={kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}>
        {kind === 'followers' ? 'Publish a park to get noticed.' : 'Find builders on the People page.'}
      </EmptyState>
    );
  return (
    <div className="card people-list">
      {list.data.map((u) => (
        <UserRow key={u.id} user={u} />
      ))}
    </div>
  );
}

export function ProfilePage() {
  const { username = '' } = useParams();
  const [tab, setTab] = useState<Tab>('zoos');
  const [editing, setEditing] = useState(false);
  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => api.profile(username) });

  if (profile.isPending) return <PageLoader />;
  if (profile.error) return profile.error instanceof ApiError && profile.error.status === 404 ? <NotFound what="builder" /> : <div className="page">{errorMessage(profile.error)}</div>;
  const p = profile.data;
  const friends = p.isFollowing && p.followsYou;

  return (
    <div className="page">
      <section className="profile-head card">
        <div className="profile-banner" style={{ background: `linear-gradient(120deg, ${p.avatarColor}, #9fcf8a)` }} />
        <div className="profile-body">
          <Avatar user={p} size={88} />
          <div className="profile-text">
            <div className="row row-wrap" style={{ gap: 8 }}>
              <h1>{p.displayName}</h1>
              {friends ? <span className="chip chip-brand">Friends</span> : p.followsYou && <span className="chip">Follows you</span>}
            </div>
            <span className="muted">
              @{p.username} · building since {formatDate(p.createdAt)}
            </span>
            {p.bio && <p className="profile-bio">{p.bio}</p>}
            <div className="profile-stats">
              <button onClick={() => setTab('zoos')}>
                <strong>{p.zoos.filter((z) => z.status === 'published').length}</strong> published
              </button>
              <button onClick={() => setTab('followers')}>
                <strong>{p.followers}</strong> {p.followers === 1 ? 'follower' : 'followers'}
              </button>
              <button onClick={() => setTab('following')}>
                <strong>{p.following}</strong> following
              </button>
            </div>
          </div>
          <div className="profile-actions">
            {p.isMe ? (
              <button className="btn" onClick={() => setEditing(true)}>
                <PenLine /> Edit profile
              </button>
            ) : (
              <FollowButton username={p.username} isFollowing={p.isFollowing} followsYou={p.followsYou} />
            )}
          </div>
        </div>
      </section>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'zoos'} onClick={() => setTab('zoos')}>
          Zoos <span className="count">{p.zoos.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'followers'} onClick={() => setTab('followers')}>
          Followers <span className="count">{p.followers}</span>
        </button>
        <button role="tab" aria-selected={tab === 'following'} onClick={() => setTab('following')}>
          Following <span className="count">{p.following}</span>
        </button>
      </div>

      {tab === 'zoos' &&
        (p.zoos.length ? (
          <div className="grid-cards">
            {p.zoos.map((z) => (
              <ZooCard key={z.id} zoo={z} editable={p.isMe} showOwner={false} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<Map />} title="No published parks yet">
            {p.isMe ? 'Create a plan from My parks and publish it to show it here.' : `${p.displayName} hasn't published a park yet.`}
          </EmptyState>
        ))}
      {tab !== 'zoos' && <PeopleTab username={p.username} kind={tab} />}
      {editing && <EditProfileDialog profile={p} onClose={() => setEditing(false)} />}
    </div>
  );
}
