import { Position } from "@common/utils/map.utils";

export interface Player {
    id: string;
    name: string;
    imageUrl?: string;
    position: Position
    speed: number | null;
    hp: number | null;
    maxHp: number | null;
    attack: number | null;
    defense: number | null;
    d6target: 'attack' | 'defense' | null;
    d4target: 'attack' | 'defense' | null;
    movementPoints: number;
    actionsLeft: number;
    victoryPoints: number;
    hasAbandoned: boolean;
    isOrganizer: boolean;
    turnOrder: number;
}
