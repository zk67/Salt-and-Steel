import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameSessionService } from '@app/services/game/game-session.service';
import { GameService } from '@app/services/game/game.service';
import { MapGameStateService } from '@app/services/game/map-game-state.service';
import { MapService } from '@app/services/map/map.service';
import { PopupService } from '@app/services/popup.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { DiceTarget } from '@common/enums/player.enums';
import { GameMode } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { MapGameComponent } from './map-game.component';

/**
 * Description:
 * Ce fichier de tests verifie que MapGameComponent reagit correctement
 * a la fin d'une partie apres un combat decisif.
 *
 * Fonctionnement:
 * 1) On instancie le composant avec des mocks de ses dependances principales
 * sans lancer tout le cycle visuel du composant.
 *
 * 2) On appelle ensuite directement le handler de fin de partie pour verifier
 * le message affiche a tous, la mise a jour du timer de partie et la redirection
 * vers la page de statistiques apres le delai prevu.
 */

const REDIRECT_DELAY_MS = 5000;
const GAME_DURATION_SECONDS = 90;
const SHORT_GAME_DURATION_SECONDS = 30;

type GameServiceMock = {
    isClientPlayerTurn: ReturnType<typeof signal<boolean>>;
    players: ReturnType<typeof signal<Player[]>>;
    getPlayers: jasmine.Spy;
    clearCombatState: jasmine.Spy;
};

type MapServiceMock = {
    getGameMode: jasmine.Spy;
};

type PopupServiceMock = {
    open: jasmine.Spy;
    close: jasmine.Spy;
    isPopupOpen: jasmine.Spy;
};

describe('MapGameComponent', () => {
    let fixture: ComponentFixture<MapGameComponent>;
    let component: MapGameComponent;
    let gameService: GameServiceMock;
    let popupService: PopupServiceMock;
    let router: jasmine.SpyObj<Router>;
    let gameSessionService: jasmine.SpyObj<GameSessionService>;
    let mapGameStateService: jasmine.SpyObj<MapGameStateService>;

    beforeEach(async () => {
        gameService = createGameServiceMock();
        popupService = createPopupServiceMock();
        router = jasmine.createSpyObj<Router>('Router', ['navigate']);
        gameSessionService = jasmine.createSpyObj<GameSessionService>('GameSessionService', ['setGameTimer']);
        mapGameStateService = jasmine.createSpyObj<MapGameStateService>('MapGameStateService', ['updateVisitedTileStats']);

        await TestBed.configureTestingModule({
            imports: [MapGameComponent],
            providers: [
                { provide: GameService, useValue: gameService },
                { provide: MapService, useValue: createMapServiceMock() },
                { provide: SocketClientService, useValue: jasmine.createSpyObj<SocketClientService>('SocketClientService', ['on', 'off', 'send']) },
                { provide: PopupService, useValue: popupService },
                { provide: Router, useValue: router },
                { provide: GameSessionService, useValue: gameSessionService },
                { provide: MapGameStateService, useValue: mapGameStateService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(MapGameComponent);
        component = fixture.componentInstance;
    });

    it('affiche le gagnant a tous puis redirige vers les statistiques apres 5 secondes en mode classique', fakeAsync(() => {
        const winner = createPlayer('a1', 'Attacker');
        const loser = createPlayer('d1', 'Defender');

        gameService.players.set([winner, loser]);
        gameService.getPlayers.and.returnValue([winner, loser]);

        (component as unknown as { handleGameOver: (payload: { winnerId: string; gameDurationSeconds: number }) => void }).handleGameOver({
            winnerId: winner.id,
            gameDurationSeconds: GAME_DURATION_SECONDS,
        });

        expect(gameService.clearCombatState).toHaveBeenCalled();
        expect(mapGameStateService.updateVisitedTileStats).toHaveBeenCalled();
        expect(gameSessionService.setGameTimer).toHaveBeenCalledWith(GAME_DURATION_SECONDS);
        expect(popupService.open).toHaveBeenCalledWith(jasmine.stringContaining('Attacker'));

        tick(REDIRECT_DELAY_MS);

        expect(popupService.close).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith([APP_ROUTES.statistics]);
    }));

    it('annonce une partie sans gagnant puis redirige aussi apres 5 secondes', fakeAsync(() => {
        (
            component as unknown as {
                handleGameOver: (payload: { winnerId?: string; gameDurationSeconds: number; endedByAbandon: boolean }) => void;
            }
        ).handleGameOver({
            winnerId: '',
            gameDurationSeconds: SHORT_GAME_DURATION_SECONDS,
            endedByAbandon: true,
        });

        expect(popupService.open).toHaveBeenCalledWith(jasmine.stringContaining('sans gagnant'));

        tick(REDIRECT_DELAY_MS);

        expect(router.navigate).toHaveBeenCalledWith([APP_ROUTES.statistics]);
    }));
});

function createGameServiceMock(): GameServiceMock {
    const players = signal<Player[]>([]);

    return {
        isClientPlayerTurn: signal(false),
        players,
        getPlayers: jasmine.createSpy('getPlayers').and.callFake(() => players()),
        clearCombatState: jasmine.createSpy('clearCombatState'),
    };
}

function createMapServiceMock(): MapServiceMock {
    return {
        getGameMode: jasmine.createSpy('getGameMode').and.returnValue(GameMode.Classic),
    };
}

function createPopupServiceMock(): PopupServiceMock {
    return {
        open: jasmine.createSpy('open'),
        close: jasmine.createSpy('close'),
        isPopupOpen: jasmine.createSpy('isPopupOpen').and.returnValue(false),
    };
}

function createPlayer(id: string, name: string): Player {
    return {
        id,
        name,
        speed: 4,
        hp: 6,
        maxHp: 6,
        attack: 4,
        defense: 4,
        d6target: DiceTarget.Attack,
        d4target: DiceTarget.Defense,
        position: { x: 0, y: 0 },
        movementPoints: 4,
        actionsLeft: 1,
        hasAbandoned: false,
        isOrganizer: false,
        turnOrder: 0,
        stats: {
            combatPoints: 0,
            victoryPoints: 0,
            defeatPoints: 0,
            totalLifeLost: 0,
            totalDamageDealt: 0,
            percentageOfTileVisited: 0,
        },
        isVirtual: false,
    };
}
