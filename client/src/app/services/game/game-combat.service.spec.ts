import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MapService } from '@app/services/map/map.service';
import { PopupService } from '@app/services/popup.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { DiceTarget } from '@common/enums/player.enums';
import { ActiveCombatPayload, BattleWonPayload } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GameCombatService } from './game-combat.service';
import { GamePlayerStateService } from './game-player-state.service';
import { GameTurnService } from './game-turn.service';

const NOTIFICATION_DURATION_MS = 3000;

type GamePlayerStateServiceMock = {
    players: ReturnType<typeof signal<Player[]>>;
    clientPlayer: ReturnType<typeof signal<Player | null>>;
    updatePlayer: jasmine.Spy;
    addVictoryPoint: jasmine.Spy;
    addDefeatPoint: jasmine.Spy;
    addCombatPoint: jasmine.Spy;
    addTotalLifeLost: jasmine.Spy;
    addTotalDamageDealt: jasmine.Spy;
    getPlayers: () => Player[];
    isClientPlayer: (playerId: string) => boolean;
};

type GameTurnServiceMock = {
    actionTile: ReturnType<typeof signal<boolean[][]>>;
    isClientPlayerTurn: ReturnType<typeof signal<boolean>>;
    pauseForCombat: jasmine.Spy;
    stopCombatTimerOnly: jasmine.Spy;
    resumeAfterCombat: jasmine.Spy;
    canPlayerStillDoAction: jasmine.Spy;
};

type MapServiceMock = {
    getTileMap: jasmine.Spy;
};

type SocketClientServiceMock = {
    send: jasmine.Spy;
};

type PopupServiceMock = {
    openNotification: jasmine.Spy;
};

