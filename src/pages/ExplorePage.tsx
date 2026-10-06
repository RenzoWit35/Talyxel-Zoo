import { useQuery } from '@tanstack/react-query';
import { Compass, Search } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PARK_TYPES, type ParkType } from '../../shared/constants';
import { parkMeta } from '../../shared/parks';
import { api } from '../api/client';
import { ParkIcon } from '../components/ParkType';
import { EmptyState, PageLoader } from '../components/ui';
import { UserRow } from '../components/UserRow';
import { ZooCard } from '../components/ZooCard';

export function ExplorePage() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const [type, setType] = useState<ParkType | ''>('');
  const query = useDeferredValue(q.trim());
  // A new search from the top bar replaces what's typed here.
  useEffect(() => setQ(params.get('q') ?? ''), [params]);
  const builders = useQuery({ queryKey: ['users', query], queryFn: () => api.users(query), enabled: query.length > 0 });
  const zoos = useQuery({
    queryKey: ['zoos', 'explore', query, type],
    queryFn: () => api.explore(query, type),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="lp-pill">Community parks</span>
          <h1>Explore</h1>
          <p>Zoos and theme parks the community published, and the builders behind them.</p>
        </div>
        <label className="input-with-icon explore-search">
          <Search />
          <input
            className="input"
            placeholder="Search parks, species, rides or builders"
            aria-label="Search parks and builders"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      {query && !!builders.data?.length && (
        <section className="explore-builders" aria-label="Builders">
          <h2 className="section-head-title">Builders</h2>
          <div className="card people-list">
            {builders.data.slice(0, 4).map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </div>
        </section>
      )}
      <div className="segmented explore-filter" role="radiogroup" aria-label="Park type">
        <button aria-pressed={type === ''} onClick={() => setType('')}>
          All
        </button>
        {PARK_TYPES.map((t) => (
          <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>
            <ParkIcon type={t} size={15} /> {parkMeta(t).label}s
          </button>
        ))}
      </div>
      {zoos.isPending ? (
        <PageLoader />
      ) : !zoos.data?.length ? (
        <EmptyState icon={<Compass />} title={query ? 'Nothing matches that search' : `No published ${type ? `${parkMeta(type).noun}s` : 'parks'} yet`}>
          {query ? 'Try a species like “Red Panda”, a ride like “Wooden coaster”, or a builder’s username.' : 'Be the first: plan one and hit publish.'}
        </EmptyState>
      ) : (
        <div className="grid-cards">
          {zoos.data.map((z) => (
            <ZooCard key={z.id} zoo={z} />
          ))}
        </div>
      )}
    </div>
  );
}
