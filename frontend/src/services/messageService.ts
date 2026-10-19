import { api, apiError } from './apiClient';
import type { DirectMessage, MessageReaction } from '../types';

interface ApiMessage {
  id: string | number;
  content: string;
  created_at: string;
  is_read?: boolean;
  sender_id: string | number;
  sender_name: string;
  sender_username: string;
  recipient_username: string;
  attachment_url?: string | null;
  attachment_type?: 'image' | 'audio' | null;
  attachment_name?: string | null;
  reply_to?: { id: string | number; content: string; sender_name: string } | null;
  reactions?: { emoji: string; count: number; reacted_by_me: boolean }[];
}

interface MessageListResponse { results: ApiMessage[] }

export interface ConversationSummary {
  username: string;
  fullName: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  lastMessage: DirectMessage;
}

interface ApiConversation {
  username: string;
  full_name: string;
  avatar_url?: string | null;
  is_online?: boolean;
  last_message: ApiMessage;
}

function mapMessage(message: ApiMessage): DirectMessage {
  if (!message || message.id === undefined || typeof message.content !== 'string' || typeof message.created_at !== 'string') {
    throw apiError('invalid_response');
  }
  return {
    id: String(message.id), content: message.content, createdAt: message.created_at, isRead: message.is_read ?? false,
    senderId: String(message.sender_id), senderName: message.sender_name,
    senderUsername: message.sender_username, recipientUsername: message.recipient_username,
    attachmentUrl: message.attachment_url ?? null,
    attachmentType: message.attachment_type ?? null,
    attachmentName: message.attachment_name ?? null,
    replyTo: message.reply_to ? {
      id: String(message.reply_to.id),
      content: message.reply_to.content,
      senderName: message.reply_to.sender_name,
    } : null,
    reactions: (message.reactions ?? []).map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
      reactedByMe: reaction.reacted_by_me,
    })),
  };
}

export const messageService = {
  async getConversations(): Promise<ConversationSummary[]> {
    const data = await api.get<{ results: ApiConversation[] } | ApiConversation[]>('/api/messages/conversations/');
    const conversations = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(conversations)) throw apiError('invalid_response');
    return conversations.map((item) => ({
      username: item.username,
      fullName: item.full_name,
      avatarUrl: item.avatar_url ?? null,
      isOnline: item.is_online,
      lastMessage: mapMessage(item.last_message),
    }));
  },

  async getConversation(username: string): Promise<DirectMessage[]> {
    const params = new URLSearchParams({ with: username });
    const data = await api.get<MessageListResponse | ApiMessage[]>(`/api/messages/?${params.toString()}`);
    const messages = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(messages)) throw apiError('invalid_response');
    return messages.map(mapMessage);
  },

  async send(username: string, content: string, attachment?: File | null, replyToId?: string | null): Promise<DirectMessage> {
    const body: FormData | { recipient_username: string; content: string; reply_to_id?: string } = attachment
      ? new FormData()
      : { recipient_username: username, content: content.trim() };
    if (body instanceof FormData) {
      body.set('recipient_username', username);
      body.set('content', content.trim());
      body.set('attachment', attachment!);
      if (replyToId) body.set('reply_to_id', replyToId);
    } else if (replyToId) {
      body.reply_to_id = replyToId;
    }
    const data = await api.post<ApiMessage>('/api/messages/', body);
    return mapMessage(data);
  },

  async toggleReaction(messageId: string, emoji: string): Promise<MessageReaction[]> {
    const result = await api.post<{ reactions?: { emoji: string; count: number; reacted_by_me: boolean }[] }>(
      `/api/messages/${encodeURIComponent(messageId)}/reactions/`,
      { emoji },
    );
    if (!Array.isArray(result?.reactions)) throw apiError('invalid_response');
    return result.reactions.map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
      reactedByMe: reaction.reacted_by_me,
    }));
  },

  async forward(messageId: string, recipientUsername: string): Promise<DirectMessage> {
    const result = await api.post<ApiMessage>(
      `/api/messages/${encodeURIComponent(messageId)}/forward/`,
      { recipient_username: recipientUsername },
    );
    return mapMessage(result);
  },
};
