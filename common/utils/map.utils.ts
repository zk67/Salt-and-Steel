import { MapObjectType, TileData, TileType } from '@common/types/map.interface';
import { Player } from '@common/types/player.interface';

export const directions = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
];

export const TILE_ENERGY_COST: Record<TileType, number> = {
    [TileType.Basic]: 1,
    [TileType.Water]: 2,
    [TileType.Ice]: 0,
    [TileType.Wall]: Infinity,
    [TileType.Door]: 1,
};

export function getPlayerAt(players: Player[] | undefined, x: number, y: number): Player | null {
    if (!players) return null;
    return players.find(p => p.x === x && p.y === y) || null;
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

export function findNearestFreeSpawn(
    tiles: TileData[][],
    spawn: { x: number; y: number },
    players: Player[],
    excludePlayerId: string,
): { x: number; y: number } {
    const otherPlayers = players.filter(p => p.id !== excludePlayerId);

    if (!getPlayerAt(otherPlayers, spawn.x, spawn.y)) {
        return spawn;
    }

    const visited = new Set<string>();
    const queue: { x: number; y: number }[] = [{ x: spawn.x, y: spawn.y }];
    visited.add(`${spawn.x},${spawn.y}`);

    while (queue.length > 0) {
        const current = queue.shift()!;

        for (const [dx, dy] of directions) {
            const nx = current.x + dx;
            const ny = current.y + dy;

            if (nx < 0 || ny < 0 || ny >= tiles.length || nx >= tiles[ny].length) continue;

            const key = `${nx},${ny}`;
            if (visited.has(key)) continue;
            visited.add(key);

            if (TILE_ENERGY_COST[tiles[ny][nx].tileType] === Infinity) continue;

            if (!getPlayerAt(otherPlayers, nx, ny)) {
                return { x: nx, y: ny };
            }

            queue.push({ x: nx, y: ny });
        }
    }

    return spawn;
}