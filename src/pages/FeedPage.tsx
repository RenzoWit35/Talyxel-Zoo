import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, Map, Plus, Rss, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../api/client';
import { useMe } from '../auth';
import { Composer } from '../components/feed/Composer';
import { PostCard } from '../components/feed/PostCard';
import { EmptyState, PageLoader, Spinner } from '../components/ui';
import { UserRow } from '../components/UserRow';
import { ZooThumbnail } from '../components/ZooThumbnail';
import { plural } from '../lib/format';

export function FeedPage() {
  const { me } = useMe();
  const feed = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => api.feed(pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const suggestions = useQuery({ queryKey: ['suggestions'], queryFn: api.suggestions });
  const mine = useQuery({ queryKey: ['zoos', 'mine'], queryFn: api.myZoos });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="page feed-layout">
      <section className="feed-main" aria-label="Feed">
        <div className="feed-hello">
          <h1>Hi {me?.displayName.split(' ')[0]}</h1>
          <p className="muted">Updates, questions and new builds from you and the people you follow.</p>
        </div>
        <Composer />
        {feed.isPending ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<Rss />}
              title="Your feed is still quiet"
              action={
                <div className="row row-wrap" style={{ justifyContent: 'center' }}>
                  <Link to="/people" className="btn btn-primary">
                    Find people to follow
                  </Link>
                  <Link to="/zoos" className="btn">
                    Plan a park
                  </Link>
                </div>
              }
            >
              Follow other builders to see their updates and questions here — or share your first update above.
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

      <aside className="feed-side">
        <div className="card card-pad">
          <div className="card-title">
            <Map size={18} />
            <h3>Your parks</h3>
            <span className="spacer" />
            <Link to="/zoos" className="subtle">
              All
            </Link>
          </div>
          {mine.data?.length ? (
            <div className="side-zoos">
              {mine.data.slice(0, 3).map((z) => (
                <Link key={z.id} to={`/zoos/${z.id}/edit`} className="side-zoo">
                  <ZooThumbnail width={z.width} height={z.height} shapes={z.shapes} className="side-zoo-map" />
                  <div>
                    <strong>{z.title}</strong>
                    <span className="subtle">
                      {z.status === 'draft' ? 'Draft' : 'Published'} · {plural(z.habitatCount, 'area')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ marginBottom: 12 }}>
              You haven't planned a park yet.
            </p>
          )}
          <Link to="/zoos?new=1" className="btn btn-sm btn-block" style={{ marginTop: 12 }}>
            <Plus /> New plan
          </Link>
        </div>

        {!!suggestions.data?.length && (
          <div className="card card-pad">
            <div className="card-title">
              <Sparkles size={18} />
              <h3>Builders to follow</h3>
            </div>
            <div className="stack" style={{ gap: 4 }}>
              {suggestions.data.map((u) => (
                <UserRow key={u.id} user={u} compact />
              ))}
            </div>
            <Link to="/people" className="subtle row" style={{ marginTop: 10, gap: 4 }}>
              Find more people <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
