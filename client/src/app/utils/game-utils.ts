import { MAX_PLAYERS_LARGE, MAX_PLAYERS_MEDIUM, MAX_PLAYERS_SMALL, MIN_PLAYERS } from '@app/const/game-const';
import { GameMode, MapObjectType, MapSize } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';

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
        default:
            return '';
    }
}

export function canPassFlag(gameMode: GameMode, clientPlayer: Player, player: Player): boolean {
    return (
        gameMode === GameMode.CTF &&
        (clientPlayer.hasFlag ?? false) &&
        (clientPlayer.isRedTeam ?? false) === (player.isRedTeam ?? false)
    );
}