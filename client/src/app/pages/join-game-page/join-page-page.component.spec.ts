import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GameService } from '@app/services/game.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { JoinGameComponent } from './join-game-page.component';

/*
Stratégie de tests:
- On valide une fonctionnalité Sprint 2 de la page "joindre une partie".
- Le service socket est mocké pour simuler la mise à jour dynamique de la liste.
- Le GameService est mocké pour vérifier la sélection de la room.
- On vérifie:
  1) l'initialisation réseau (connexion + demande des parties joignables),
  2) la mise à jour dynamique de l'affichage,
  3) la redirection vers le formulaire quand une partie est choisie,
  4) le nettoyage du listener socket à la destruction.
*/

describe('JoinGameComponent', () => {
    let component: JoinGameComponent;
    let fixture: ComponentFixture<JoinGameComponent>;
    let router: Router;

    let socketServiceSpy: jasmine.SpyObj<SocketClientService>;
    let gameServiceSpy: jasmine.SpyObj<GameService>;

    const mockJoinableGames = [
        {
            roomId: 'room-1',
            game: {
                _id: 'g1',
                name: 'Partie A',
                maxPlayers: 4,
            } as never,
            playerCount: 2,
        },
    ];

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

    it('devrait se connecter si le socket nest pas actif et demander les parties joignables', () => {
        expect(socketServiceSpy.connect).toHaveBeenCalled();
        expect(socketServiceSpy.on).toHaveBeenCalledWith('joinableGames', jasmine.any(Function));
        expect(socketServiceSpy.send).toHaveBeenCalledWith('getJoinableGames');
    });

    it('devrait mettre à jour la liste dynamiquement quand joinableGames est reçu', () => {
        const callback = socketServiceSpy.on.calls.mostRecent().args[1] as (games: unknown[]) => void;

        callback(mockJoinableGames);
        fixture.detectChanges();

        expect(component.joinableGames()).toEqual(mockJoinableGames as never);

        const text = fixture.nativeElement.textContent;
        expect(text).toContain('Partie A');
        expect(text).toContain('2 / 4');
    });

    it('devrait enregistrer la room choisie et naviguer vers le formulaire de personnage', () => {
        component.selectGame('room-1');

        expect(gameServiceSpy.setSelectedJoinRoomId).toHaveBeenCalledWith('room-1');
        expect(router.navigate).toHaveBeenCalledWith(['/character-form']);
    });

    it('devrait désenregistrer le listener socket à la destruction', () => {
        component.ngOnDestroy();
        expect(socketServiceSpy.off).toHaveBeenCalledWith('joinableGames', jasmine.any(Function));
    });
});