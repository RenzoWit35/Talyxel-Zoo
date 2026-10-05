import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Plus, Rss, Sprout } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FEED_FILTERS, type FeedFilter } from '../../shared/types';
import { api } from '../api/client';
import { useMe } from '../auth';
import { Composer } from '../components/feed/Composer';
import { PostCard, splitPost } from '../components/feed/PostCard';
import { FollowButton } from '../components/FollowButton';
import { Avatar, EmptyState, PageLoader, Spinner, UserLink } from '../components/ui';
import { plural } from '../lib/format';

const FILTER_LABEL: Record<FeedFilter, string> = {
  all: 'For you',
  friends: 'Friends',
  following: 'Following',
  questions: 'Questions',
};

const EMPTY: Record<FeedFilter, { title: string; text: string }> = {
  all: { title: 'Your feed is still quiet', text: 'Follow other builders to see their updates and questions here — or share your first update.' },
  friends: { title: 'No friends yet', text: 'Friends are builders who follow you back. Follow people and their posts show up here once they follow you too.' },
  following: { title: 'You’re not following anyone yet', text: 'Follow builders whose parks you like to see what they’re working on.' },
  questions: { title: 'No open questions', text: 'When you or the people you follow ask something, it shows up here so you can help out.' },
};

const isFilter = (v: string | null): v is FeedFilter => (FEED_FILTERS as readonly string[]).includes(v ?? '');

/** The signed-in builder: who they are and how many follow them. */
function MeCard() {
  const { me } = useMe();
  const profile = useQuery({ queryKey: ['profile', me!.username], queryFn: () => api.profile(me!.username) });
  const mine = useQuery({ queryKey: ['zoos', 'mine'], queryFn: api.myZoos });
  if (!me) return null;
  const stats = [
    { n: profile.data?.followers, label: 'followers', to: `/u/${me.username}?tab=followers` },
    { n: profile.data?.following, label: 'following', to: `/u/${me.username}?tab=following` },
    { n: mine.data?.length, label: 'projects', to: '/zoos' },
  ];
  return (
    <section className="social-me" aria-label="Your profile">
      <Link to={`/u/${me.username}`} className="social-me-who">
        <Avatar user={me} size={44} />
        <span>
          <strong>{me.displayName}</strong>
          <span>@{me.username}</span>
        </span>
      </Link>
      <div className="social-me-stats">
        {stats.map((s) => (
          <Link key={s.label} to={s.to}>
            <strong>{s.n ?? '–'}</strong>
            <span>{s.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** The newest questions from you and the people you follow. */
function OpenQuestions({ onShowAll }: { onShowAll: () => void }) {
  const questions = useQuery({ queryKey: ['feed', 'questions', 'side'], queryFn: () => api.feed(undefined, 'questions') });
  const items = questions.data?.items ?? [];
  if (!items.length) return null;
  return (
    <section className="card side-card social-questions" aria-labelledby="open-questions-title">
      <div className="side-card-head">
        <h2 id="open-questions-title">Open questions</h2>
        <button className="link-button social-live" onClick={onShowAll}>
          See all
        </button>
      </div>
      <ul>
        {items.slice(0, 3).map((q) => (
          <li key={q.id}>
            <Link to={`/p/${q.id}`}>
              <span className="social-q-park">{q.zoo?.title ?? q.actor.displayName}</span>
              <span className="social-q-text">{splitPost(q.post?.body ?? '').title || q.post?.body}</span>
              <span className="social-q-meta">{plural(q.commentCount, 'answer')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BuildersToFollow() {
  const suggestions = useQuery({ queryKey: ['suggestions'], queryFn: api.suggestions });
  if (!suggestions.data?.length) return null;
  return (
    <section className="card side-card" aria-labelledby="builders-title">
      <div className="side-card-head">
        <h2 id="builders-title">Builders to follow</h2>
        <Link to="/people" className="side-card-link">
          More
        </Link>
      </div>
      <ul className="social-builders">
        {suggestions.data.slice(0, 4).map((u) => (
          <li key={u.id}>
            <Link to={`/u/${u.username}`} aria-hidden="true" tabIndex={-1}>
              <Avatar user={u} size={34} />
            </Link>
            <span className="spacer social-builder-text">
              <UserLink user={u} />
              <span>{u.bio || plural(u.publishedZoos, 'park')}</span>
            </span>
            <FollowButton username={u.username} isFollowing={u.isFollowing} followsYou={u.followsYou} size="sm" short plain />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Social: updates and questions from the people you follow, with filters and a few people to follow. */
export function FeedPage() {
  const [params, setParams] = useSearchParams();
  const filterParam = params.get('filter');
  const filter: FeedFilter = isFilter(filterParam) ? filterParam : 'all';
  const [composing, setComposing] = useState(false);
  const feed = useInfiniteQuery({
    queryKey: ['feed', filter],
    queryFn: ({ pageParam }) => api.feed(pageParam, filter),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  // Opened from a "Write a post" link: drop the parameter so a reload doesn't reopen it.
  useEffect(() => {
    if (params.get('compose') !== '1') return;
    setComposing(true);
    const next = new URLSearchParams(params);
    next.delete('compose');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const setFilter = (f: FeedFilter) => {
    const next = new URLSearchParams(params);
    if (f === 'all') next.delete('filter');
    else next.set('filter', f);
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="social">
      <header className="social-head">
        <div className="social-head-text">
          <span className="chip chip-pink">
            <Sprout /> Community
          </span>
          <h1>Building together is better.</h1>
          <p>Follow your friends’ progress, think along on tricky design choices and share exactly what you’re working on.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setComposing(true)} disabled={composing}>
          <Plus /> Share an update
        </button>
      </header>

      <div className="social-body">
        <section className="social-main" aria-label="Feed">
          <div className="feed-filters" role="tablist" aria-label="Show">
            {FEED_FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>

          {composing && <Composer onClose={() => setComposing(false)} />}

          {feed.isPending ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Rss />}
                title={EMPTY[filter].title}
                action={
                  <div className="row row-wrap" style={{ justifyContent: 'center' }}>
                    <Link to="/people" className="btn btn-primary">
                      Find people to follow
                    </Link>
                    <button className="btn" onClick={() => setComposing(true)}>
                      Share an update
                    </button>
                  </div>
                }
              >
                {EMPTY[filter].text}
              </EmptyState>
            </div>
          ) : (
            <div className="feed-list">
              {items.map((item) => (
                <PostCard key={item.id} item={item} />
              ))}
              {feed.hasNextPage && (
                <button className="btn btn-block" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                  {feed.isFetchingNextPage ? <Spinner /> : 'Load older posts'}
                </button>
              )}
            </div>
          )}
        </section>

        <aside className="social-side">
          <MeCard />
          <OpenQuestions onShowAll={() => setFilter('questions')} />
          <BuildersToFollow />
        </aside>
      </div>
    </div>
  );
}
