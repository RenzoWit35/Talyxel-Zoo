import type { HabitatStatus, ParkType } from '../../shared/constants';
import type {
  Comment,
  FeedItem,
  FeedFilter,
  FeedPage,
  Habitat,
  LikeState,
  NotificationsPage,
  Onboarding,
  Me,
  ParkStats,
  PostKind,
  Profile,
  StatsInput,
  Survey,
  UserListItem,
  ZooDetail,
  ZooSummary,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const init: RequestInit = { method, headers, credentials: 'same-origin' };
  if (method !== 'GET') headers['x-talyxel'] = '1';
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${url}`, init);
  } catch {
    throw new ApiError(0, 'Could not reach the server — check your connection');
  }
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

const get = <T>(url: string) => request<T>('GET', url);
const post = <T>(url: string, body?: unknown) => request<T>('POST', url, body);
const patch = <T>(url: string, body: unknown) => request<T>('PATCH', url, body);
const put = <T>(url: string, body?: unknown) => request<T>('PUT', url, body);
const del = <T>(url: string) => request<T>('DELETE', url);
const enc = encodeURIComponent;

export interface SurveyDraft {
  question: string;
  options: string[];
  allowSuggestions: boolean;
}

export type HabitatInput = Partial<Pick<Habitat, 'name' | 'kind' | 'status' | 'biome' | 'species' | 'description' | 'reason' | 'color' | 'points'>>;

export const api = {
  me: () => get<Me | null>('/auth/me'),
  register: (body: { username: string; password: string; displayName?: string }) => post<Me>('/auth/register', body),
  login: (body: { username: string; password: string }) => post<Me>('/auth/login', body),
  logout: () => post<{ ok: true }>('/auth/logout'),
  updateProfile: (body: Partial<Pick<Me, 'displayName' | 'bio' | 'avatarColor'>>) => patch<Me>('/auth/me', body),

  users: (q = '') => get<UserListItem[]>(`/users?q=${enc(q)}`),
  suggestions: () => get<UserListItem[]>('/users/suggestions'),
  profile: (username: string) => get<Profile>(`/users/${enc(username)}`),
  followers: (username: string) => get<UserListItem[]>(`/users/${enc(username)}/followers`),
  following: (username: string) => get<UserListItem[]>(`/users/${enc(username)}/following`),
  follow: (username: string) => put<{ following: boolean }>(`/users/${enc(username)}/follow`),
  unfollow: (username: string) => del<{ following: boolean }>(`/users/${enc(username)}/follow`),

  myZoos: () => get<ZooSummary[]>('/zoos/mine'),
  explore: (q = '', type: ParkType | '' = '') => get<ZooSummary[]>(`/zoos/explore?q=${enc(q)}&type=${type}`),
  zoo: (id: number) => get<ZooDetail>(`/zoos/${id}`),
  createZoo: (body: { parkType: ParkType; title: string; description?: string; width: number; height: number }) => post<ZooDetail>('/zoos', body),
  updateZoo: (
    id: number,
    body: Partial<{ parkType: ParkType; title: string; description: string; principle: string; width: number; height: number; backgroundOpacity: number }>,
  ) =>
    patch<ZooDetail>(`/zoos/${id}`, body),
  deleteZoo: (id: number) => del<{ ok: true }>(`/zoos/${id}`),
  setBackground: (id: number, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return put<ZooDetail>(`/zoos/${id}/background`, form);
  },
  removeBackground: (id: number) => del<ZooDetail>(`/zoos/${id}/background`),
  saveStats: (id: number, body: StatsInput) => put<ParkStats>(`/zoos/${id}/stats`, body),
  publish: (id: number, survey?: SurveyDraft) => post<ZooDetail>(`/zoos/${id}/publish`, { survey }),
  unpublish: (id: number) => post<ZooDetail>(`/zoos/${id}/unpublish`),

  createHabitat: (zooId: number, body: HabitatInput & { points: Habitat['points'] }) => post<Habitat>(`/zoos/${zooId}/habitats`, body),
  updateHabitat: (id: number, body: HabitatInput) => patch<Habitat>(`/habitats/${id}`, body),
  deleteHabitat: (id: number) => del<{ ok: true }>(`/habitats/${id}`),
  saveBoard: (zooId: number, columns: Partial<Record<HabitatStatus, number[]>>) => put<Habitat[]>(`/zoos/${zooId}/board`, { columns }),
  uploadPhotos: (habitatId: number, files: File[], caption = '') => {
    const form = new FormData();
    for (const f of files) form.append('photos', f);
    form.append('caption', caption);
    return post<Habitat>(`/habitats/${habitatId}/photos`, form);
  },
  addPhotoUrl: (habitatId: number, url: string, caption = '') => post<Habitat>(`/habitats/${habitatId}/photos`, { url, caption }),
  updatePhoto: (id: number, caption: string) => patch<Habitat>(`/photos/${id}`, { caption }),
  deletePhoto: (id: number) => del<Habitat>(`/photos/${id}`),

  createSurvey: (zooId: number, body: SurveyDraft) => post<Survey>(`/zoos/${zooId}/surveys`, body),
  vote: (surveyId: number, optionId: number) => post<Survey>(`/surveys/${surveyId}/vote`, { optionId }),
  unvote: (surveyId: number) => del<Survey>(`/surveys/${surveyId}/vote`),
  suggest: (surveyId: number, label: string) => post<Survey>(`/surveys/${surveyId}/options`, { label }),
  deleteOption: (surveyId: number, optionId: number) => del<Survey>(`/surveys/${surveyId}/options/${optionId}`),
  setSurveyOpen: (surveyId: number, isOpen: boolean) => patch<Survey>(`/surveys/${surveyId}`, { isOpen }),
  deleteSurvey: (surveyId: number) => del<{ ok: true }>(`/surveys/${surveyId}`),

  feed: (before?: number, filter: FeedFilter = 'all') => get<FeedPage>(`/feed?filter=${filter}${before ? `&before=${before}` : ''}`),

  createPost: (body: { kind: PostKind; body: string; zooId?: number | null; photos: File[] }) => {
    const form = new FormData();
    form.append('kind', body.kind);
    form.append('body', body.body);
    if (body.zooId) form.append('zooId', String(body.zooId));
    for (const f of body.photos) form.append('photos', f);
    return post<FeedItem>('/posts', form);
  },
  activity: (id: number) => get<FeedItem>(`/activity/${id}`),
  deleteActivity: (id: number) => del<{ ok: true }>(`/activity/${id}`),
  like: (id: number) => put<LikeState>(`/activity/${id}/like`),
  unlike: (id: number) => del<LikeState>(`/activity/${id}/like`),
  comments: (id: number) => get<Comment[]>(`/activity/${id}/comments`),
  addComment: (id: number, body: string) => post<Comment>(`/activity/${id}/comments`, { body }),
  deleteComment: (id: number) => del<{ ok: true }>(`/comments/${id}`),
  userPosts: (username: string) => get<FeedItem[]>(`/users/${enc(username)}/posts`),

  notifications: () => get<NotificationsPage>('/notifications'),
  markNotificationsRead: () => post<{ unread: number }>('/notifications/read'),

  onboarding: () => get<Onboarding>('/onboarding'),
  setOnboardingDismissed: (dismissed: boolean) => put<Onboarding>('/onboarding', { dismissed }),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}
