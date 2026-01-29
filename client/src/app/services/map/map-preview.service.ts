import { MapService } from '@app/services/map/map.service';
import { MapObjectType, TileType } from '@common/types/map.interface';
//injectable pas encore fait 

export class MapPreviewService {
    constructor(private readonly mapService: MapService) {}
    readonly previewSize = 256;
    readonly nombreMajore =0.15;

    private readonly tilePaths = new Map<TileType, string>([
        [TileType.Basic, 'assets/tiles/basic.png'],
        [TileType.Water, 'assets/tiles/water.png'],
        [TileType.Ice, 'assets/tiles/ice.png'],
        [TileType.Wall, 'assets/tiles/wall.png'],
        [TileType.Door, 'assets/tiles/door.png'],
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
        // cache: même src => même Promise
        const cached = this.imageCache.get(src);
        if (cached) return cached;

        const p = new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Image introuvable: ${src}`));
            img.src = src;
        });

        this.imageCache.set(src, p);
        return p;
    }

    async generatePreview(pixelSize: number = this.previewSize): Promise<string> {
        if (typeof document === 'undefined') return '';

        const size = this.mapService.getSize();

        // Pas de  cellules décimales
        const cell = Math.floor(pixelSize / size);
        const finalSize = cell * size;

        const canvas = document.createElement('canvas');
        canvas.width = finalSize;
        canvas.height = finalSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        ctx.imageSmoothingEnabled = false;

        // fond
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, finalSize, finalSize);

        // caches locaux évite await répété sur même type
        const tileImgs = new Map<TileType, HTMLImageElement>();
        const objImgs = new Map<MapObjectType, HTMLImageElement>();

        const getTileImg = async (t: TileType): Promise<HTMLImageElement | null> => {
            const cached = tileImgs.get(t);
            if (cached) return cached;
            const path = this.tilePaths.get(t);
            if (!path) return null;
            const img = await this.loadImage(path);
            tileImgs.set(t, img);
            return img;
        };

        const getObjImg = async (obj: MapObjectType): Promise<HTMLImageElement | null> => {
            const cached = objImgs.get(obj);
            if (cached) return cached;

            const path = this.objPaths.get(obj);
            if (!path) return null;

            const img = await this.loadImage(path);
            objImgs.set(obj, img);
            return img;
        };

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const tile = this.mapService.getTile(x, y); // TileData
                const type = tile.tileType;
                const obj = tile.mapObject;

                const tileImg = await getTileImg(type);
                if (tileImg) {
                    ctx.drawImage(tileImg, x * cell, y * cell, cell, cell);
                }

                if (obj !== MapObjectType.None) {
                    const objImg = await getObjImg(obj);
                    if (objImg) {
                        const pad = Math.floor(cell * nombreMajore);
                        ctx.drawImage(
                            objImg,
                            x * cell + pad,
                            y * cell + pad,
                            cell - 2 * pad,
                            cell - 2 * pad,
                        );
                    }
                }
            }
        }

        return canvas.toDataURL('image/png');
    }
}