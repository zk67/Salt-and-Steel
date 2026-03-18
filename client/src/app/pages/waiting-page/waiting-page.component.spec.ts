import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { WaitingPageComponent } from './waiting-page.component';

/**
 * Description:
 * Ce fichier test permet de tester la salle d'attente après la création ou la jonction
 * à une partie. Il vérifie le chargement des informations du joueur, la réception
 * des événements de démarrage de partie et la possibilité de quitter la salle d'attente.
 *
 * Fonctionnement:
 * 1) On déclare le composant WaitingPageComponent ainsi que les mocks de SocketClientService
 *    et GameService, qui simulent respectivement les communications réseau et l'état du joueur courant.
 *
 * 2) On crée un joueur simulé sous forme de signal Angular afin de reproduire
 *    le comportement réel utilisé par l'application pour suivre le joueur actif.
 *
 * 3) Dans le beforeEach(), on configure le module de test avec le composant,
 *    le routeur simulé et les services mockés, puis on initialise le composant.
 *
 * 4) Les tests vérifient que la salle d'attente charge correctement les informations
 *    du joueur courant et qu'elle demande au serveur la liste des joueurs présents.
 *
 * 5) On vérifie également:
 *    - qu'un utilisateur peut quitter la salle d'attente à tout moment;
 *    - que cela envoie les événements nécessaires au serveur;
 *    - que la room est quittée correctement;
 *    - que l'utilisateur est redirigé vers l'accueil;
 *    - et que la redirection vers la partie se produit lorsque l'événement de début de partie est reçu.
 */

describe('WaitingPageComponent', () => {
    let component: WaitingPageComponent;
    let fixture: ComponentFixture<WaitingPageComponent>;
    let router: Router;

    let socketServiceSpy: jasmine.SpyObj<SocketClientService>;
    let gameServiceSpy: jasmine.SpyObj<GameService>;

    const organizer = { id: 'host-1', name: 'Host', isOrganizer: true } as Player;
    const clientPlayerSignal = signal<Player | null>(organizer);

    beforeEach(async () => {
        socketServiceSpy = jasmine.createSpyObj<SocketClientService>('SocketClientService', [
            'on',
            'off',
            'send',
            'leaveRoom',
            'sendMessage',
        ]);

        gameServiceSpy = jasmine.createSpyObj<GameService>('GameService', [
            'getSelectedJoinRoomId',
            'clearSelectedJoinRoomId',
            'getChatMessages',
            'setChatMessages',
            'clearChatMessages',
        ], {
            clientPlayer: clientPlayerSignal,
        });

        gameServiceSpy.getSelectedJoinRoomId.and.returnValue('room-1');
        gameServiceSpy.getChatMessages.and.returnValue([]);

        await TestBed.configureTestingModule({
            imports: [WaitingPageComponent],
            providers: [
                provideRouter([]),
                { provide: SocketClientService, useValue: socketServiceSpy },
                { provide: GameService, useValue: gameServiceSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(WaitingPageComponent);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);
        spyOn(router, 'navigate');
        fixture.detectChanges();
    });

    it('devrait charger la salle d’attente avec le joueur courant', () => {
        expect(component.currentPlayerId).toBe('host-1');
        expect(component.currentPlayerName).toBe('Host');
        expect(socketServiceSpy.send).toHaveBeenCalledWith(GatewayEvents.GetPlayersToGame);
    });

    it('devrait permettre de quitter la salle d’attente à tout moment et revenir à la vue initiale', () => {
        component.goHome();

        expect(socketServiceSpy.send).toHaveBeenCalledWith(GatewayEvents.Surrender);
        expect(socketServiceSpy.leaveRoom).toHaveBeenCalledWith('room-1');
        expect(gameServiceSpy.clearSelectedJoinRoomId).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('devrait rediriger vers la partie quand elle commence', () => {
        let onGameStarted: (() => void) | undefined;
        for (const recordedCall of socketServiceSpy.on.calls.all()) {
            if (recordedCall.args[0] === GatewayEvents.GameStartInfo) {
                onGameStarted = recordedCall.args[1] as () => void;
                break;
            }
        }

        if (!onGameStarted) {
            fail('No listener registered for GameStartInfo');
            return;
        }

        onGameStarted();

        expect(router.navigate).toHaveBeenCalledWith(['/game']);
    });
});
