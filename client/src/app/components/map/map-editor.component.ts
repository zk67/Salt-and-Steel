import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { MapService } from '@app/services/map/map.service';
import { SaveService } from '@app/services/save/save.service';
import { ToolService, ToolType } from '@app/services/tool/tool.service';
import { getObjectDescription } from '@app/utils/game-utils';
import { GameMode, MapObjectType, MapSize, TileType } from '@common/interfaces/map.interface';
import { Position } from '@common/utils/map.utils';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-map-editor',
    templateUrl: './map-editor.component.html',
    styleUrls: ['./map.component.scss'],
})
export class MapEditorComponent implements OnInit, OnDestroy {
    gridSize: MapSize = MapSize.Small;
    readyToLoad = false;

    tileType = TileType;
    mapObjectType = MapObjectType;

    private isMouseDown = false;

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

    private mouseButton = 0;

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
            const canDrag = !isObjectTool || this.mouseButton === 2;

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

        window.addEventListener('mouseup', this.globalMouseUpListener);
        window.addEventListener('mousedown', this.globalMouseDownListener);
        window.addEventListener('dragstart', this.globalDragStartListener);
        window.addEventListener('contextmenu', this.globalContextMenuListener);

        if (id) {
            const game = await firstValueFrom(this.saveService.getGame(id));
            if (!game) {
                alert('Map introuvable, retour a la page principal.');
                this.router.navigate([APP_ROUTES.admin]);
                return;
            }

            this.gridSize = game.size;
            this.mapService.loadFromDB(game);
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

            this.mapService.initializeMap(this.gridSize, mode);
        }

        this.toolService.defaultNumbers();
        this.readyToLoad = true;
    }

    ngOnDestroy(): void {
        window.removeEventListener('mouseup', this.globalMouseUpListener);
        window.removeEventListener('mousedown', this.globalMouseDownListener);
        window.removeEventListener('dragstart', this.globalDragStartListener);
        window.removeEventListener('contextmenu', this.globalContextMenuListener);
    }
}
