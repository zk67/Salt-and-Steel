import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { GameService } from '@app/services/game.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { JoinGameComponent } from './join-game-page.component';

/**
 * Description:
 * Ce fichier test permet de tester la vue de sélection d'une partie à rejoindre.
 * Il vérifie la récupération dynamique des parties disponibles, leur affichage,
 * leur mise à jour en temps réel ainsi que la redirection vers la création de personnage.
 *
 * Fonctionnement:
 * 1) On déclare le composant à tester JoinGameComponent, ainsi que les mocks nécessaires,
 *    notamment SocketClientService pour simuler les événements socket et GameService
 *    pour gérer la sélection de la salle.
 *
 * 2) On instancie des spies Jasmine sur les méthodes importantes comme connect(), on(),
 *    off(), send() et setSelectedJoinRoomId() afin de vérifier les appels effectués
 *    par le composant pendant son exécution.
 *
 * 3) Dans le beforeEach(), on configure le module Angular de test avec le composant,
 *    les providers simulés et le routeur, puis on crée le composant avec TestBed.
 *
 * 4) Une fonction utilitaire permet de récupérer le callback enregistré sur l'événement
 *    socket 'joinableGames', ce qui permet de simuler facilement une mise à jour de la liste
 *    des parties disponibles.
 *
 * 5) Les tests vérifient:
 *    - que le socket est connecté au besoin;
 *    - que le composant demande la liste des parties joignables;
 *    - que les parties affichées contiennent le bon nombre de joueurs;
 *    - que la liste est mise à jour dynamiquement lorsqu'une partie disparaît;
 *    - qu'un utilisateur peut sélectionner une partie;
 *    - qu'il est ensuite redirigé vers la vue de création de personnage;
 *    - que les abonnements socket sont bien nettoyés à la destruction du composant.
 */

describe('JoinGameComponent', () => {
    let component: JoinGameComponent;
    let fixture: ComponentFixture<JoinGameComponent>;
    let router: Router;

    let socketServiceSpy: jasmine.SpyObj<SocketClientService>;
    let gameServiceSpy: jasmine.SpyObj<GameService>;

    const firstGame = {
        roomId: 'room-1',
        game: {
            _id: 'g1',
            name: 'Partie A',
            maxPlayers: 4,
        } as never,
        playerCount: 2,
    };

    const secondGame = {
        roomId: 'room-2',
        game: {
            _id: 'g2',
            name: 'Partie B',
            maxPlayers: 6,
        } as never,
        playerCount: 5,
    };

    beforeEach(async () => {
        socketServiceSpy = jasmine.createSpyObj<SocketClientService>('SocketClientService', [
            'isSocketAlive',
            'connect',
            'on',
            'off',
            'send',
        ]);

        gameServiceSpy = jasmine.createSpyObj<GameService>('GameService', [
            'setSelectedJoinRoomId',
        ]);

        socketServiceSpy.isSocketAlive.and.returnValue(false);

        await TestBed.configureTestingModule({
            imports: [JoinGameComponent],
            providers: [
                provideRouter([]),
                { provide: SocketClientService, useValue: socketServiceSpy },
                { provide: GameService, useValue: gameServiceSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(JoinGameComponent);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);
        spyOn(router, 'navigate');

        fixture.detectChanges();
    });

    function getJoinableGamesListener(): (games: unknown[]) => void {
        const joinableGamesCall = socketServiceSpy.on.calls.all().find((call) => call.args[0] === 'joinableGames');
        return joinableGamesCall?.args[1] as (games: unknown[]) => void;
    }

    it('devrait se connecter si le socket n’est pas actif et demander les parties joignables', () => {
        expect(socketServiceSpy.connect).toHaveBeenCalled();
        expect(socketServiceSpy.on).toHaveBeenCalledWith('joinableGames', jasmine.any(Function));
        expect(socketServiceSpy.send).toHaveBeenCalledWith('getJoinableGames');
    });

    it('devrait afficher toutes les parties en attente avec au moins une place disponible et le nombre de joueurs', () => {
        getJoinableGamesListener()([firstGame, secondGame]);
        fixture.detectChanges();

        const rows = fixture.debugElement.queryAll(By.css('.game-row'));
        expect(rows.length).toBe(2);
        expect(fixture.nativeElement.textContent).toContain('Partie A');
        expect(fixture.nativeElement.textContent).toContain('2 / 4');
        expect(fixture.nativeElement.textContent).toContain('Partie B');
        expect(fixture.nativeElement.textContent).toContain('5 / 6');
    });

    it('devrait mettre la liste à jour dynamiquement lorsqu’une partie n’est plus disponible', () => {
        getJoinableGamesListener()([firstGame, secondGame]);
        fixture.detectChanges();
        expect(fixture.debugElement.queryAll(By.css('.game-row')).length).toBe(2);

        getJoinableGamesListener()([secondGame]);
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent;
        expect(fixture.debugElement.queryAll(By.css('.game-row')).length).toBe(1);
        expect(text).not.toContain('Partie A');
        expect(text).toContain('Partie B');
    });

    it('devrait permettre de choisir une partie et rediriger vers la création de personnage', () => {
        component.selectGame('room-1');

        expect(gameServiceSpy.setSelectedJoinRoomId).toHaveBeenCalledWith('room-1');
        expect(router.navigate).toHaveBeenCalledWith(['/character-form']);
    });

    it('devrait désenregistrer le listener socket à la destruction', () => {
        const callback = getJoinableGamesListener();
        component.ngOnDestroy();
        expect(socketServiceSpy.off).toHaveBeenCalledWith('joinableGames', callback);
    });
});