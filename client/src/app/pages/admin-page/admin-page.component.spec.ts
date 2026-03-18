import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SaveService } from '@app/services/save/save.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { Game } from '@common/interfaces/game.interface';
import { GatewayEvents } from '@common/types/gateway.events';

import { AdminPageComponent } from './admin-page.component';

/**
 * Description:
 * Dans ce fichier on teste la page Admin côté client.
 * On vérifie que les actions UI appellent les bons services (SaveService, SocketClientService)
 * et que l’état du composant (loading, errorMsg, games) est mis à jour correctement.
 *
 * Fonctionnement:
 * 1) On instancie le composant Angular avec TestBed et on remplace Router, SaveService et SocketClientService
 * par des spies (mocks).
 *
 * 2) Pour chaque méthode importante (back, createGame, refresh, deleteGame, toggleVisibility, ngOnInit),
 * on appelle la méthode, puis on vérifie :
 *   - les appels (navigate, getAllGames, deleteGame, updateGameVisibility, socket.on/off/send)
 *   - les changements d’état (games, loading, errorMsg)
 */

describe('Page admin (AdminPageComponent)', () => {
    let component: AdminPageComponent;
    let fixture: ComponentFixture<AdminPageComponent>;

    let routerSpy: jasmine.SpyObj<Router>;
    let saveServiceSpy: jasmine.SpyObj<SaveService>;
    let socketSpy: jasmine.SpyObj<SocketClientService>;

    beforeEach(async () => {
        routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
        saveServiceSpy = jasmine.createSpyObj<SaveService>('SaveService', ['getAllGames', 'deleteGame', 'updateGameVisibility']);
        socketSpy = jasmine.createSpyObj<SocketClientService>('SocketClientService', ['send', 'on', 'off']);

        saveServiceSpy.getAllGames.and.returnValue(of([]));
        saveServiceSpy.deleteGame.and.returnValue(of({} as Game));
        saveServiceSpy.updateGameVisibility.and.returnValue(of({} as Game));

        await TestBed.configureTestingModule({
            imports: [AdminPageComponent],
            providers: [
                { provide: Router, useValue: routerSpy },
                { provide: SaveService, useValue: saveServiceSpy },
                { provide: SocketClientService, useValue: socketSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AdminPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        saveServiceSpy.getAllGames.calls.reset();
        saveServiceSpy.deleteGame.calls.reset();
        saveServiceSpy.updateGameVisibility.calls.reset();
        socketSpy.send.calls.reset();
        socketSpy.on.calls.reset();
        socketSpy.off.calls.reset();
        routerSpy.navigate.calls.reset();
    });

    it('devrait être créé', () => {
        expect(component).toBeTruthy();
    });

    it('back() devrait naviguer vers /home', () => {
        component.back();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('createGame() devrait naviguer vers /form-edition', () => {
        component.createGame();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/form-edition']);
    });

    it('editGame() devrait afficher une erreur si l id est indéfini', () => {
        component.editGame(undefined);
        expect(component.errorMsg).toBe('Id invalide.');
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('refresh() devrait charger les jeux et arrêter le chargement en cas de succès', () => {
        const games = [{ _id: '1' }] as unknown as Game[];
        saveServiceSpy.getAllGames.and.returnValue(of(games));

        component.refresh();

        expect(saveServiceSpy.getAllGames).toHaveBeenCalled();
        expect(component.games).toEqual(games);
        expect(component.loading).toBeFalse();
        expect(component.errorMsg).toBe('');
    });

    it('refresh() devrait définir errorMsg en cas d erreur', () => {
        saveServiceSpy.getAllGames.and.returnValue(throwError(() => new Error('fail')));

        component.refresh();

        expect(component.loading).toBeFalse();
        expect(component.errorMsg).toBe('Impossible de charger les jeux.');
    });

    it('deleteGame() devrait afficher une erreur si l id est indéfini ', () => {
        component.deleteGame(undefined);
        expect(component.errorMsg).toBe('Id invalide.');
        expect(saveServiceSpy.deleteGame).not.toHaveBeenCalled();
    });

    it('deleteGame() (succès) devrait appeler deleteGame du service', () => {
        component.deleteGame('abc');
        expect(saveServiceSpy.deleteGame).toHaveBeenCalledWith('abc');
    });

    it('toggleVisibility() (succès) devrait appeler updateGameVisibility du service', () => {
        const game = { _id: '1', visible: true } as unknown as Game;
        component.toggleVisibility(game);
        expect(saveServiceSpy.updateGameVisibility).toHaveBeenCalledWith('1', false);
    });

    it('toggleVisibility() (erreur) devrait définir errorMsg', () => {
        saveServiceSpy.updateGameVisibility.and.returnValue(throwError(() => new Error('fail')));
        const game = { _id: '1', visible: true } as unknown as Game;

        component.toggleVisibility(game);

        expect(component.errorMsg).toBe('Impossible de changer la visibilité.');
        expect(socketSpy.send).not.toHaveBeenCalled();
    });

    it('ngOnInit() devrait s abonner à l événement update du socket', () => {
        component.ngOnInit();
        expect(socketSpy.on).toHaveBeenCalled();
        expect(socketSpy.on.calls.mostRecent().args[0]).toBe(GatewayEvents.Update);
    });

    it('deleteGame() devrait définir errorMsg si le service échoue', () => {
        saveServiceSpy.deleteGame.and.returnValue(throwError(() => new Error('fail')));
        component.deleteGame('abc');
        expect(component.errorMsg).toBe('Impossible de supprimer le jeu.');
    });

    it('editGame() devrait naviguer vers /edition avec l id en queryParams', () => {
        component.editGame('abc');
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/edition'], { queryParams: { id: 'abc' } });
    });

    it('ngOnInit() devrait recharger les jeux quand le socket émet update', () => {
        component.ngOnInit();
        saveServiceSpy.getAllGames.calls.reset();
        const onUpdateHandler = socketSpy.on.calls.mostRecent().args[1] as unknown as () => void;
        onUpdateHandler();//simule l eve update
        expect(saveServiceSpy.getAllGames).toHaveBeenCalled();
    });
});
