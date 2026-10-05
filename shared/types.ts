import type { Biome, HabitatKind, HabitatStatus } from './constants';
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
  biome: Biome;
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

export interface ZooShape {
  points: Point[];
  color: string;
  kind: HabitatKind;
}

export interface ZooSummary {
  id: number;
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
}

export interface ZooDetail {
  id: number;
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
