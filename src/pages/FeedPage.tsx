import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, Camera, Map, Plus, Rss, Sparkles, Vote } from 'lucide-react';
import { Link } from 'react-router';
import { KIND_META } from '../../shared/constants';
import type { FeedItem } from '../../shared/types';
import { api } from '../api/client';
import { useMe } from '../auth';
import { PhotoGrid } from '../components/Lightbox';
import { EmptyState, PageLoader, Spinner, UserLink, Avatar } from '../components/ui';
import { UserRow } from '../components/UserRow';
import { ZooThumbnail } from '../components/ZooThumbnail';
import { plural, timeAgo } from '../lib/format';

function SurveyCallout({ item }: { item: FeedItem }) {
  if (!item.survey) return null;
  return (
    <Link to={`/z/${item.zoo.id}#surveys`} className="feed-survey">
      <Vote />
      <div className="spacer">
        <strong>{item.survey.question}</strong>
        <span className="subtle">
          {plural(item.survey.optionCount, 'option')} · {plural(item.survey.totalVotes, 'vote')}
          {!item.survey.isOpen && ' · closed'}
        </span>
      </div>
      {item.survey.isOpen && <span className="btn btn-sm btn-accent">Vote</span>}
    </Link>
  );
}

function FeedEntry({ item }: { item: FeedItem }) {
  const zooLink = <Link to={`/z/${item.zoo.id}`}>{item.zoo.title}</Link>;
  const habitatName = item.habitat && (
    <Link to={`/z/${item.zoo.id}?h=${item.habitat.id}`}>
      <strong>{item.habitat.name}</strong>
    </Link>
  );
  let headline;
  let icon;
  switch (item.type) {
    case 'zoo_published':
      icon = <Sparkles />;
      headline = <>published a new zoo plan: {zooLink}</>;
      break;
    case 'habitat_added':
      icon = <Plus />;
      headline = (
        <>
          added {KIND_META[item.habitat?.kind ?? 'habitat'].label.toLowerCase()} {habitatName} to {zooLink}
        </>
      );
      break;
    case 'photos_added':
      icon = <Camera />;
      headline = (
        <>
          added {plural(item.photos.length, 'photo')} to {habitatName} in {zooLink}
        </>
      );
      break;
    case 'survey_created':
      icon = <Vote />;
      headline = <>wants your opinion on {zooLink}</>;
      break;
  }

  return (
    <article className="feed-item card">
      <header className="feed-head">
        <Link to={`/u/${item.actor.username}`}>
          <Avatar user={item.actor} size={40} />
        </Link>
        <div className="spacer">
          <p>
            <UserLink user={item.actor}>
              <strong>{item.actor.displayName}</strong>
            </UserLink>{' '}
            {headline}
          </p>
          <span className="subtle">{timeAgo(item.createdAt)}</span>
        </div>
        <span className={`feed-icon feed-icon-${item.type}`}>{icon}</span>
      </header>

      {item.type === 'zoo_published' && (
        <Link to={`/z/${item.zoo.id}`} className="feed-zoo">
          <ZooThumbnail width={item.zoo.width} height={item.zoo.height} shapes={item.zoo.shapes} className="feed-map" />
          <div className="feed-zoo-text">
            <h3>{item.zoo.title}</h3>
            {item.zoo.description && <p className="muted">{item.zoo.description}</p>}
            <span className="subtle">
              {plural(item.zoo.habitatCount, 'area')} · {plural(item.zoo.photoCount, 'photo')} · {item.zoo.width} × {item.zoo.height} m
            </span>
          </div>
        </Link>
      )}

      {item.type === 'habitat_added' && item.habitat && (
        <div className="feed-habitat">
          <Link to={`/z/${item.zoo.id}?h=${item.habitat.id}`} className="feed-habitat-map">
            <ZooThumbnail width={item.zoo.width} height={item.zoo.height} shapes={item.zoo.shapes} highlight={item.habitat.points} />
          </Link>
          <div className="feed-habitat-text">
            <h3>{item.habitat.name}</h3>
            {item.habitat.species && <span className="species">{item.habitat.species}</span>}
            {item.habitat.description && <p className="muted clamp-3">{item.habitat.description}</p>}
            {item.photos.length > 0 && <PhotoGrid photos={item.photos} title={item.habitat.name} max={4} className="photo-strip" />}
          </div>
        </div>
      )}

      {item.type === 'photos_added' && <PhotoGrid photos={item.photos} title={item.habitat?.name} max={6} />}

      {(item.type === 'zoo_published' || item.type === 'survey_created') && <SurveyCallout item={item} />}
    </article>
  );
}

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
      <section className="feed-main">
        <div className="page-header">
          <div>
            <h1>Hi {me?.displayName.split(' ')[0]} 👋</h1>
            <p>New habitats, photos and surveys from you and the builders you follow.</p>
          </div>
        </div>
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
                    Plan a zoo
                  </Link>
                </div>
              }
            >
              Follow other builders to see what they add to their zoos — or publish your own plan to get things going.
            </EmptyState>
          </div>
        ) : (
          <div className="feed-list">
            {items.map((item) => (
              <FeedEntry key={item.id} item={item} />
            ))}
            {feed.hasNextPage && (
              <button className="btn btn-block" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                {feed.isFetchingNextPage ? <Spinner /> : 'Load older activity'}
              </button>
            )}
          </div>
        )}
      </section>

      <aside className="feed-side">
        <div className="card card-pad">
          <div className="card-title">
            <Map size={18} />
            <h3>Your zoos</h3>
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
              You haven't planned a zoo yet.
            </p>
          )}
          <Link to="/zoos?new=1" className="btn btn-sm btn-block" style={{ marginTop: 12 }}>
            <Plus /> New zoo plan
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
