import { Injectable } from '@angular/core';
import { Game } from '@common/interfaces/game.interface';
import { MapObjectType, TileType } from '@common/interfaces/map.interface';
import { Position } from '@common/utils/map.utils';

const DEFAULT_PREVIEW_SIZE = 256;
const OBJECT_PADDING_RATIO = 0.15;
type PreviewCanvas = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; cellSize: number };

@Injectable({
    providedIn: 'root',
})
export class MapPreviewService {

    private readonly tilePaths = new Map<TileType, string>([
        [TileType.Basic, 'assets/tiles/basic.png'],
        [TileType.Water, 'assets/tiles/water.png'],
        [TileType.Ice, 'assets/tiles/ice.png'],
        [TileType.Wall, 'assets/tiles/wall.png'],
        [TileType.CloseDoor, 'assets/tiles/CloseDoor.png'],
        [TileType.OpenDoor, 'assets/tiles/OpenDoor.png'],
    ]);

    private readonly objPaths = new Map<MapObjectType, string>([
        [MapObjectType.SpawnPoint, 'assets/objects/spawn.png'],
        [MapObjectType.Flag, 'assets/objects/flag.png'],
        [MapObjectType.HealingShrine, 'assets/objects/heal.png'],
        [MapObjectType.CombatShrine, 'assets/objects/combat.png'],
    ]);

    // cache global (évite de re-télécharger les images à chaque preview)
    private readonly imageCache = new Map<string, Promise<HTMLImageElement>>();

    private loadImage(src: string): Promise<HTMLImageElement> {
        const cached = this.imageCache.get(src);
        if (cached) return cached;

        const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                this.imageCache.delete(src);
                reject(new Error(`Image introuvable: ${src}`));
            };
            img.src = src;
        });

        this.imageCache.set(src, imagePromise);
        return imagePromise;
    }

    async generatePreview(map: Game, pixelSize: number = DEFAULT_PREVIEW_SIZE): Promise<string> {
        const preview = this.createPreviewCanvas(map.size, pixelSize);
        if (!preview) return '';

        const tileImages = await this.loadUsedTileImages(map);
        const objectImages = await this.loadUsedObjectImages(map);

        this.drawMap(preview.ctx, map, preview.cellSize, tileImages, objectImages);

        return preview.canvas.toDataURL('image/png');
    }

    private createPreviewCanvas(size: number, pixelSize: number): PreviewCanvas | null {
        const cellSize = Math.floor(pixelSize / size);
        const finalSize = cellSize * size;

        const canvas = document.createElement('canvas');
        canvas.width = finalSize;
        canvas.height = finalSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.imageSmoothingEnabled = false;
        ctx.fillRect(0, 0, finalSize, finalSize);

        return { canvas, ctx, cellSize };
    }

    private async loadUsedTileImages(map: Game): Promise<Map<TileType, HTMLImageElement>> {
        const usedTiles = new Set<TileType>();
        this.forEachTile(map, (_, tileType) => usedTiles.add(tileType));
        return this.loadImagesByType(usedTiles, this.tilePaths);
    }

    private async loadUsedObjectImages(map: Game): Promise<Map<MapObjectType, HTMLImageElement>> {
        const usedObjects = new Set<MapObjectType>();
        this.forEachTile(map, (_, __, mapObject) => {
            if (mapObject !== MapObjectType.None) usedObjects.add(mapObject);
        });
        return this.loadImagesByType(usedObjects, this.objPaths);
    }

    private async loadImagesByType<T>(usedTypes: Set<T>, pathMap: Map<T, string>): Promise<Map<T, HTMLImageElement>> {
        const entries = await Promise.all(
            [...usedTypes].map(async type => {
                const path = pathMap.get(type);
                if (!path) return null;

                const image = await this.loadImage(path);
                return [type, image] as const;
            }),
        );

        const images = new Map<T, HTMLImageElement>();
        entries.forEach(entry => {
            if (!entry) return;
            images.set(entry[0], entry[1]);
        });

        return images;
    }

    private drawMap(
        ctx: CanvasRenderingContext2D,
        map: Game,
        cellSize: number,
        tileImages: Map<TileType, HTMLImageElement>,
        objectImages: Map<MapObjectType, HTMLImageElement>,
    ): void {
        this.forEachTile(map, (position, tileType, mapObject) => {
            this.drawTile(ctx, position, cellSize, tileType, tileImages);

            if (mapObject !== MapObjectType.None) {
                this.drawObject(ctx, position, cellSize, mapObject, objectImages);
            }
        });
    }

    private drawTile(
        ctx: CanvasRenderingContext2D,
        position: Position,
        cellSize: number,
        tileType: TileType,
        tileImages: Map<TileType, HTMLImageElement>,
    ): void {
        const tileImage = tileImages.get(tileType);
        if (!tileImage) return;

        ctx.drawImage(tileImage, position.x * cellSize, position.y * cellSize, cellSize, cellSize);
    }

    private drawObject(
        ctx: CanvasRenderingContext2D,
        position: Position,
        cellSize: number,
        mapObject: MapObjectType,
        objectImages: Map<MapObjectType, HTMLImageElement>,
    ): void {
        const objectImage = objectImages.get(mapObject);
        if (!objectImage) return;

        const pad = Math.floor(cellSize * OBJECT_PADDING_RATIO);
        ctx.drawImage(
            objectImage,
            position.x * cellSize + pad,
            position.y * cellSize + pad,
            cellSize - 2 * pad,
            cellSize - 2 * pad,
        );
    }

    private forEachTile(
        map: Game,
        callback: (position: Position, tileType: TileType, mapObject: MapObjectType) => void,
    ): void {
        for (let y = 0; y < map.size; y++) {
            for (let x = 0; x < map.size; x++) {
                const tile = map.tiles[y][x];
                callback({ x, y }, tile.tileType, tile.mapObject);
            }
        }
    }
}
