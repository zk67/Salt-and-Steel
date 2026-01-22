import { Component, Input, OnInit  } from '@angular/core';
import { MapObject } from '@app/classes/game/map/map';
import { TileType, MapObjectType } from '@app/classes/game/map/tile';

@Component({
    selector: 'app-map-editor',
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss'],
})

export class MapEditorComponent implements OnInit {
    @Input() gridSize = 10;
    map!: MapObject;

    selectedTileType: TileType = TileType.Water; // default
    selectedObjectType: MapObjectType | null = null;
    isMouseDown: boolean = false; // Pour gerer le mouse drag

    // Utile pour la composante HTML pour lier le enum et string
    tileType = TileType;
    mapObjectType = MapObjectType;


    onMouseDown(x: number, y: number): void {
        this.isMouseDown = true;
        this.onTileClick(x, y);
    }

    onMouseUp(): void {
        this.isMouseDown = false;
    }

    // Permet de gerer le mouse drag
    onMouseEnter(x: number, y: number): void {
        if (this.isMouseDown) {
            this.onTileClick(x, y);
        }
    }

    onTileClick(x: number, y: number): void {
        if (this.selectedObjectType !== null) {
            this.map.setMapObjectAt(x, y, this.selectedObjectType);
        } else {
            this.map.setTile(x, y, this.selectedTileType);
        }
    }

    ngOnInit(): void {
        this.map = new MapObject(this.gridSize);
    }
}