describe('GameCombatService', () => {
    let service: GameCombatService;
    let playerState: GamePlayerStateServiceMock;
    let popupService: PopupServiceMock;
    let turnService: GameTurnServiceMock;

    beforeEach(() => {
        playerState = createGamePlayerStateServiceMock();
        turnService = createGameTurnServiceMock();

        TestBed.configureTestingModule({
            providers: [
                GameCombatService,
                { provide: GamePlayerStateService, useValue: playerState },
                { provide: GameTurnService, useValue: turnService },
                { provide: MapService, useValue: createMapServiceMock() },
                { provide: SocketClientService, useValue: createSocketClientServiceMock() },
                { provide: PopupService, useValue: createPopupServiceMock() },
            ],
        });

        service = TestBed.inject(GameCombatService);
        popupService = TestBed.inject(PopupService) as unknown as PopupServiceMock;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('affiche une notification de victoire au participant gagnant seulement', () => {
        const clientPlayer = createPlayer('c1', 'Client');
        const rival = createPlayer('p2', 'Rival');

        playerState.players.set([clientPlayer, rival]);
        playerState.clientPlayer.set(clientPlayer);

        service.handleBattleWon(createBattleWonPayload(clientPlayer.id, rival.id));

        expect(popupService.openNotification).toHaveBeenCalledWith('Victoire ! Vous avez vaincu Rival.', NOTIFICATION_DURATION_MS);
    });

    it('naffiche pas de notification au joueur qui ne participait pas au combat', () => {
        const observer = createPlayer('obs', 'Observateur');
        const winner = createPlayer('c1', 'Client');
        const loser = createPlayer('p2', 'Rival');

        playerState.players.set([observer, winner, loser]);
        playerState.clientPlayer.set(observer);

        service.handleBattleWon(createBattleWonPayload(winner.id, loser.id));

        expect(popupService.openNotification).not.toHaveBeenCalled();
    });

    it('affiche une notification de double KO aux participants du combat', () => {
        const clientPlayer = createPlayer('c1', 'Client');
        const rival = createPlayer('p2', 'Rival');

        playerState.players.set([clientPlayer, rival]);
        playerState.clientPlayer.set(clientPlayer);

        service.handleCombatStarted(createActiveCombatPayload(clientPlayer.id, rival.id));
        service.handleBattleWon({
            winnerId: '',
            loserId: '',
            loserPos: { x: 0, y: 0 },
            winnerHp: 0,
            loserHp: 0,
            doubleKo: true,
            attackerRespawn: {
                playerId: clientPlayer.id,
                position: { x: 1, y: 1 },
                hp: clientPlayer.maxHp,
            },
            defenderRespawn: {
                playerId: rival.id,
                position: { x: 2, y: 2 },
                hp: rival.maxHp,
            },
        });

        expect(popupService.openNotification).toHaveBeenCalledWith(
            'Double KO ! Vous réapparaissez après le combat.',
            NOTIFICATION_DURATION_MS,
        );
    });

    it('arrete le timer de combat apres un double KO pour un participant', () => {
        const clientPlayer = createPlayer('c1', 'Client');
        const rival = createPlayer('p2', 'Rival');

        playerState.players.set([clientPlayer, rival]);
        playerState.clientPlayer.set(clientPlayer);

        service.handleCombatStarted(createActiveCombatPayload(clientPlayer.id, rival.id));
        service.handleBattleWon({
            winnerId: '',
            loserId: '',
            loserPos: { x: 0, y: 0 },
            winnerHp: 0,
            loserHp: 0,
            doubleKo: true,
            attackerRespawn: {
                playerId: clientPlayer.id,
                position: { x: 1, y: 1 },
                hp: clientPlayer.maxHp,
            },
            defenderRespawn: {
                playerId: rival.id,
                position: { x: 2, y: 2 },
                hp: rival.maxHp,
            },
        });

        expect(turnService.stopCombatTimerOnly).toHaveBeenCalledTimes(1);
        expect(turnService.resumeAfterCombat).not.toHaveBeenCalled();
    });
});

function createGamePlayerStateServiceMock(): GamePlayerStateServiceMock {
    const players = signal<Player[]>([]);
    const clientPlayer = signal<Player | null>(null);

    return {
        players,
        clientPlayer,
        updatePlayer: jasmine.createSpy('updatePlayer'),
        addVictoryPoint: jasmine.createSpy('addVictoryPoint'),
        addDefeatPoint: jasmine.createSpy('addDefeatPoint'),
        addCombatPoint: jasmine.createSpy('addCombatPoint'),
        addTotalLifeLost: jasmine.createSpy('addTotalLifeLost'),
        addTotalDamageDealt: jasmine.createSpy('addTotalDamageDealt'),
        getPlayers: () => players(),
        isClientPlayer: (playerId: string) => clientPlayer()?.id === playerId,
    };
}

function createGameTurnServiceMock(): GameTurnServiceMock {
    return {
        actionTile: signal<boolean[][]>([]),
        isClientPlayerTurn: signal(false),
        pauseForCombat: jasmine.createSpy('pauseForCombat'),
        stopCombatTimerOnly: jasmine.createSpy('stopCombatTimerOnly'),
        resumeAfterCombat: jasmine.createSpy('resumeAfterCombat'),
        canPlayerStillDoAction: jasmine.createSpy('canPlayerStillDoAction').and.returnValue(false),
    };
}

function createMapServiceMock(): MapServiceMock {
    return {
        getTileMap: jasmine.createSpy('getTileMap').and.returnValue([[]]),
    };
}

function createSocketClientServiceMock(): SocketClientServiceMock {
    return {
        send: jasmine.createSpy('send'),
    };
}

function createPopupServiceMock(): PopupServiceMock {
    return {
        openNotification: jasmine.createSpy('openNotification'),
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
        turnOrder: 1,
        stats: {
            combatPoints: 0,
            victoryPoints: 0,
            defeatPoints: 0,
            totalLifeLost: 0,
            totalDamageDealt: 0,
            percentageOfTileVisited: 0,
        },
    };
}

function createBattleWonPayload(winnerId: string, loserId: string): BattleWonPayload {
    return {
        winnerId,
        loserId,
        winnerHp: 4,
        loserHp: 6,
        loserPos: { x: 1, y: 1 },
    };
}

function createActiveCombatPayload(attackerId: string, defenderId: string): ActiveCombatPayload {
    return {
        attackerId,
        defenderId,
        roundTimeSeconds: 10,
    };
}
