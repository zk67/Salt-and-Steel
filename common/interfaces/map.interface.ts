export enum TileType {
    Basic = 0,
    Water = 1,
    Ice = 2,
    Wall = 3,
    CloseDoor = 4,
    OpenDoor = 5,
}

export enum MapObjectType {
    None = 0,
    SpawnPoint = 1,
    Flag = 2,
    HealingShrine = 3,
    CombatShrine = 4,
}

export enum GameMode {
    Classic = 'classic',
    CTF = 'CTF',
}

export enum MapSize {
    Small = 10,
    Medium = 15,
    Large = 20,
}

export interface TileData {
    tileType: TileType;
    mapObject: MapObjectType;
}
