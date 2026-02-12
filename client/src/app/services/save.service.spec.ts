import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToolService } from '@app/services/tool/tool.service';
import { Game } from '@common/types/game.interface';
import { GameMode, MapObjectType, TileData, TileType } from '@common/types/map.interface';
import { SaveService } from './save.service';


/*
Stratégie de tests:
- Isolation: fournir un client HTTP de test via 'provideHttpClientTesting()' et espionner 'ToolService'.
- Couvre les règles de validation dans 'validateBeforeSave' (nom, description, nombre de tuiles, accessibilité, points de départ, unicité).
- Teste méthodes privées critiques ('hasEnoughBasicTiles', 'isMapAccessible', 'hasCorrectSpawnPoints') via accès par crochets 'service['...']'.
- Vérifie les appels HTTP (GET/POST/PUT/DELETE/PATCH) en cas de succès et d'erreur (utilise 'handleError').
- Cas limite explicitement testé: branche défensive dans 'isMapAccessible' (simuler 'queue.shift() === undefined').
*/

describe('SaveService', () => {
    let service: SaveService;
    let httpMock: HttpTestingController;
    let toolSpy: jasmine.SpyObj<ToolService>;
    const base = 'http://localhost:3000/api';
    const SIZE_2 = 2;
    const SIZE_3 = 3;
    const SIZE_4 = 4;

    beforeEach(() => {
        toolSpy = jasmine.createSpyObj('ToolService', ['getNumberObject']);
        TestBed.configureTestingModule({ providers: [provideHttpClientTesting(), { provide: ToolService, useValue: toolSpy }] });
        service = TestBed.inject(SaveService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    const validGame = (): Game => ({
        _id: '1',
        tiles: Array.from({ length: SIZE_4 }, () =>
            Array.from({ length: SIZE_4 }, () => ({ tileType: TileType.Basic, mapObject: MapObjectType.None })),
        ),
        name: 'Game',
        description: 'desc',
        minPlayers: 1,
        maxPlayers: 2,
        visible: true,
        imageUrl: '',
        size: SIZE_4,
        gameMode: GameMode.Classic,
        date: new Date(),
    });

    it('validateBeforeSave — nom, description et unicité signalés', async () => {
        const g = validGame();
        g.name = '';
        g.description = '';
        toolSpy.getNumberObject.and.returnValue(0);

        const promise = service.validateBeforeSave(g);
        const req = httpMock.expectOne(`${base}/games`);
        req.flush([{ ...g, _id: '2', name: 'Other', tiles: g.tiles }]);
        const errors = await promise;
        expect(errors).toContain('Le nom de la carte est invalide.');
        expect(errors).toContain('La description de la carte est invalide.');
    });

    it('validateNameUniqueness — vrai/faux', async () => {
        const g = validGame(); g._id = '1'; g.name = 'Same';
        const p = service['validateNameUniqueness'](g);
        const req = httpMock.expectOne(`${base}/games`);
        req.flush([{ ...g, _id: '2', name: g.name, tiles: g.tiles }]);
        expect(await p).toBeTrue();

        const p2 = service['validateNameUniqueness'](g);
        const req2 = httpMock.expectOne(`${base}/games`); req2.flush([]);
        expect(await p2).toBeFalse();
    });

    it('hasEnoughBasicTiles — compte correctement les tuiles non-mur', () => {
        const tiles: TileData[][] = Array.from({ length: SIZE_2 }, () =>
            Array.from({ length: SIZE_2 }, () => ({ tileType: TileType.Water, mapObject: MapObjectType.None })),
        );

        expect(service['hasEnoughBasicTiles'](tiles, SIZE_2)).toBeTrue();

        tiles[0][0].tileType = TileType.Wall;
        tiles[0][1].tileType = TileType.Wall;
        tiles[1][0].tileType = TileType.Wall;
        tiles[1][1].tileType = TileType.Basic;

        expect(service['hasEnoughBasicTiles'](tiles, SIZE_2)).toBeFalse();
    });

    it('isMapAccessible — vrai/faux', () => {
        const allOpen: TileData[][] = Array.from({ length: SIZE_3 }, () =>
            Array.from({ length: SIZE_3 }, () => ({ tileType: TileType.Basic, mapObject: MapObjectType.None })),
        );

        expect(service['isMapAccessible'](allOpen, SIZE_3)).toBeTrue();

        const isolated: TileData[][] = [
            [
                { tileType: TileType.Basic, mapObject: MapObjectType.None },
                { tileType: TileType.Wall, mapObject: MapObjectType.None },
            ],
            [
                { tileType: TileType.Wall, mapObject: MapObjectType.None },
                { tileType: TileType.Basic, mapObject: MapObjectType.None },
            ],
        ];

        expect(service['isMapAccessible'](isolated, SIZE_2)).toBeFalse();
    });

    it('hasCorrectSpawnPoints — utilise ToolService', () => {
        toolSpy.getNumberObject.and.returnValue(0);
        expect(service['hasCorrectSpawnPoints']()).toBeTrue();
        expect(toolSpy.getNumberObject).toHaveBeenCalledWith(MapObjectType.SpawnPoint);
        toolSpy.getNumberObject.and.returnValue(1);
        expect(service['hasCorrectSpawnPoints']()).toBeFalse();
    });

    it('Méthodes HTTP et handleError', () => {
        const g = validGame();
        service.getAllGames().subscribe(res => expect(res).toEqual([g]));
        httpMock.expectOne(`${base}/games`).flush([g]);

        service.getAllVisibleGames().subscribe(res => expect(res).toEqual([g]));
        httpMock.expectOne(`${base}/games/visible`).flush([g]);

        service.addGame(g).subscribe(res => expect(res._id).toBeDefined());
        const post = httpMock.expectOne(`${base}/games`);
        expect(post.request.method).toBe('POST'); post.flush({ ...g, _id: 'x' });

        service.replaceGame('x', g).subscribe(res => expect(res).toEqual(g));
        const put = httpMock.expectOne(`${base}/games/x`);
        expect(put.request.method).toBe('PUT'); put.flush(g);

        service.deleteGame('x').subscribe(res => expect(res).toEqual(g));
        const del = httpMock.expectOne(`${base}/games/x`);
        expect(del.request.method).toBe('DELETE'); del.flush(g);

        service.getGame('x').subscribe(res => expect(res).toEqual(g));
        const get = httpMock.expectOne(`${base}/games/x`);
        expect(get.request.method).toBe('GET'); get.flush(g);

        service.updateGameVisibility('x', true).subscribe(res => expect(res).toEqual(g));
        const patch = httpMock.expectOne(`${base}/games/x`);
        expect(patch.request.method).toBe('PATCH'); expect(patch.request.body).toEqual({ visible: true });
        patch.flush(g);

        service.getAllGames().subscribe({
            next: () => fail('devrait lancer une erreur'),
            error: (err) => expect(err.message).toContain('Erreur lors de la requête getAllGames'),
        });
        const errReq = httpMock.expectOne(`${base}/games`);
        errReq.error(new ErrorEvent('err'));
    });

    it('validateBeforeSave — nom invalide seulement', async () => {
        const g = validGame(); g.name = '';
        toolSpy.getNumberObject.and.returnValue(0);
        const p = service.validateBeforeSave(g);
        const req = httpMock.expectOne(`${base}/games`); req.flush([]);
        const errors = await p;
        expect(errors).toContain('Le nom de la carte est invalide.');
        expect(errors).not.toContain('La description de la carte est invalide.');
    });

    it('validateBeforeSave — description invalide seulement', async () => {
        const g = validGame(); g.description = '';
        toolSpy.getNumberObject.and.returnValue(0);
        const p = service.validateBeforeSave(g);
        const req = httpMock.expectOne(`${base}/games`); req.flush([]);
        const errors = await p;
        expect(errors).toContain('La description de la carte est invalide.');
        expect(errors).not.toContain('Le nom de la carte est invalide.');
    });

    it('validateBeforeSave — tuiles de base insuffisantes seulement', async () => {
        const g = validGame();
        g.size = SIZE_4;

        const tiles: TileData[][] = Array.from({ length: SIZE_4 }, () =>
            Array.from({ length: SIZE_4 }, () => ({ tileType: TileType.Wall, mapObject: MapObjectType.None })),
        );

        for (let c = 0; c < SIZE_4; c++) tiles[0][c].tileType = TileType.Basic;
        for (let c = 0; c < SIZE_3; c++) tiles[1][c].tileType = TileType.Basic;

        g.tiles = tiles;
        toolSpy.getNumberObject.and.returnValue(0);

        const p = service.validateBeforeSave(g);
        const req = httpMock.expectOne(`${base}/games`);
        req.flush([]);

        const errors = await p;
        expect(errors).toContain(
            'Le nombre de tuiles de terrain doit couvrir plus de la moitié de la zone de jeu.',
        );
    });

    it('validateBeforeSave — carte inaccessible seulement', async () => {
        const g = validGame();
        g.size = SIZE_4;

        const tiles: TileData[][] = Array.from({ length: SIZE_4 }, () =>
            Array.from({ length: SIZE_4 }, () => ({ tileType: TileType.Wall, mapObject: MapObjectType.None })),
        );

        for (let c = 0; c < SIZE_4; c++) tiles[0][c].tileType = TileType.Basic;
        for (let c = 0; c < SIZE_4; c++) tiles[1][c].tileType = TileType.Wall;
        for (let c = 0; c < SIZE_4; c++) tiles[3][c].tileType = TileType.Basic;

        g.tiles = tiles;
        toolSpy.getNumberObject.and.returnValue(0);

        const p = service.validateBeforeSave(g);
        const req = httpMock.expectOne(`${base}/games`);
        req.flush([]);

        const errors = await p;
        expect(errors).toContain('Certaines tuiles sur le jeu sont inaccessibles.');
    });

    it('validateBeforeSave — points de départ incorrects', async () => {
        const g = validGame();
        toolSpy.getNumberObject.and.returnValue(2);
        const p = service.validateBeforeSave(g);
        const req = httpMock.expectOne(`${base}/games`); req.flush([]);
        const errors = await p;
        expect(errors).toContain('Le nombre de points de départ ne correspond pas aux exigences.');
    });

    it('validateBeforeSave — nom déjà existant', async () => {
        const g = validGame(); g._id = '1'; g.name = 'Dup';
        toolSpy.getNumberObject.and.returnValue(0);
        const p = service.validateBeforeSave(g);
        const req = httpMock.expectOne(`${base}/games`);
        req.flush([{ ...g, _id: '2', name: 'Dup', tiles: g.tiles }]);
        const errors = await p;
        expect(errors).toContain('Un jeu avec ce nom existe déjà.');
    });

    it('isMapAccessible renvoie false quand pas de tuiles non-mur', () => {
        const tiles: TileData[][] = Array.from({ length: SIZE_3 }, () =>
            Array.from({ length: SIZE_3 }, () => ({ tileType: TileType.Wall, mapObject: MapObjectType.None })),
        );

        expect(service['isMapAccessible'](tiles, SIZE_3)).toBeFalse();
    });

    it('branche défensive quand queue.shift() retourne undefined', () => {
        const tiles: TileData[][] = Array.from({ length: SIZE_3 }, () =>
            Array.from({ length: SIZE_3 }, () => ({ tileType: TileType.Basic, mapObject: MapObjectType.None })),
        );

        const originalShift = Array.prototype.shift as unknown as () => unknown;
        let first = true;

        (Array.prototype as unknown as { shift: () => unknown }).shift =
            function (this: unknown[]): unknown {
                if (first) {
                    first = false;
                    return undefined;
                }
                return (originalShift as (this: unknown[]) => unknown).call(this);
            };

        const result = service['isMapAccessible'](tiles, SIZE_3);

        (Array.prototype as unknown as { shift: () => unknown }).shift = originalShift;
        expect(result).toBeFalse();
    });

    it('handleError lance une erreur avec le message approprié', () => {
        const h = service['handleError']<Game>('getAllGames');
        expect(() => h(new Error('Network error'))).toThrowError('Erreur lors de la requête getAllGames: Network error');
    });
});
