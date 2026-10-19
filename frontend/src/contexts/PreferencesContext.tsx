import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';
export type Language = 'en' | 'ru';

const copy = {
  en: {
    community: 'MogGram community', apiPrivacy: 'Posts and anonymous publishing are managed by the MogGram Django API.',
    topics: 'Popular topics', topicsHint: 'What the university community is talking about.', campusCommunity: 'IUCA community', campusCommunityHint: 'A campus feed for the International University of Central Asia.', universityEmail: 'University email',
    actionUnavailable: 'Could not save this action. Check the Django API connection.', commentsUnavailable: 'Comments could not be loaded or sent.', you: 'You', noComments: 'No comments yet.', commentPlaceholder: 'Write a comment…', reply: 'Reply', like: 'Like', comment: 'Comment', repost: 'Repost',
    feed: 'Community feed', share: 'Share a thought with your university community.', writePost: 'Write a post', composerHint: 'Share something with the MogGram community.',
    postPlaceholder: "What's on your mind?", anonymous: 'Post anonymously', publish: 'Publish', publishing: 'Publishing…', latest: 'Latest posts',
    refresh: 'Refresh', loadingFeed: 'Loading the community feed…', feedUnavailable: 'The feed could not be loaded from Django.', tryAgain: 'Try again',
    quietFeed: 'The feed is quiet for now.', firstPost: 'Be the first to share something with the community.', anonymousUser: 'Anonymous user', postedAnonymously: 'Posted anonymously',
    profile: 'Profile', settings: 'Settings', logout: 'Log out', account: 'Your account', viewProfile: 'View your profile', manageSettings: 'Manage settings', searchPeople: 'Find people', messages: 'Messages',
    myProfile: 'My profile', myPosts: 'My posts', anonymousPrivate: 'Your anonymous posts are visible here only to you.', noPosts: 'You have not published anything yet.',
    backToFeed: 'Back to feed', preferences: 'Preferences', appearance: 'Appearance', appearanceHint: 'Choose how MogGram looks on this device.', dark: 'Dark', light: 'Light',
    language: 'Language', languageHint: 'Choose the language used in MogGram.', english: 'English', russian: 'Русский', notifications: 'Notifications', notificationsHint: 'Choose which updates you want to receive.',
    emailNotifications: 'Email updates', emailNotificationsHint: 'Important account and community updates.', mentions: 'Mentions and replies', mentionsHint: 'When someone mentions or replies to you.', security: 'Security',
    securityHint: 'Manage your password and account access.', resetPassword: 'Reset password', save: 'Save preferences', saved: 'Preferences saved on this device.', syncError: 'Saved on this device, but could not sync with Django.',
    profileIntro: 'Your posts and contributions to the community.', anonymousOnlyYou: 'Anonymous · only you can see this',
  },
  ru: {
    community: 'Сообщество MogGram', apiPrivacy: 'Публикации и анонимность обрабатываются сервером MogGram на Django.',
    topics: 'Популярные темы', topicsHint: 'О чём говорят в университетском сообществе.', campusCommunity: 'Сообщество IUCA', campusCommunityHint: 'Лента для студентов Международного университета в Центральной Азии.', universityEmail: 'Почта университета',
    actionUnavailable: 'Не удалось сохранить действие. Проверь подключение Django API.', commentsUnavailable: 'Не удалось загрузить или отправить комментарий.', you: 'Вы', noComments: 'Комментариев пока нет.', commentPlaceholder: 'Написать комментарий…', reply: 'Ответить', like: 'Нравится', comment: 'Комментировать', repost: 'Репост',
    feed: 'Общая лента', share: 'Поделись мыслью с сообществом университета.', writePost: 'Новая публикация', composerHint: 'Расскажи что-нибудь сообществу MogGram.',
    postPlaceholder: 'О чём думаешь?', anonymous: 'Опубликовать анонимно', publish: 'Опубликовать', publishing: 'Публикуем…', latest: 'Свежие публикации',
    refresh: 'Обновить', loadingFeed: 'Загружаем ленту…', feedUnavailable: 'Не удалось загрузить ленту из Django.', tryAgain: 'Повторить',
    quietFeed: 'Пока здесь тихо.', firstPost: 'Стань первым, кто поделится чем-нибудь с сообществом.', anonymousUser: 'Анонимный пользователь', postedAnonymously: 'Опубликовано анонимно',
    profile: 'Профиль', settings: 'Настройки', logout: 'Выйти', account: 'Твой аккаунт', viewProfile: 'Открыть профиль', manageSettings: 'Настройки аккаунта', searchPeople: 'Поиск', messages: 'Сообщения',
    myProfile: 'Мой профиль', myPosts: 'Мои публикации', anonymousPrivate: 'Твои анонимные публикации видны здесь только тебе.', noPosts: 'Ты пока ничего не опубликовал.',
    backToFeed: 'Вернуться в ленту', preferences: 'Предпочтения', appearance: 'Внешний вид', appearanceHint: 'Выбери оформление MogGram на этом устройстве.', dark: 'Тёмная', light: 'Светлая',
    language: 'Язык', languageHint: 'Выбери язык интерфейса MogGram.', english: 'English', russian: 'Русский', notifications: 'Уведомления', notificationsHint: 'Выбери, какие обновления получать.',
    emailNotifications: 'Письма о событиях', emailNotificationsHint: 'Важные обновления аккаунта и сообщества.', mentions: 'Упоминания и ответы', mentionsHint: 'Когда тебя упоминают или отвечают тебе.', security: 'Безопасность',
    securityHint: 'Управление паролем и доступом к аккаунту.', resetPassword: 'Сбросить пароль', save: 'Сохранить настройки', saved: 'Настройки сохранены на этом устройстве.', syncError: 'Сохранено на устройстве, но не удалось синхронизировать с Django.',
    profileIntro: 'Твои публикации и вклад в сообщество.', anonymousOnlyYou: 'Анонимно · видно только тебе',
  },
} as const;

