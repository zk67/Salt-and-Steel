import { Injectable } from '@angular/core';
import { MapService } from '@app/services/map/map.service';
import { MapObjectType, MapSize, TileType } from '@common/interfaces/map.interface';
import { Position } from '@common/utils/map.utils';

const OBJECT_QUANTITY_SMALL = 2;
const OBJECT_QUANTITY_MEDIUM = 4;
const OBJECT_QUANTITY_LARGE = 6;


@Injectable({
    providedIn: 'root',
})
export class ToolService {
    private tileType: TileType = TileType.Basic;
    private mapObjectType: MapObjectType = MapObjectType.None;
    private toolType: ToolType = ToolType.None;
    private numberSpawnPoint = 0;
    private numberFlag = 0;
    private numberHealingShrine = 0;
    private numberCombatShrine = 0;

    constructor(private mapService: MapService) {}

    setTileType(type: TileType): void {
        this.toolType = ToolType.Tile;
        this.tileType = type;
    }

    setMapObjectType(type: MapObjectType): void {
        this.toolType = ToolType.Object;
        this.mapObjectType = type;
    }

    getTileType(): TileType {
        return this.tileType;
    }

    getMapObjectType(): MapObjectType {
        return this.mapObjectType;
    }

    getToolType(): ToolType {
        return this.toolType;
    }

    useTool(button: number, shiftKey: boolean, position: Position): void {
        if (button === 0) {
            this.place(position);
        } else if (button === 2) {
            this.delete(position, shiftKey);
        }
    }

    place(position: Position): void {
        if (this.toolType === ToolType.None) return;
        const tile = this.mapService.getTile(position);
        if (!tile) return;

        if (this.toolType === ToolType.Tile) {
            if (this.tileType === TileType.Wall) {
                this.setNumberObject(tile.mapObject, false);
                this.mapService.setMapObject(position, MapObjectType.None);
            }

            if(this.tileType === TileType.CloseDoor){
                if(!this.isDoorPlacementValid(position))
                    return;

                if(tile.tileType === TileType.CloseDoor) {
                    this.mapService.setTile(position, TileType.OpenDoor);
                    return;
                } else if(tile.tileType === TileType.OpenDoor) {
                    this.mapService.setTile(position, TileType.CloseDoor);
                    return;
                }
            }

            this.mapService.setTile(position, this.tileType);
        } else if (this.mapObjectType !== MapObjectType.None) {
            if (tile.mapObject !== this.mapObjectType && tile.tileType !== TileType.Wall && this.getNumberObject(this.mapObjectType) > 0) {
                if (tile.mapObject !== MapObjectType.None)
                    this.setNumberObject(tile.mapObject, false);
                this.mapService.setMapObject(position, this.mapObjectType);
                this.setNumberObject(this.mapObjectType);
            }
        }
    }

    delete(position: Position, shiftKeyPressed: boolean = false): void {
        if (shiftKeyPressed) {
            this.setNumberObject(this.mapService.getMapObject(position), false);
            this.mapService.setMapObject(position, MapObjectType.None);
        } else {
            this.mapService.setTile(position, TileType.Basic);
        }
    }

    defaultNumbers(): void {
        this.numberFlag = 1; // Pareil pour tous les tailles de carte

        switch (this.mapService.getSize()) {
            case MapSize.Small:
                this.numberSpawnPoint = OBJECT_QUANTITY_SMALL;
                this.numberHealingShrine = 1;
                this.numberCombatShrine = 1;
                break;
            case MapSize.Medium:
                this.numberSpawnPoint = OBJECT_QUANTITY_MEDIUM;
                this.numberHealingShrine = OBJECT_QUANTITY_SMALL;
                this.numberCombatShrine = OBJECT_QUANTITY_SMALL;
                break;
            case MapSize.Large:
                this.numberSpawnPoint = OBJECT_QUANTITY_LARGE;
                this.numberHealingShrine = OBJECT_QUANTITY_MEDIUM;
                this.numberCombatShrine = OBJECT_QUANTITY_MEDIUM;
                break;
        }

        const gameData = this.mapService.getGameData();

        if (gameData) {
            gameData.tiles.flat().filter(t => t.mapObject !== MapObjectType.None).forEach((tile) => {
                this.setNumberObject(tile.mapObject);
            });
        }
    }

    getNumberObject(type: MapObjectType): number {
        switch (type) {
            case MapObjectType.SpawnPoint: return this.numberSpawnPoint;
            case MapObjectType.Flag: return this.numberFlag;
            case MapObjectType.HealingShrine: return this.numberHealingShrine;
            case MapObjectType.CombatShrine: return this.numberCombatShrine;
        }
        return 0;
    }

    setNumberObject(type: MapObjectType, place: boolean = true): void {
        switch (type) {
            case MapObjectType.SpawnPoint: this.numberSpawnPoint += place ? -1 : 1; break;
            case MapObjectType.Flag: this.numberFlag += place ? -1 : 1; break;
            case MapObjectType.HealingShrine: this.numberHealingShrine += place ? -1 : 1; break;
            case MapObjectType.CombatShrine: this.numberCombatShrine += place ? -1 : 1; break;
        }
    }

    private isDoorPlacementValid(position: Position): boolean {
        const isOnBorder = position.x === 0 || position.y === 0 ||
         position.x === this.mapService.getSize() - 1 || position.y === this.mapService.getSize() - 1;
        return !isOnBorder;
    }
}

export enum ToolType {
    None,
    Tile,
    Object,
}
