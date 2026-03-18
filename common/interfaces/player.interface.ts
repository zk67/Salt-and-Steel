import { DiceTarget } from '@common/enums/player.enums';
import { NullableNumber } from '@common/types/shared.types';

export interface Player {
    id: string;
    name: string;
    imageUrl?: string;
    x: number;
    y: number;
    speed: NullableNumber;
    hp: NullableNumber;
    maxHp: NullableNumber;
    attack: NullableNumber;
    defense: NullableNumber;
    d6target: DiceTarget | null;
    d4target: DiceTarget | null;
    movementPoints: number;
    actionsLeft: number;
    victoryPoints: number;
    hasAbandoned: boolean;
    isOrganizer: boolean;
    turnOrder: number;
}