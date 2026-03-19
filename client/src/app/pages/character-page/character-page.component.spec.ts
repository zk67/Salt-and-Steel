import { signal } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { BonusTarget, DiceTarget } from '@common/enums/player.enums';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { CharacterPageComponent } from './character-page.component';


/**
 * Description:
 * Ce fichier test permet de tester la page de création de personnage lorsqu'un utilisateur
 * rejoint une partie existante. Il couvre la sélection d'avatar, la validation du personnage,
 * la gestion des conflits d'avatars, la détection d'une partie verrouillée et la redirection
 * vers la salle d'attente.
 *
 * Fonctionnement:
 * 1) On déclare le composant CharacterPageComponent ainsi que les mocks de SocketClientService
 *    et GameService nécessaires pour simuler le comportement réel du formulaire de création.
 *
 * 2) On crée des spies pour les méthodes socket importantes comme joinRoom(), send(), on(), off()
 *    ainsi que pour les méthodes de GameService utilisées pour récupérer la salle jointe
 *    ou mémoriser le joueur courant.
 *
 * 3) Dans le beforeEach(), on configure le module de test Angular avec le composant autonome,
 *    le routeur simulé et les services mockés, puis on instancie le composant.
 *
 * 4) Une fonction utilitaire permet de récupérer les callbacks enregistrés sur les événements
 *    socket comme 'unavailableAvatars', 'playerId' et 'joinCurrentGameResult' afin de simuler
 *    les réponses du serveur.
 *
 * 5) Les tests valident:
 *    - l'abonnement à la liste des avatars indisponibles;
 *    - la mise à jour dynamique de ces avatars;
 *    - l'émission du choix d'avatar en temps réel;
 *    - l'interdiction de choisir un avatar déjà réservé;
 *    - l'envoi correct des données du personnage;
 *    - la redirection vers la salle d'attente si la validation réussit;
 *    - l'affichage d'un avertissement si la partie se verrouille;
 *    - le choix entre réessayer ou revenir à l'accueil;
 *    - la libération de l'avatar temporaire à la fermeture du composant;
 *    - l'affichage d'une erreur lorsqu'un nom invalide est saisi.
 */

