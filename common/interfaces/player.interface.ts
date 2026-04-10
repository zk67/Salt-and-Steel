import { DiceTarget } from '@common/enums/player.enums';
import { Position } from "@common/utils/map.utils";

export interface Player {
    id: string;
    name: string;
    imageUrl?: string;
    speed: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    d6target: DiceTarget | null;
    d4target: DiceTarget | null;
    position: Position;
    movementPoints: number;
    actionsLeft: number;
    hasAbandoned: boolean;
    isOrganizer: boolean;
    turnOrder: number;
    shrineBuffs?: ShrineBuff;
    stats: PlayerStats;
    visitedTiles?: string[];
    isRedTeam?: boolean;
    hasFlag?: boolean;
}

export interface ShrineBuff {
    bonusAmount: number;
    turnsLeft: number;
}
export interface PlayerStats {
    combatPoints: number;
    victoryPoints: number;
    defeatPoints: number;
    totalLifeLost: number;
    totalDamageDealt: number;
    percentageOfTileVisited: number;
}