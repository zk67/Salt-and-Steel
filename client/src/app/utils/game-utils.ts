import { MAX_PLAYERS_LARGE, MAX_PLAYERS_MEDIUM, MAX_PLAYERS_SMALL, MIN_PLAYERS } from '@app/const/gameConst';
import { MapObjectType, MapSize, TileData, TileType } from '@common/types/map.interface';
import { Player } from '@common/types/player.interface';

const directions = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
];

// Coût en énergie pour se déplacer sur chaque type de tuile
export const TILE_ENERGY_COST: Record<TileType, number> = {
    [TileType.Basic]: 1,
    [TileType.Water]: 2,
    [TileType.Ice]: 0,
    [TileType.Wall]: Infinity, // Impassable
    [TileType.Door]: 1,
};

export function getPlayerAt(players: Player[] | undefined, x: number, y: number): Player | null {
    if (!players) return null;
    return players.find(p => p.x === x && p.y === y) || null;
}

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


export function movableTiles(tiles: TileData[][], player: Player, players: Player[]): boolean[][] {
    const result: boolean[][] = [];

    for (let y = 0; y < tiles.length; y++) {
        result[y] = [];
        for (let x = 0; x < tiles[y].length; x++) {
            result[y][x] = false;
        }
    }

    const visited = new Map<string, number>();
    const queue: { x: number, y: number, movementPoints: number }[] = [];

    // Position initiale du joueur
    queue.push({ x: player.x, y: player.y, movementPoints: player.movementPoints });
    visited.set(`${player.x},${player.y}`, player.movementPoints);
    result[player.y][player.x] = true;

    // BFS
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;

        for (const [dx, dy] of directions) {
            const newX = current.x + dx;
            const newY = current.y + dy;

            if (newX < 0 || newY < 0 || newY >= tiles.length || newX >= tiles[newY].length) {
                continue;
            }

            if (getPlayerAt(players, newX, newY)) {
                continue;
            }

            const tile = tiles[newY][newX];
            const energyCost = TILE_ENERGY_COST[tile.tileType];
            const remainingEnergy = current.movementPoints - energyCost;

            if (remainingEnergy < 0) {
                continue;
            }

            const key = `${newX},${newY}`;
            const previousEnergy = visited.get(key);

            if (previousEnergy === undefined || remainingEnergy > previousEnergy) {
                visited.set(key, remainingEnergy);
                result[newY][newX] = true;
                queue.push({ x: newX, y: newY, movementPoints: remainingEnergy });
            }
        }
    }

    return result;
}

export function getActionableTiles(tiles: TileData[][], player: Player, players: Player[]): boolean[][] {
    const result: boolean[][] = [];

    for (let y = 0; y < tiles.length; y++) {
        result[y] = [];
        for (let x = 0; x < tiles[y].length; x++) {
            result[y][x] = false;
        }
    }

    directions.forEach(([dx, dy]) => {
        const newX = player.x + dx;
        const newY = player.y + dy;

        if (newX < 0 || newY < 0 || newY >= tiles.length || newX >= tiles[newY].length) {
            return;
        }

        if (getPlayerAt(players, newX, newY) || tiles[newY][newX].mapObject !== MapObjectType.None) {
            result[newY][newX] = true;
        }
    });

    return result;
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

