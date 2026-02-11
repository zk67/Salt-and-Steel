import { MapSize } from '@common/types/map.interface';
import { MIN_PLAYERS, MAX_PLAYERS_SMALL, MAX_PLAYERS_MEDIUM, MAX_PLAYERS_LARGE } from '@app/const/gameConst';

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
