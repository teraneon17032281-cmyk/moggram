import { api } from './apiClient';
import type { Language, Theme } from '../contexts/PreferencesContext';

export interface NotificationPreferences {
  emailUpdates: boolean;
  mentionsAndReplies: boolean;
}

export const preferencesService = {
  save: (preferences: { theme: Theme; language: Language; notifications: NotificationPreferences; showOnlineStatus: boolean; showOwnAnonymousPosts: boolean; showOwnReposts: boolean; showOwnLikedPosts: boolean; showOwnCommentedPosts: boolean }) =>
    api.post('/api/auth/preferences/', {
      theme: preferences.theme,
      language: preferences.language,
      show_online_status: preferences.showOnlineStatus,
      show_own_anonymous_posts: preferences.showOwnAnonymousPosts,
      show_own_reposts: preferences.showOwnReposts,
      show_own_liked_posts: preferences.showOwnLikedPosts,
      show_own_commented_posts: preferences.showOwnCommentedPosts,
      notifications: {
        email_updates: preferences.notifications.emailUpdates,
        mentions_and_replies: preferences.notifications.mentionsAndReplies,
      },
    }),
  updatePresence: (visible: boolean) => api.post('/api/auth/presence/', { visible }),
};
