import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Grid3x3, Heart, Images, Map, MessageCircle, MessageCircleQuestion, PenLine, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AVATAR_COLORS } from '../../shared/constants';
import type { FeedItem, Me, Profile } from '../../shared/types';
import { api, ApiError, errorMessage } from '../api/client';
import { FollowButton } from '../components/FollowButton';
import { ParkMapCard } from '../components/ParkMapCard';
import { useToast } from '../components/toast';
import { Avatar, EmptyState, Modal, PageLoader } from '../components/ui';
import { UserRow } from '../components/UserRow';
import { ZooThumbnail } from '../components/ZooThumbnail';
import { formatDate } from '../lib/format';
import { NotFound } from './NotFound';

type Tab = 'posts' | 'followers' | 'following';

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
        {kind === 'followers' ? 'Publish a park or share an update to get noticed.' : 'Find builders on the People page.'}
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

/** A square in the posts grid: the first photo, the linked park's map, or the text. */
function PostTile({ item }: { item: FeedItem }) {
  const post = item.post!;
  const cover = post.photos[0];
  return (
    <Link to={`/p/${item.id}`} className="post-tile" aria-label={`${post.kind === 'question' ? 'Question' : 'Update'}: ${post.body || 'photos'}`}>
      {cover ? (
        <img src={cover.url} alt="" loading="lazy" />
      ) : item.zoo ? (
        <ZooThumbnail width={item.zoo.width} height={item.zoo.height} shapes={item.zoo.shapes} className="post-tile-map" />
      ) : (
        <span className={`post-tile-text tone-${post.kind}`}>
          <span>{post.body}</span>
        </span>
      )}
      {post.kind === 'question' ? (
        <MessageCircleQuestion className="post-tile-flag" aria-hidden="true" />
      ) : (
        post.photos.length > 1 && <Images className="post-tile-flag" aria-hidden="true" />
      )}
      <span className="post-tile-hover" aria-hidden="true">
        <span>
          <Heart /> {item.likes}
        </span>
        <span>
          <MessageCircle /> {item.commentCount}
        </span>
      </span>
    </Link>
  );
}

function PostsTab({ profile }: { profile: Profile }) {
  const posts = useQuery({ queryKey: ['posts', profile.username], queryFn: () => api.userPosts(profile.username) });
  if (posts.isPending) return <PageLoader />;
  if (!posts.data?.length)
    return (
      <EmptyState
        icon={<Grid3x3 />}
        title="No posts yet"
        action={
          profile.isMe ? (
            <Link to="/" className="btn btn-primary">
              <Plus /> Share your first update
            </Link>
          ) : undefined
        }
      >
        {profile.isMe ? 'Updates and questions you share show up here.' : `${profile.displayName} hasn't shared anything yet.`}
      </EmptyState>
    );
  return (
    <div className="post-grid">
      {posts.data.map((item) => (
        <PostTile key={item.id} item={item} />
      ))}
    </div>
  );
}

export function ProfilePage() {
  const { username = '' } = useParams();
  const [tab, setTab] = useState<Tab>('posts');
  const [editing, setEditing] = useState(false);
  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => api.profile(username) });

  if (profile.isPending) return <PageLoader />;
  if (profile.error) return profile.error instanceof ApiError && profile.error.status === 404 ? <NotFound what="builder" /> : <div className="page">{errorMessage(profile.error)}</div>;
  const p = profile.data;
  const friends = p.isFollowing && p.followsYou;
  const published = p.zoos.filter((z) => z.status === 'published').length;

  return (
    <div className="page profile-page">
      <section className="profile-head card">
        <div className="profile-banner" style={{ background: `linear-gradient(120deg, ${p.avatarColor}, #9fcf8a)` }} />
        <div className="profile-body">
          <Avatar user={p} size={96} />
          <div className="profile-text">
            <div className="row row-wrap" style={{ gap: 8 }}>
              <h1>{p.displayName}</h1>
              {friends ? <span className="chip chip-brand">Friends</span> : p.followsYou && <span className="chip">Follows you</span>}
            </div>
            <span className="muted">
              @{p.username} · building since {formatDate(p.createdAt)}
            </span>
            {p.bio && <p className="profile-bio">{p.bio}</p>}
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
        <div className="profile-counts">
          <button onClick={() => setTab('posts')}>
            <strong>{p.postCount.toLocaleString('en')}</strong> {p.postCount === 1 ? 'post' : 'posts'}
          </button>
          <a href="#parks">
            <strong>{published.toLocaleString('en')}</strong> {published === 1 ? 'park' : 'parks'}
          </a>
          <button onClick={() => setTab('followers')}>
            <strong>{p.followers.toLocaleString('en')}</strong> {p.followers === 1 ? 'follower' : 'followers'}
          </button>
          <button onClick={() => setTab('following')}>
            <strong>{p.following.toLocaleString('en')}</strong> following
          </button>
        </div>
      </section>

      <section id="parks" className="profile-parks" aria-labelledby="parks-title">
        <div className="profile-section-head">
          <h2 id="parks-title">Parks</h2>
          <span className="subtle">Seen from above — open one to explore the map</span>
          <span className="spacer" />
          {p.isMe && (
            <Link to="/zoos?new=1" className="btn btn-sm">
              <Plus /> New plan
            </Link>
          )}
        </div>
        {p.zoos.length ? (
          <div className="park-map-grid">
            {p.zoos.map((z) => (
              <ParkMapCard key={z.id} zoo={z} editable={p.isMe} />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState icon={<Map />} title={p.isMe ? 'Plan your first park' : 'No published parks yet'}>
              {p.isMe ? 'Draw your zoo or theme park from above — it shows up here as a map.' : `${p.displayName} hasn't published a park yet.`}
            </EmptyState>
          </div>
        )}
      </section>

      <div className="tabs profile-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'posts'} onClick={() => setTab('posts')}>
          <Grid3x3 size={16} /> Posts <span className="count">{p.postCount}</span>
        </button>
        <button role="tab" aria-selected={tab === 'followers'} onClick={() => setTab('followers')}>
          Followers <span className="count">{p.followers}</span>
        </button>
        <button role="tab" aria-selected={tab === 'following'} onClick={() => setTab('following')}>
          Following <span className="count">{p.following}</span>
        </button>
      </div>

      {tab === 'posts' ? <PostsTab profile={p} /> : <PeopleTab username={p.username} kind={tab} />}
      {editing && <EditProfileDialog profile={p} onClose={() => setEditing(false)} />}
    </div>
  );
}
