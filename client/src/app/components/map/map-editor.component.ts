import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MapService } from '@app/services/map/map.service';
import { ToolService, ToolType } from '@app/services/tool/tool.service';
import { GameMode, MapObjectType, MapSize, TileType } from '@common/types/map.interface';

@Component({
    selector: 'app-map-editor',
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss'],
})
export class MapEditorComponent implements OnInit, OnDestroy {
    gridSize: MapSize = MapSize.Small;

    private isMouseDown: boolean = false; // Pour gerer le mouse drag

    private globalMouseUpListener = () => {
        this.isMouseDown = false;
    };
    private globalMouseDownListener = () => {
        this.isMouseDown = true;
    };
    private globalDragStartListener = (event: Event) => {
        event.preventDefault();
    };
    private globalContextMenuListener = (event: Event) => {
        event.preventDefault();
    };

    private mouseButton: number = 0;

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

    // Permet de gerer le mouse drag
    onMouseEnter(event: MouseEvent, x: number, y: number): void {
        if (this.isMouseDown && (this.toolService.getToolType() !== ToolType.Object || (this.mouseButton === 2 && !event.shiftKey))) {
            this.toolService.useTool(this.mouseButton, event.shiftKey, x, y);
        }
    }

    ngOnInit(): void {
        // id pas encore implementer
        const id = this.route.snapshot.queryParams.id;

        // permet de gerer le mouse drag + fix quelque bugs
        window.addEventListener('mouseup', this.globalMouseUpListener);
        window.addEventListener('mousedown', this.globalMouseDownListener);
        window.addEventListener('dragstart', this.globalDragStartListener);
        window.addEventListener('contextmenu', this.globalContextMenuListener);

        if (id) {
            // Charger la map du db ici
        } else {
            const sizeParam = Number(this.route.snapshot.queryParams.size);
            let mode = this.route.snapshot.queryParams.mode as GameMode;

            if (Object.values(MapSize).includes(sizeParam)) {
                this.gridSize = sizeParam as MapSize;
            } else {
                alert('Taille de carte invalide, taille petite utilisee.');
                this.gridSize = MapSize.Small;
            }

            if (!Object.values(GameMode).includes(this.route.snapshot.queryParams.mode)) {
                mode = GameMode.Classic;
                alert('Mode de jeu invalide, mode classique utilise.');
            }

            this.mapService.initializeMap(this.gridSize);
            this.mapService.setGameMode(mode);
            this.toolService.defaultNumbers();
        }
    }

    ngOnDestroy(): void {
        window.removeEventListener('mouseup', this.globalMouseUpListener);
        window.removeEventListener('mousedown', this.globalMouseDownListener);
        window.removeEventListener('dragstart', this.globalDragStartListener);
        window.removeEventListener('contextmenu', this.globalContextMenuListener);
    }
}
