import { useQuery } from '@tanstack/react-query';
import { Compass, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { PARK_TYPES, type ParkType } from '../../shared/constants';
import { parkMeta } from '../../shared/parks';
import { api } from '../api/client';
import { ParkIcon } from '../components/ParkType';
import { EmptyState, PageLoader } from '../components/ui';
import { ZooCard } from '../components/ZooCard';

export function ExplorePage() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<ParkType | ''>('');
  const query = useDeferredValue(q.trim());
  const zoos = useQuery({
    queryKey: ['zoos', 'explore', query, type],
    queryFn: () => api.explore(query, type),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Explore parks</h1>
          <p>Browse zoos and theme parks the community published — hover any shape for photos and details.</p>
        </div>
        <label className="input-with-icon explore-search">
          <Search />
          <input className="input" placeholder="Search parks, species, rides or builders" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
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
