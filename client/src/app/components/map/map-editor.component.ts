import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MapService } from '@app/services/map/map.service';
import { ToolService, ToolType } from '@app/services/tool/tool.service';
import { GameMode, MapObjectType, MapSize, TileType } from '@common/types/map.interface';

@Component({
    selector: 'app-map-editor',
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss'],
})
export class MapEditorComponent implements OnInit {
    gridSize: number = 10;

    private isMouseDown: boolean = false; // Pour gerer le mouse drag
    private mouseButton: number = 0; // Pour gerer le drag car mouseenter ne donne pas le bouton

    // Utile pour la composante HTML pour lier le enum et string
    tileType = TileType;
    mapObjectType = MapObjectType;

    constructor(
        private route: ActivatedRoute,
        public mapService: MapService,
        private toolService: ToolService,
    ) {}

    onMouseDown(event: MouseEvent, x: number, y: number): void {
        this.isMouseDown = true;
        this.mouseButton = event.button;
        this.toolService.useTool(this.mouseButton, event.shiftKey, x, y);
    }

    onMouseUp(): void {
        this.isMouseDown = false;
    }

    // Permet de gerer le mouse drag
    onMouseEnter(event: MouseEvent, x: number, y: number): void {
        if (this.isMouseDown && (this.toolService.getToolType() !== ToolType.Object || (this.mouseButton === 2 && !event.shiftKey))) {
            this.toolService.useTool(this.mouseButton, event.shiftKey, x, y);
        }
    }

    ngOnInit(): void {
        // id pas encore implementer, potentielement etre le nom de la map a la place du id
        const id = this.route.snapshot.queryParams.id;

        if (id) {
            // Charger la map du db ici
        } else {
            this.gridSize = Number(this.route.snapshot.queryParams.size) || MapSize.Small;
            const mode = this.route.snapshot.queryParams.mode as GameMode || GameMode.Classic;

            this.mapService.initializeMap(this.gridSize);
            this.mapService.setGameMode(mode);
            this.toolService.defaultNumbers();
        }
    }
}
