import { MAX_PLAYERS_LARGE, MAX_PLAYERS_MEDIUM, MAX_PLAYERS_SMALL, MIN_PLAYERS } from '@app/const/game-const';
import { MapObjectType, MapSize } from '@common/interfaces/map.interface';

export function getMinMaxPlayers(size: number): { minPlayers: number; maxPlayers: number } {
    const minPlayers: number = MIN_PLAYERS;
    let maxPlayers: number;

    switch (size) {
        case MapSize.Small:
            maxPlayers = MAX_PLAYERS_SMALL;
            break;
        case MapSize.Medium:
            maxPlayers = MAX_PLAYERS_MEDIUM;
            break;
        case MapSize.Large:
            maxPlayers = MAX_PLAYERS_LARGE;
            break;
        default:
            maxPlayers = MAX_PLAYERS_SMALL;
    }

    return { minPlayers, maxPlayers };
}

export function getObjectDescription(objectType: number): string {
    switch (objectType) {
        case MapObjectType.SpawnPoint:
            return 'Point de départ des joueurs';
        case MapObjectType.Flag:
            return 'Drapeau - Objectif à capturer';
        case MapObjectType.HealingShrine:
            return 'Sanctuaire de soin - Rend des points de vie';
        case MapObjectType.CombatShrine:
            return 'Sanctuaire de combat - Offre un bonus en combat';
        default:
            return '';
    }
}