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