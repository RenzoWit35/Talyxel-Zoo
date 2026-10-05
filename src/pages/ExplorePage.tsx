import { useQuery } from '@tanstack/react-query';
import { Compass, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { api } from '../api/client';
import { EmptyState, PageLoader } from '../components/ui';
import { ZooCard } from '../components/ZooCard';

export function ExplorePage() {
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());
  const zoos = useQuery({ queryKey: ['zoos', 'explore', query], queryFn: () => api.explore(query), placeholderData: (prev) => prev });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Explore zoos</h1>
          <p>Browse plans the community published — hover any habitat for photos and details.</p>
        </div>
        <label className="input-with-icon explore-search">
          <Search />
          <input className="input" placeholder="Search zoos, species or builders" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {zoos.isPending ? (
        <PageLoader />
      ) : !zoos.data?.length ? (
        <EmptyState icon={<Compass />} title={query ? 'Nothing matches that search' : 'No published zoos yet'}>
          {query ? 'Try a species name like “Red Panda”, or a builder’s username.' : 'Be the first: plan a zoo and hit publish.'}
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
