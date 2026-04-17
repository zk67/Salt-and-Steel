import { StatKey } from '@common/enums/player.enums';

export const CHARACTER_STAT_DESCRIPTIONS: Record<StatKey, string> = {
  [StatKey.Hp]: 'Points de vie. À 0, ton personnage est vaincu.',
  [StatKey.Speed]: 'Détermine qui agit en premier et aide à esquiver les coups.',
  [StatKey.Attack]: 'Ta force offensive. En combat, tu lances le dé assigné à  Attaque.',
  [StatKey.Defense]: 'Ta résistance. En combat, tu lances le dé assigné à  Défense.',
};

export const CHARACTER_PAGE_AVATARS: string[] = Array.from(
  { length: 12 },
  (_, i) => `assets/avatars/avatar-${i + 1}.png`,
);

export const CHARACTER_PAGE_REFRESH_FLAG = 'waitingPageRefresh';
export const MESSAGE_SHOW_TIME = 1000;
export const PERCENTAGE = 100;
export const TIME_CONVERSION = 60;
export const TIME_BEFORE_NAVIGATE_HOME = 5000;
export const TIME_BEFORE_NAVIGATING_HOME = 10;
export const WAITING_PAGE_REFRESH_FLAG = 'waitingPageRefresh';
export const DEFAULT_NOTIFICATION_DURATION_MS = 3000;
export const MAX_NAME_LENGTH = 30;
export const MAX_DESCRIPTION_LENGTH = 100;
export const MIN_NAME_LENGTH = 3;
export const STATISTICS_PAGE_REFRESH_FLAG = 'statistics-page-refresh-flag';
export const MAX_PLAYERS = 6;