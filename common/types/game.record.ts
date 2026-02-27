import {TileType } from '@common/types/map.interface';

export const TILE_ENERGY_COST: Record<TileType, number> = {
    [TileType.Basic]: 1,
    [TileType.Water]: 2,
    [TileType.Ice]: 0,
    [TileType.Wall]: Infinity, // Impassable
    [TileType.Door]: 1,
};

export const DIRECTION: Record<string, [number, number]> = {
    up: [0, -1],
    left: [-1, 0],
    down: [0, 1],
    right: [1, 0],
};
