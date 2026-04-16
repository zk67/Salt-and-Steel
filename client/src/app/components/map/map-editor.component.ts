import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { MapService } from '@app/services/map/map.service';
import { SaveService } from '@app/services/save/save.service';
import { ToolService, ToolType } from '@app/services/tool/tool.service';
import { getObjectDescription } from '@app/utils/game-utils';
import { GameMode, MapObjectType, MapSize, TileType } from '@common/interfaces/map.interface';
import { Position } from '@common/utils/map.utils';
import { firstValueFrom } from 'rxjs';

export enum MouseButton {
    None = 0,
    Middle = 1,
    Right = 2,
}

@Component({
    selector: 'app-map-editor',
    templateUrl: './map-editor.component.html',
    styleUrls: ['./map.component.scss'],
})
export class MapEditorComponent implements OnInit {
    _gridSize: MapSize = MapSize.Small;
    readyToLoad = false;

    tileType = TileType;
    mapObjectType = MapObjectType;

    private isMouseDown = false;

    @HostListener('window:mouseup')
    onWindowMouseUp(): void {
        this.isMouseDown = false;
    }

    @HostListener('window:mousedown')
    onWindowMouseDown(): void {
        this.isMouseDown = true;
    }

    @HostListener('window:dragstart', ['$event'])
    onWindowDragStart(event: Event): void {
        event.preventDefault();
    }

    @HostListener('window:contextmenu', ['$event'])
    onWindowContextMenu(event: Event): void {
        event.preventDefault();
    }

    private mouseButton = MouseButton.None;

    constructor(
        private route: ActivatedRoute,
        public mapService: MapService,
        private toolService: ToolService,
        private saveService: SaveService,
        private router: Router,
    ) {}

    onMouseDown(event: MouseEvent, position: Position): void {
        this.isMouseDown = true;
        this.mouseButton = event.button;
        this.toolService.useTool(this.mouseButton, event.shiftKey, position);
    }

    onMouseEnter(event: MouseEvent, position: Position): void {
        if (this.isMouseDown) {
            const isObjectTool = this.toolService.getToolType() === ToolType.Object;
            const canDrag = !isObjectTool || this.mouseButton === MouseButton.Right;

            if (canDrag) {
                this.toolService.useTool(this.mouseButton, event.shiftKey, position);
            }
        }
    }

    getObjectDescription(objectType: number): string {
        return getObjectDescription(objectType);
    }

    async ngOnInit(): Promise<void> {
        const id = this.route.snapshot.queryParams.id;

        if (id) {
            const game = await firstValueFrom(this.saveService.getGame(id));
            if (!game) {
                this.router.navigate([APP_ROUTES.admin]);
                return;
            }

            this._gridSize = game.size;
            this.mapService.loadFromDB(game);
        } else {
            const sizeParam = Number(this.route.snapshot.queryParams.size);
            let mode = this.route.snapshot.queryParams.mode as GameMode;

            if (Object.values(MapSize).includes(sizeParam)) {
                this._gridSize = sizeParam as MapSize;
            } else {
                this._gridSize = MapSize.Small;
            }

            if (!Object.values(GameMode).includes(this.route.snapshot.queryParams.mode)) {
                mode = GameMode.Classic;
            }

            this.mapService.initializeMap(this._gridSize, mode);
        }

        this.toolService.defaultNumbers();
        this.readyToLoad = true;
    }
}
