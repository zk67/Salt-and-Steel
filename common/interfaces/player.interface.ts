import { DiceTarget } from '@common/enums/player.enums';
import { NullableNumber } from '@common/types/shared.types';
import { Position } from "@common/utils/map.utils";

export interface Player {
    id: string;
    name: string;
    imageUrl?: string;
    speed: NullableNumber;
    hp: NullableNumber;
    maxHp: NullableNumber;
    attack: NullableNumber;
    defense: NullableNumber;
    d6target: DiceTarget | null;
    d4target: DiceTarget | null;
    position: Position
    movementPoints: number;
    actionsLeft: number;
    victoryPoints: number;
    hasAbandoned: boolean;
    isOrganizer: boolean;
    turnOrder: number;
}