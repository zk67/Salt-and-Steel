import { Position } from '../utils/map.utils';

export const DIRECTION_STRING: Record<string, Position> = {
    up: { x: 0, y: -1 },
    left: { x: -1, y: 0 },
    down: { x: 0, y: 1 },
    right: { x: 1, y: 0 },
};
