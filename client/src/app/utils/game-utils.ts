import { MAX_PLAYERS_LARGE, MAX_PLAYERS_MEDIUM, MAX_PLAYERS_SMALL, MIN_PLAYERS } from '@app/const/gameConst';
import { MapObjectType, MapSize } from '@common/types/map.interface';

export { findNearestFreeSpawn, getActionableTiles, getPlayerAt, movableTiles, TILE_ENERGY_COST } from '@common/utils/map.utils';

export function getMinMaxPlayers(size: number): { minPlayers: number; maxPlayers: number } {
    let minPlayers: number;
    let maxPlayers: number;

    switch (size) {
        case MapSize.Small:
            minPlayers = MIN_PLAYERS;
            maxPlayers = MAX_PLAYERS_SMALL;
            break;
        case MapSize.Medium:
            minPlayers = MIN_PLAYERS;
            maxPlayers = MAX_PLAYERS_MEDIUM;
            break;
        case MapSize.Large:
            minPlayers = MIN_PLAYERS;
            maxPlayers = MAX_PLAYERS_LARGE;
            break;
        default:
            minPlayers = MIN_PLAYERS;
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
        default:
            return '';
    }
}

