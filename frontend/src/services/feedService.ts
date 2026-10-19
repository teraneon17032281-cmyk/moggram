import { api, apiError } from './apiClient';
import type { CommentActivity, Post, PostAuthor, PostComment } from '../types';

interface ApiAuthor {
  id: string | number;
  full_name: string;
  username: string;
  is_verified?: boolean;
  avatar_url?: string | null;
}

interface ApiPost {
  id: string | number;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  author: ApiAuthor | null;
  like_count?: number;
  comment_count?: number;
  repost_count?: number;
  reposted_by_me?: boolean;
  liked_by_me?: boolean;
  image_url?: string | null;
  link_url?: string | null;
}

interface ApiComment {
  id: string | number;
  content: string;
  created_at: string;
  author: ApiAuthor;
}

interface ApiCommentActivity {
  post: ApiPost;
  comment: ApiComment;
}

interface PostListResponse {
  results: ApiPost[];
}

function mapPost(post: ApiPost): Post {
  if (!post || post.id === undefined || typeof post.content !== 'string' || typeof post.created_at !== 'string') {
    throw apiError('invalid_response');
  }
  const author: PostAuthor | null = post.author
    ? {
        id: String(post.author.id),
        fullName: post.author.full_name,
        username: post.author.username,
        isVerified: post.author.is_verified === true,
        avatarUrl: post.author.avatar_url ?? null,
      }
    : null;
  return {
    id: String(post.id),
    content: post.content,
    isAnonymous: post.is_anonymous === true,
    createdAt: post.created_at,
    author,
    likeCount: post.like_count ?? 0,
    commentCount: post.comment_count ?? 0,
    repostCount: post.repost_count ?? 0,
    repostedByMe: post.reposted_by_me === true,
    likedByMe: post.liked_by_me === true,
    imageUrl: post.image_url ?? null,
    linkUrl: post.link_url ?? null,
  };
}

function listFrom(data: PostListResponse | ApiPost[] | null): Post[] {
  const posts = Array.isArray(data) ? data : data?.results;
  if (!Array.isArray(posts)) throw apiError('invalid_response');
  return posts.map(mapPost);
}

function mapComment(comment: ApiComment): PostComment {
  if (!comment || comment.id === undefined || typeof comment.content !== 'string' || typeof comment.created_at !== 'string' || !comment.author) {
    throw apiError('invalid_response');
  }
  return {
    id: String(comment.id), content: comment.content, createdAt: comment.created_at,
    author: {
      id: String(comment.author.id), fullName: comment.author.full_name, username: comment.author.username,
      isVerified: comment.author.is_verified === true, avatarUrl: comment.author.avatar_url ?? null,
    },
  };
}

function commentActivityFrom(data: { results: ApiCommentActivity[] } | ApiCommentActivity[] | null): CommentActivity[] {
  const results = Array.isArray(data) ? data : data?.results;
  if (!Array.isArray(results)) throw apiError('invalid_response');
  return results.map((item) => ({ post: mapPost(item.post), comment: mapComment(item.comment) }));
}

export const feedService = {
  async getFeed(): Promise<Post[]> {
    return listFrom(await api.get<PostListResponse | ApiPost[]>('/api/posts/'));
  },

  async getMyPosts(): Promise<Post[]> {
    return listFrom(await api.get<PostListResponse | ApiPost[]>('/api/posts/mine/'));
  },

  async getMyReposts(): Promise<Post[]> {
    return listFrom(await api.get<PostListResponse | ApiPost[]>('/api/users/me/reposts/'));
  },

  async getMyLikedPosts(): Promise<Post[]> {
    return listFrom(await api.get<PostListResponse | ApiPost[]>('/api/users/me/liked-posts/'));
  },

  async getMyCommentedPosts(): Promise<CommentActivity[]> {
    return commentActivityFrom(await api.get<{ results: ApiCommentActivity[] } | ApiCommentActivity[]>('/api/users/me/commented-posts/'));
  },

  async createPost(content: string, isAnonymous: boolean, linkUrl?: string, image?: File): Promise<Post> {
    const body = image ? new FormData() : undefined;
    if (body) {
      body.append('content', content.trim());
      body.append('is_anonymous', String(isAnonymous));
      if (linkUrl?.trim()) body.append('link_url', linkUrl.trim());
      body.append('attachment', image!);
    }
    const data = await api.post<ApiPost>('/api/posts/', body ?? { content: content.trim(), is_anonymous: isAnonymous, link_url: linkUrl?.trim() || null });
    return mapPost(data);
  },

  async getUserPosts(username: string): Promise<Post[]> {
    return listFrom(await api.get<PostListResponse | ApiPost[]>(`/api/users/${encodeURIComponent(username)}/posts/`));
  },

  async getUserReposts(username: string): Promise<Post[]> {
    return listFrom(await api.get<PostListResponse | ApiPost[]>(`/api/users/${encodeURIComponent(username)}/reposts/`));
  },

  async getUserLikedPosts(username: string): Promise<Post[]> {
    return listFrom(await api.get<PostListResponse | ApiPost[]>(`/api/users/${encodeURIComponent(username)}/liked-posts/`));
  },

  async getUserCommentedPosts(username: string): Promise<CommentActivity[]> {
    return commentActivityFrom(await api.get<{ results: ApiCommentActivity[] } | ApiCommentActivity[]>(`/api/users/${encodeURIComponent(username)}/commented-posts/`));
  },

  async toggleLike(postId: string): Promise<{ liked: boolean; likeCount: number }> {
    const result = await api.post<{ liked: boolean; like_count: number }>(`/api/posts/${encodeURIComponent(postId)}/like/`);
    if (typeof result?.liked !== 'boolean' || typeof result?.like_count !== 'number') throw apiError('invalid_response');
    return { liked: result.liked, likeCount: result.like_count };
  },

  async toggleRepost(postId: string): Promise<{ reposted: boolean; repostCount: number }> {
    const result = await api.post<{ reposted?: boolean; repost_count: number }>(`/api/posts/${encodeURIComponent(postId)}/repost/`);
    if (typeof result?.repost_count !== 'number') throw apiError('invalid_response');
    return { reposted: result.reposted ?? true, repostCount: result.repost_count };
  },

  async getComments(postId: string): Promise<PostComment[]> {
    const data = await api.get<{ results: ApiComment[] } | ApiComment[]>(`/api/posts/${encodeURIComponent(postId)}/comments/`);
    const results = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(results)) throw apiError('invalid_response');
    return results.map(mapComment);
  },

  async addComment(postId: string, content: string): Promise<PostComment> {
    const comment = await api.post<ApiComment>(`/api/posts/${encodeURIComponent(postId)}/comments/`, { content: content.trim() });
    if (!comment || typeof comment.content !== 'string' || !comment.author) throw apiError('invalid_response');
    return mapComment(comment);
  },
};
