import { StatKey } from '@common/enums/player.enums';

export const BASE_HP = 6;
export const BASE_SPEED = 6;
export const BASE_ATTACK = 4;
export const BASE_DEFENSE = 4;
export const HALF_RANDOM = 0.5;
export const MESSAGE_SHOW_TIME = 1000;
export const CHARACTER_PAGE_REFRESH_FLAG = 'waitingPageRefresh';

export const CHARACTER_STAT_DESCRIPTIONS: Record<StatKey, string> = {
  [StatKey.Hp]: 'Points de vie. À 0, ton personnage est vaincu.',
  [StatKey.Speed]: 'Détermine qui agit en premier et aide à esquiver les coups.',
  [StatKey.Attack]: 'Ta force offensive. En combat, tu lances le dé assigné à  Attaque.',
  [StatKey.Defense]: 'Ta résistance. En combat, tu lances le dé assigné à  Défense.',
};
export const PIRATE_NAMES: string[] = [
  'Barbe-Noire',
  'Anne la Rouge',
  'Jack le Borgne',
  'Capitaine Flint',
  "Mary l'Écarlate",
  "Le Crochet d'Argent",
  'Barbe-de-Fer',
  'Samuel Tempête',
  'Ragnar le Cruel',
  'Isabella la Furie',
  "Morgan l'Ombre",
  'Le Loup des Mers',
  'Edward le Sanguinaire',
  'Nina Vents-Noirs',
  'Capitaine Corbeau',
  'Le Kraken Fou',
  'Hector Brise-Lames',
  'Bartholomew le Rusé',
  'La Veuve Noire',
  'Jonas Trois-Doigts',
  'Pedro Lame-Rapide',
  'Viktor Barbe-Blanche',
  'Le Requin Rouge',
  'Thomas Coupe-Gorge',
  "Elena l'Ouragan",
  'Capitaine Mistral',
  'Le Fantôme des Flots',
  'Ivan le Marteau',
  "Sofia Dents-d'Or",
  'Le Serpent de Mer',
  'William Long-Sabre',
  'Carmen Feu-Vert',
  'Le Balafré',
  'Nathaniel Brume',
  'La Tigresse des Îles',
  'Marco Tempête-de-Sable',
  'Le Chacal Noir',
  'Rosa Poignard',
  'Capitaine Tonnerre',
  'Le Corsaire Écarlate',
  'Boris Coupe-Ancre',
  'Luna Vague-Sombre',
  'Le Vautour des Mers',
  "Gabriel Croc-d'Acier",
  'Mila Brise-Os',
  'Le Baron des Flots',
  'Élias Vent-du-Nord',
];

export const CHARACTER_PAGE_AVATARS: string[] = Array.from(
  { length: 12 },
  (_, i) => `assets/avatars/avatar-${i + 1}.png`,
);
