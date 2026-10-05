import type { Biome, HabitatKind, HabitatStatus, ParkType } from './constants';
import type { Point } from './geometry';

export interface UserSummary {
  id: number;
  username: string;
  displayName: string;
  avatarColor: string;
}

export interface Me extends UserSummary {
  bio: string;
}

export interface UserListItem extends UserSummary {
  bio: string;
  followers: number;
  publishedZoos: number;
  isFollowing: boolean;
  followsYou: boolean;
}

export interface Profile extends UserSummary {
  bio: string;
  createdAt: string;
  followers: number;
  following: number;
  isMe: boolean;
  isFollowing: boolean;
  followsYou: boolean;
  zoos: ZooSummary[];
}

export interface Photo {
  id: number;
  url: string;
  caption: string;
  createdAt: string;
}

export interface Habitat {
  id: number;
  zooId: number;
  name: string;
  kind: HabitatKind;
  status: HabitatStatus;
  /** Biome in zoos, theme in theme parks. */
  biome: Biome;
  /** Species in zoos, ride type in theme parks. */
  species: string;
  description: string;
  color: string;
  points: Point[];
  position: number;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
}

export interface SurveyOption {
  id: number;
  label: string;
  /** null while results are hidden from the viewer (they have not voted yet). */
  votes: number | null;
  suggestedBy: UserSummary | null;
}

export interface Survey {
  id: number;
  zooId: number;
  question: string;
  allowSuggestions: boolean;
  isOpen: boolean;
  createdAt: string;
  totalVotes: number;
  myVoteOptionId: number | null;
  resultsVisible: boolean;
  options: SurveyOption[];
}

export type ZooStatus = 'draft' | 'published';

export interface StatsCustomRow {
  label: string;
  value: string;
}

/** In-game statistics entered by hand (see shared/stats.ts for the fields per park type). */
export interface ParkStats {
  values: Record<string, number>;
  custom: StatsCustomRow[];
  /** In-game date the numbers are from, e.g. "Year 3, March". */
  gameDate: string;
  updatedAt: string;
  /** Values from the snapshot before this one (saved on an earlier day), to show what changed. */
  previous: Record<string, number> | null;
  previousAt: string | null;
}

export interface StatsInput {
  values: Record<string, number | null>;
  custom: StatsCustomRow[];
  gameDate: string;
}

export interface ZooShape {
  points: Point[];
  color: string;
  kind: HabitatKind;
}

export interface ZooSummary {
  id: number;
  parkType: ParkType;
  title: string;
  description: string;
  status: ZooStatus;
  width: number;
  height: number;
  publishedAt: string | null;
  updatedAt: string;
  owner: UserSummary;
  habitatCount: number;
  photoCount: number;
  coverUrl: string | null;
  hasOpenSurvey: boolean;
  shapes: ZooShape[];
  /** Guests from the latest in-game stats, when the owner entered them. */
  guests: number | null;
}

export interface ZooDetail {
  id: number;
  parkType: ParkType;
  title: string;
  description: string;
  status: ZooStatus;
  width: number;
  height: number;
  backgroundUrl: string | null;
  backgroundOpacity: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: UserSummary;
  isOwner: boolean;
  habitats: Habitat[];
  surveys: Survey[];
  stats: ParkStats | null;
}

export type FeedEventType = 'zoo_published' | 'habitat_added' | 'photos_added' | 'survey_created';

export interface FeedItem {
  id: number;
  type: FeedEventType;
  createdAt: string;
  actor: UserSummary;
  zoo: ZooSummary;
  habitat: Pick<Habitat, 'id' | 'name' | 'species' | 'kind' | 'status' | 'color' | 'description' | 'points'> | null;
  photos: Photo[];
  survey: { id: number; question: string; isOpen: boolean; totalVotes: number; optionCount: number } | null;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: number | null;
}

export interface ApiErrorBody {
  error: string;
}
