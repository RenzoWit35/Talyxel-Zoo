import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Me } from '../shared/types';
import { api } from './api/client';

export function useMe() {
  const query = useQuery({ queryKey: ['me'], queryFn: api.me, staleTime: 5 * 60_000 });
  return { me: query.data ?? null, loading: query.isPending };
}

export function useAuthActions() {
  const qc = useQueryClient();
  const signedIn = (me: Me) => {
    qc.clear();
    qc.setQueryData(['me'], me);
  };
  const login = useMutation({ mutationFn: api.login, onSuccess: signedIn });
  const register = useMutation({ mutationFn: api.register, onSuccess: signedIn });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(['me'], null);
    },
  });
  return { login, register, logout };
}

/** Refresh everything that depends on who follows whom. */
export function useInvalidateSocial() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['profile', 'users', 'suggestions', 'followers', 'following', 'feed']) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}
