import { api } from './apiClient';

export type NotificationKind = 'like' | 'repost' | 'comment' | 'follow' | 'message';
export interface NotificationItem { id:number; kind:NotificationKind; actorName:string; actorUsername:string; avatarUrl:string|null; postId:number|null; commentId:number|null; messageId:number|null; createdAt:string; isRead:boolean; }
interface ApiNotification { id:number; kind:NotificationKind; actor_name:string; actor_username:string; avatar_url:string|null; post_id:number|null; comment_id:number|null; message_id:number|null; created_at:string; is_read:boolean; }
interface ApiResponse { results:ApiNotification[]; unread_count:number; unread_messages:number; }
export interface NotificationSnapshot { items:NotificationItem[]; unreadCount:number; unreadMessages:number; }

export const notificationService = {
  async get(): Promise<NotificationSnapshot> {
    const response = await api.get<ApiResponse>('/api/notifications/');
    if (!response || !Array.isArray(response.results)) throw new Error('invalid notifications response');
    return {
      items: response.results.map((item) => ({ id:item.id, kind:item.kind, actorName:item.actor_name, actorUsername:item.actor_username, avatarUrl:item.avatar_url, postId:item.post_id, commentId:item.comment_id, messageId:item.message_id, createdAt:item.created_at, isRead:item.is_read })),
      unreadCount: response.unread_count ?? 0,
      unreadMessages: response.unread_messages ?? 0,
    };
  },
  markRead(ids?: number[]) { return api.post<{ updated:number }>('/api/notifications/read/', ids ? { ids } : { all:true }); },
};
