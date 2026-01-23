import { Component, Input, OnInit } from '@angular/core';
import { MapObject } from '@common/classes/map';
import { Tool } from '@common/classes/tool';
import { MapObjectType, TileType } from '@common/types/tile.types';

@Component({
    selector: 'app-map-editor',
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss'],
})

export class MapEditorComponent implements OnInit {
    @Input() gridSize = 10;
    map!: MapObject;
    private tool!: Tool;

    private isMouseDown: boolean = false; // Pour gerer le mouse drag
    private mouseButton: number = 0; // Pour gerer le drag car mouseenter ne donne pas le bouton

    // Utile pour la composante HTML pour lier le enum et string
    tileType = TileType;
    mapObjectType = MapObjectType;


    onMouseDown(event: MouseEvent, x: number, y: number): void {
        this.isMouseDown = true;
        this.mouseButton = event.button;
        this.tool.useTool(this.mouseButton, event.shiftKey, x, y);
    }

    onMouseUp(): void {
        this.isMouseDown = false;
    }

    // Permet de gerer le mouse drag
    onMouseEnter(event: MouseEvent, x: number, y: number): void {
        if (this.isMouseDown) {
            this.tool.useTool(this.mouseButton, event.shiftKey, x, y);
        }
    }

    ngOnInit(): void {
        this.map = new MapObject(this.gridSize);
        this.tool = new Tool(this.map);
    }
}
