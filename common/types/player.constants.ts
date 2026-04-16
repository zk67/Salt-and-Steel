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

export const COMBAT_TIMER = 10;
export const NUMBER_OF_AVATARS = 12;
export const BASE_HP = 6;
export const BASE_SPEED = 6;
export const BASE_ATTACK = 4;
export const BASE_DEFENSE = 4;
export const HALF_RANDOM = 0.5;
export const STAT_BONUS = 2;
export const getVPTurnDelayMs = (): number => Math.floor(Math.random() * (1000 - 500 + 1)) + 500;
