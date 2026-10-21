export interface User {
  id: string;
  fullName: string;
  email: string;
  username: string;
  isVerified?: boolean;
  isTeacher?: boolean;
  avatarUrl?: string | null;
  followersCount?: number;
  followingCount?: number;
}

export interface PostAuthor {
  id: string;
  fullName: string;
  username: string;
  isVerified?: boolean;
  avatarUrl?: string | null;
}

export interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
}

export interface CommentActivity {
  post: Post;
  comment: PostComment;
}

export interface Post {
  id: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  author: PostAuthor | null;
  likeCount?: number;
  commentCount?: number;
  repostCount?: number;
  repostedByMe?: boolean;
  likedByMe?: boolean;
  imageUrl?: string | null;
  linkUrl?: string | null;
}

export interface CampusProfile extends PostAuthor {
  bio?: string;
  postCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOnline?: boolean;
  showReposts?: boolean;
  showLikedPosts?: boolean;
  showCommentedPosts?: boolean;
}

export interface DirectMessage {
  id: string;
  content: string;
  createdAt: string;
  isRead?: boolean;
  senderId: string;
  senderName: string;
  senderUsername: string;
  recipientUsername: string;
  attachmentUrl?: string | null;
  attachmentType?: 'image' | 'audio' | null;
  attachmentName?: string | null;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  } | null;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}
