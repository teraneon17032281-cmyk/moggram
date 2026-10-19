import { api, apiError } from './apiClient';
import type { CampusProfile } from '../types';

interface ApiCampusUser {
  id: string | number;
  full_name: string;
  username: string;
  avatar_url?: string | null;
  is_verified?: boolean;
  bio?: string;
  post_count?: number;
  followers_count?: number;
  following_count?: number;
  is_following?: boolean;
  is_online?: boolean | null;
  show_reposts?: boolean;
  show_liked_posts?: boolean;
  show_commented_posts?: boolean;
}

interface UserListResponse { results: ApiCampusUser[] }

function mapUser(user: ApiCampusUser): CampusProfile {
  if (!user || user.id === undefined || typeof user.full_name !== 'string' || typeof user.username !== 'string') {
    throw apiError('invalid_response');
  }
  return {
    id: String(user.id), fullName: user.full_name, username: user.username,
    avatarUrl: user.avatar_url ?? null, isVerified: user.is_verified === true,
    bio: user.bio ?? '', postCount: user.post_count ?? 0,
    followersCount: user.followers_count ?? 0, followingCount: user.following_count ?? 0,
    isFollowing: user.is_following === true,
    ...(typeof user.is_online === 'boolean' ? { isOnline: user.is_online } : {}),
    showReposts: user.show_reposts === true,
    showLikedPosts: user.show_liked_posts === true,
    showCommentedPosts: user.show_commented_posts === true,
  };
}

export const userService = {
  async search(query: string): Promise<CampusProfile[]> {
    const params = new URLSearchParams({ search: query.trim().replace(/^@/, '') });
    const data = await api.get<UserListResponse | ApiCampusUser[]>(`/api/users/?${params.toString()}`);
    const users = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(users)) throw apiError('invalid_response');
    return users.map(mapUser);
  },

  async getProfile(username: string): Promise<CampusProfile> {
    const data = await api.get<ApiCampusUser>(`/api/users/${encodeURIComponent(username)}/`);
    return mapUser(data);
  },

  async getMyProfile(): Promise<CampusProfile> {
    const data = await api.get<ApiCampusUser>('/api/users/me/');
    return mapUser(data);
  },

  async updateMyProfile(values: { fullName: string; username: string; bio: string; avatar?: File | null }): Promise<CampusProfile> {
    const form = new FormData();
    form.set('full_name', values.fullName.trim());
    form.set('username', values.username.trim());
    form.set('bio', values.bio.trim());
    if (values.avatar) form.set('avatar', values.avatar);
    return mapUser(await api.post<ApiCampusUser>('/api/users/me/', form));
  },

  async getFollowList(username: string, relation: 'followers' | 'following'): Promise<CampusProfile[]> {
    const data = await api.get<UserListResponse>(`/api/users/${encodeURIComponent(username)}/${relation}/`);
    if (!Array.isArray(data?.results)) throw apiError('invalid_response');
    return data.results.map(mapUser);
  },

  async toggleFollow(username: string): Promise<{ following: boolean; followersCount: number }> {
    const result = await api.post<{ following: boolean; followers_count: number }>(`/api/users/${encodeURIComponent(username)}/follow/`);
    if (typeof result?.following !== 'boolean' || typeof result.followers_count !== 'number') throw apiError('invalid_response');
    return { following: result.following, followersCount: result.followers_count };
  },
};
