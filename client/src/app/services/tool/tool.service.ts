import { Injectable } from '@angular/core';
import { TileType, MapObjectType } from '@common/types/map.interface';
import { MapService } from '@app/services/map/map.service';

@Injectable({
    providedIn: 'root',
})
export class ToolService {
    private tileType: TileType = TileType.Water;
    private mapObjectType: MapObjectType = MapObjectType.None;
    private toolType: ToolType = ToolType.Tile;

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

    useTool(button: number, shiftKey: boolean, x: number, y: number): void {
        if (button === 0) {
            this.place(x, y);
        } else if (button === 2) {
            this.delete(x, y, shiftKey);
        }
    }

    place(x: number, y: number): void {
        const tile = this.mapService.getTile(x, y);
        if (!tile) return;

        if (this.toolType === ToolType.Tile) {
            this.mapService.setTile(x, y, this.tileType);
        } else if (this.mapObjectType !== MapObjectType.None) {
            if (tile.mapObject === MapObjectType.None && tile.tileType !== TileType.Wall) {
                this.mapService.setMapObject(x, y, this.mapObjectType);
            }
        }
    }

    delete(x: number, y: number, shiftKeyPressed: boolean = false): void {
        if (shiftKeyPressed) {
            this.mapService.setMapObject(x, y, MapObjectType.None);
        } else {
            this.mapService.setTile(x, y, TileType.Basic);
        }
    }
}

export enum ToolType {
    Tile,
    Object,
}