describe('CharacterPageComponent', () => {
    const INVALID_NAME_MESSAGE_TIMEOUT_MS = 1000;
    let component: CharacterPageComponent;
    let fixture: ComponentFixture<CharacterPageComponent>;
    let router: Router;

    let socketServiceSpy: jasmine.SpyObj<SocketClientService>;
    let gameServiceSpy: jasmine.SpyObj<GameService>;

    beforeEach(async () => {
        socketServiceSpy = jasmine.createSpyObj<SocketClientService>('SocketClientService', [
            'isSocketAlive',
            'connect',
            'joinRoom',
            'send',
            'on',
            'off',
        ]);

        gameServiceSpy = jasmine.createSpyObj<GameService>('GameService', [
            'getSelectedJoinRoomId',
            'getSelectedHostGame',
            'clearSelectedHostGame',
            'clearSelectedJoinRoomId',
            'setSelectedJoinRoomId',
            'setClientPlayer',
        ], {
            clientPlayer: signal<Player | null>(null),
        });

        socketServiceSpy.isSocketAlive.and.returnValue(true);
        gameServiceSpy.getSelectedJoinRoomId.and.returnValue('room-1');
        gameServiceSpy.getSelectedHostGame.and.returnValue(null);

        await TestBed.configureTestingModule({
            imports: [CharacterPageComponent],
            providers: [
                provideRouter([]),
                { provide: SocketClientService, useValue: socketServiceSpy },
                { provide: GameService, useValue: gameServiceSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CharacterPageComponent);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);
        spyOn(router, 'navigate');
    });

    function getListener<T>(eventName: GatewayEvents): (payload: T) => void {
        for (const recordedCall of socketServiceSpy.on.calls.all()) {
            if (recordedCall.args[0] === eventName) {
                return recordedCall.args[1] as (payload: T) => void;
            }
        }

        throw new Error(`No socket listener registered for event ${eventName}`);
    }

    it('devrait s’abonner aux avatars indisponibles et demander la liste à l’initialisation pour une partie rejointe', () => {
        fixture.detectChanges();

        expect(socketServiceSpy.joinRoom).toHaveBeenCalledWith('room-1');
        expect(socketServiceSpy.on).toHaveBeenCalledWith(GatewayEvents.UnavailableAvatars, jasmine.any(Function));
        expect(socketServiceSpy.send).toHaveBeenCalledWith(GatewayEvents.GetUnavailableAvatars);
    });

    it('devrait mettre à jour dynamiquement les avatars indisponibles selon les autres choix', () => {
        fixture.detectChanges();
        getListener<string[]>(GatewayEvents.UnavailableAvatars)(['assets/avatars/avatar-2.png']);

        expect(component.isAvatarUnavailable('assets/avatars/avatar-2.png')).toBeTrue();
        expect(component.isAvatarUnavailable('assets/avatars/avatar-3.png')).toBeFalse();
    });

    it('devrait émettre le choix d’avatar dans le formulaire de jointure', () => {
        fixture.detectChanges();

        component.selectAvatar('assets/avatars/avatar-3.png');

        expect(component.avatar.value).toBe('assets/avatars/avatar-3.png');
        expect(socketServiceSpy.send).toHaveBeenCalledWith(GatewayEvents.SelectAvatarInJoinForm, 'assets/avatars/avatar-3.png');
    });

    it('devrait empêcher de sélectionner un avatar déjà réservé par un autre joueur', () => {
        fixture.detectChanges();
        getListener<string[]>(GatewayEvents.UnavailableAvatars)(['assets/avatars/avatar-4.png']);
        component.selectAvatar('assets/avatars/avatar-4.png');

        expect(component.avatar.value).toBeNull();
    });

    it('devrait rediriger vers la salle d’attente après une validation réussie', () => {
        fixture.detectChanges();
        component.characterName.setValue('Anne');
        component.avatar.setValue('assets/avatars/avatar-1.png');
        component.toggleBonus(BonusTarget.Hp);
        component.toggleDiceBonus(DiceTarget.Attack);

        component.submitCharacter();

        const onPlayerId = getListener<Player>(GatewayEvents.PlayerId);
        onPlayerId({ id: 'socket-1' } as Player);

        expect(socketServiceSpy.joinRoom).toHaveBeenCalledWith('room-1');
        expect(socketServiceSpy.send).toHaveBeenCalledWith(GatewayEvents.AddPlayerToCurrentGame, jasmine.objectContaining({
            name: 'Anne',
            imageUrl: 'assets/avatars/avatar-1.png',
        }));

        const onJoinResult = getListener<{ success: boolean }>(GatewayEvents.JoinCurrentGameResult);
        onJoinResult({ success: true });

        expect(router.navigate).toHaveBeenCalledWith([APP_ROUTES.waiting]);
    });

    it('devrait avertir le joueur si la partie est verrouillée puis lui permettre de réessayer', () => {
        fixture.detectChanges();
        component.characterName.setValue('Anne');
        component.avatar.setValue('assets/avatars/avatar-1.png');
        component.toggleBonus(BonusTarget.Hp);
        component.toggleDiceBonus(DiceTarget.Attack);
        spyOn(window, 'confirm').and.returnValue(true);

        component.submitCharacter();
        getListener<Player>(GatewayEvents.PlayerId)({ id: 'socket-1' } as Player);

        const onJoinResult = getListener<{ success: boolean }>(GatewayEvents.JoinCurrentGameResult);
        onJoinResult({ success: false });

        expect(window.confirm).toHaveBeenCalled();
        expect(socketServiceSpy.send).toHaveBeenCalledWith(GatewayEvents.AddPlayerToCurrentGame, jasmine.anything());
        expect(router.navigate).not.toHaveBeenCalledWith([APP_ROUTES.home]);
    });

    it('devrait retourner à l’accueil si la partie est verrouillée et que le joueur refuse de réessayer', () => {
        fixture.detectChanges();
        component.characterName.setValue('Anne');
        component.avatar.setValue('assets/avatars/avatar-1.png');
        component.toggleBonus(BonusTarget.Hp);
        component.toggleDiceBonus(DiceTarget.Attack);
        spyOn(window, 'confirm').and.returnValue(false);

        component.submitCharacter();
        getListener<Player>(GatewayEvents.PlayerId)({ id: 'socket-1' } as Player);
        getListener<{ success: boolean }>(GatewayEvents.JoinCurrentGameResult)({ success: false });

        expect(gameServiceSpy.clearSelectedJoinRoomId).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith([APP_ROUTES.home]);
    });

    it('devrait libérer l’avatar temporairement choisi quand on quitte le formulaire', () => {
        fixture.detectChanges();

        component.ngOnDestroy();

        expect(socketServiceSpy.send).toHaveBeenCalledWith(GatewayEvents.ClearSelectedAvatarInJoinForm);
        expect(socketServiceSpy.off).toHaveBeenCalledWith(GatewayEvents.UnavailableAvatars, jasmine.any(Function));
    });

    it('devrait afficher un message si le nom est invalide', fakeAsync(() => {
        fixture.detectChanges();
        component.characterName.setValue('***');
        component.avatar.setValue('assets/avatars/avatar-1.png');
        component.toggleBonus(BonusTarget.Hp);
        component.toggleDiceBonus(DiceTarget.Attack);

        component.submitCharacter();

        expect(component.showInvalidNameMessage).toBeTrue();
        tick(INVALID_NAME_MESSAGE_TIMEOUT_MS);
        expect(component.showInvalidNameMessage).toBeFalse();
    }));
});
