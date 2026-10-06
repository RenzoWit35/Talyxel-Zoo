import { useQuery } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { api } from '../api/client';
import { useMe } from '../auth';
import { EmptyState, PageLoader } from '../components/ui';
import { UserRow } from '../components/UserRow';

export function PeoplePage() {
  const { me } = useMe();
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());
  const users = useQuery({ queryKey: ['users', query], queryFn: () => api.users(query), placeholderData: (prev) => prev });
  const list = users.data?.filter((u) => u.id !== me?.id) ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="lp-pill">Builders</span>
          <h1>People</h1>
          <p>Follow builders to get their new habitats and surveys in your feed. Follow each other and you’re friends.</p>
        </div>
      </div>
      <label className="input-with-icon people-search">
        <Search />
        <input className="input" placeholder="Search by name or @username" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </label>
      {users.isPending ? (
        <PageLoader />
      ) : list.length === 0 ? (
        <EmptyState icon={<Users />} title={query ? `Nobody called “${query}” yet` : 'No other builders yet'}>
          Invite your friends to sign up and plan their zoos.
        </EmptyState>
      ) : (
        <div className="people-list">
          {list.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </div>
      )}
    </div>
  );
}