type CopyKey = keyof typeof copy.en;
interface PreferencesValue {
  theme: Theme;
  language: Language;
  setTheme: (value: Theme) => void;
  setLanguage: (value: Language) => void;
  showOnlineStatus: boolean;
  setShowOnlineStatus: (value: boolean) => void;
  showOwnAnonymousPosts: boolean;
  setShowOwnAnonymousPosts: (value: boolean) => void;
  showOwnReposts: boolean;
  setShowOwnReposts: (value: boolean) => void;
  showOwnLikedPosts: boolean;
  setShowOwnLikedPosts: (value: boolean) => void;
  showOwnCommentedPosts: boolean;
  setShowOwnCommentedPosts: (value: boolean) => void;
  t: (key: CopyKey) => string;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);
const THEME_KEY = 'moggram.theme';
const LANGUAGE_KEY = 'moggram.language';
const ONLINE_STATUS_KEY = 'moggram.showOnlineStatus';
const OWN_ANONYMOUS_POSTS_KEY = 'moggram.showOwnAnonymousPosts';
const OWN_REPOSTS_KEY = 'moggram.showOwnReposts';
const OWN_LIKED_POSTS_KEY = 'moggram.showOwnLikedPosts';
const OWN_COMMENTED_POSTS_KEY = 'moggram.showOwnCommentedPosts';

function storedChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const value = localStorage.getItem(key);
  return allowed.includes(value as T) ? value as T : fallback;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => storedChoice(THEME_KEY, ['dark', 'light'], 'dark'));
  const [language, setLanguageState] = useState<Language>(() => storedChoice(LANGUAGE_KEY, ['en', 'ru'], 'ru'));
  const [showOnlineStatus, setShowOnlineStatusState] = useState(() => localStorage.getItem(ONLINE_STATUS_KEY) !== 'false');
  const [showOwnAnonymousPosts, setShowOwnAnonymousPostsState] = useState(() => localStorage.getItem(OWN_ANONYMOUS_POSTS_KEY) === 'true');
  const [showOwnReposts, setShowOwnRepostsState] = useState(() => localStorage.getItem(OWN_REPOSTS_KEY) === 'true');
  const [showOwnLikedPosts, setShowOwnLikedPostsState] = useState(() => localStorage.getItem(OWN_LIKED_POSTS_KEY) === 'true');
  const [showOwnCommentedPosts, setShowOwnCommentedPostsState] = useState(() => localStorage.getItem(OWN_COMMENTED_POSTS_KEY) === 'true');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme, language]);

  const setTheme = (value: Theme) => setThemeState(value);
  const setLanguage = (value: Language) => {
    setLanguageState(value);
    localStorage.setItem(LANGUAGE_KEY, value);
  };
  const setShowOnlineStatus = (value: boolean) => {
    setShowOnlineStatusState(value);
    localStorage.setItem(ONLINE_STATUS_KEY, String(value));
  };
  const setShowOwnAnonymousPosts = (value: boolean) => {
    setShowOwnAnonymousPostsState(value);
    localStorage.setItem(OWN_ANONYMOUS_POSTS_KEY, String(value));
  };
  const setShowOwnReposts = (value: boolean) => {
    setShowOwnRepostsState(value);
    localStorage.setItem(OWN_REPOSTS_KEY, String(value));
  };
  const setShowOwnLikedPosts = (value: boolean) => {
    setShowOwnLikedPostsState(value);
    localStorage.setItem(OWN_LIKED_POSTS_KEY, String(value));
  };
  const setShowOwnCommentedPosts = (value: boolean) => {
    setShowOwnCommentedPostsState(value);
    localStorage.setItem(OWN_COMMENTED_POSTS_KEY, String(value));
  };
  const value = useMemo<PreferencesValue>(() => ({ theme, language, setTheme, setLanguage, showOnlineStatus, setShowOnlineStatus, showOwnAnonymousPosts, setShowOwnAnonymousPosts, showOwnReposts, setShowOwnReposts, showOwnLikedPosts, setShowOwnLikedPosts, showOwnCommentedPosts, setShowOwnCommentedPosts, t: (key) => copy[language][key] }), [theme, language, showOnlineStatus, showOwnAnonymousPosts, showOwnReposts, showOwnLikedPosts, showOwnCommentedPosts]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return context;
}
