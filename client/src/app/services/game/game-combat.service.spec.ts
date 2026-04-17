import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MapService } from '@app/services/map/map.service';
import { PopupService } from '@app/services/popup.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { DiceTarget } from '@common/enums/player.enums';
import { ActiveCombatPayload, BattleWonPayload, CombatRoundDetails } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { GameCombatService } from './game-combat.service';
import { GamePlayerStateService } from './game-player-state.service';
import { GameTurnService } from './game-turn.service';

/**
 * Description:
 * Ce fichier de tests verifie que GameCombatService gere correctement
 * l'etat local d'un combat cote client, incluant le lancement du combat,
 * la mise a jour des PV, les statistiques, la reprise du tour et les notifications.
 *
 * Fonctionnement:
 * 1) On isole le service avec des mocks des services de joueur, de tour,
 * de socket, de popup et de carte pour observer les effets de bord.
 *
 * 2) On simule des rounds, des victoires, des doubles KO et des cas limites
 * afin de verifier que le service met a jour seulement ce qu'il doit et
 * nettoie bien son etat local a la fin d'un combat.
 */

const NOTIFICATION_DURATION_MS = 3000;
const ROUND_TIME_SECONDS = 10;
const REMAINING_TURN_SECONDS = 7;

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
    let socketService: SocketClientServiceMock;

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
        socketService = TestBed.inject(SocketClientService) as unknown as SocketClientServiceMock;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('initialise le combat, consomme une action de linstigateur et met le timer de combat en pause', () => {
        const attacker = createPlayer('a1', 'Attacker', { actionsLeft: 2 });
        const defender = createPlayer('d1', 'Defender');

        playerState.players.set([attacker, defender]);
        playerState.clientPlayer.set(attacker);

        service.handleCombatStarted(createActiveCombatPayload(attacker.id, defender.id));

        expect(service.activeCombat()).toEqual(createActiveCombatPayload(attacker.id, defender.id));
        expect(service.isClientInActiveCombat()).toBeTrue();
        expect(playerState.updatePlayer).toHaveBeenCalledWith(attacker.id, { actionsLeft: 1 });
        expect(turnService.pauseForCombat).toHaveBeenCalledWith(ROUND_TIME_SECONDS);
    });

    it('met a jour les PV et plafonne les statistiques aux PV reels restants', () => {
        const attacker = createPlayer('a1', 'Attacker', { hp: 1 });
        const defender = createPlayer('d1', 'Defender', { hp: 2 });

        playerState.players.set([attacker, defender]);

        service.handleCombatRound(createCombatRoundDetails({
            attackerDamageTaken: 3,
            defenderDamageTaken: 5,
            attackerDamageDealt: 5,
            defenderDamageDealt: 3,
        }));

        expect(service.currentCombatRound()).not.toBeNull();
        expect(playerState.updatePlayer).toHaveBeenCalledWith(attacker.id, { hp: 0 });
        expect(playerState.updatePlayer).toHaveBeenCalledWith(defender.id, { hp: 0 });
        expect(playerState.addTotalLifeLost).toHaveBeenCalledWith(attacker.id, 1);
        expect(playerState.addTotalLifeLost).toHaveBeenCalledWith(defender.id, 2);
        expect(playerState.addTotalDamageDealt).toHaveBeenCalledWith(defender.id, 1);
        expect(playerState.addTotalDamageDealt).toHaveBeenCalledWith(attacker.id, 2);
    });

    it('reprend le tour du gagnant local avec le temps restant et termine le tour si aucune action nest possible', () => {
        const clientPlayer = createPlayer('a1', 'Client');
        const rival = createPlayer('d1', 'Rival');

        playerState.players.set([clientPlayer, rival]);
        playerState.clientPlayer.set(clientPlayer);
        turnService.isClientPlayerTurn.set(true);
        turnService.canPlayerStillDoAction.and.returnValue(false);

        service.handleCombatStarted(createActiveCombatPayload(clientPlayer.id, rival.id));
        service.handleCombatRound(createCombatRoundDetails());
        service.handleBattleWon({
            ...createBattleWonPayload(clientPlayer.id, rival.id),
            remainingTurnSeconds: REMAINING_TURN_SECONDS,
        });

        expect(popupService.openNotification).toHaveBeenCalledWith(
            jasmine.stringContaining('Victoire'),
            NOTIFICATION_DURATION_MS,
        );
        expect(playerState.addVictoryPoint).toHaveBeenCalledWith(clientPlayer.id);
        expect(playerState.addDefeatPoint).toHaveBeenCalledWith(rival.id);
        expect(playerState.addCombatPoint).toHaveBeenCalledWith(clientPlayer.id);
        expect(playerState.addCombatPoint).toHaveBeenCalledWith(rival.id);
        expect(playerState.updatePlayer).toHaveBeenCalledWith(clientPlayer.id, { hp: 4 });
        expect(playerState.updatePlayer).toHaveBeenCalledWith(rival.id, {
            position: { x: 1, y: 1 },
            hp: 6,
        });
        expect(turnService.resumeAfterCombat).toHaveBeenCalledWith(REMAINING_TURN_SECONDS);
        expect(turnService.stopCombatTimerOnly).not.toHaveBeenCalled();
        expect(socketService.send).toHaveBeenCalledWith(GatewayEvents.EndTurnEarly);
        expect(service.currentCombatRound()).toBeNull();
        expect(service.activeCombat()).toBeNull();
    });

    it('naffiche pas de notification au joueur qui ne participait pas au combat', () => {
        const observer = createPlayer('obs', 'Observateur');
        const winner = createPlayer('c1', 'Client');
        const loser = createPlayer('p2', 'Rival');

        playerState.players.set([observer, winner, loser]);
        playerState.clientPlayer.set(observer);

        service.handleBattleWon(createBattleWonPayload(winner.id, loser.id));

        expect(popupService.openNotification).not.toHaveBeenCalled();
        expect(service.currentCombatRound()).toBeNull();
    });

    it('affiche une notification de double KO aux participants du combat', () => {
        const clientPlayer = createPlayer('c1', 'Client');
        const rival = createPlayer('p2', 'Rival');

        playerState.players.set([clientPlayer, rival]);
        playerState.clientPlayer.set(clientPlayer);

        service.handleCombatStarted(createActiveCombatPayload(clientPlayer.id, rival.id));
        service.handleBattleWon(createDoubleKoPayload(clientPlayer.id, rival.id));

        expect(popupService.openNotification).toHaveBeenCalledWith(
            jasmine.stringContaining('Double KO'),
            NOTIFICATION_DURATION_MS,
        );
    });

    it('arrete le timer de combat apres un double KO pour un participant', () => {
        const clientPlayer = createPlayer('c1', 'Client');
        const rival = createPlayer('p2', 'Rival');

        playerState.players.set([clientPlayer, rival]);
        playerState.clientPlayer.set(clientPlayer);

        service.handleCombatStarted(createActiveCombatPayload(clientPlayer.id, rival.id));
        service.handleBattleWon(createDoubleKoPayload(clientPlayer.id, rival.id));

        expect(turnService.stopCombatTimerOnly).toHaveBeenCalledTimes(1);
        expect(turnService.resumeAfterCombat).not.toHaveBeenCalled();
        expect(service.activeCombat()).toBeNull();
    });

    it('nettoie letat et arrete le timer si le payload final reference un participant absent', () => {
        const clientPlayer = createPlayer('c1', 'Client');

        playerState.players.set([clientPlayer]);
        playerState.clientPlayer.set(clientPlayer);

        service.handleCombatStarted(createActiveCombatPayload(clientPlayer.id, 'missing'));
        service.handleBattleWon(createBattleWonPayload(clientPlayer.id, 'missing'));

        expect(popupService.openNotification).not.toHaveBeenCalled();
        expect(turnService.stopCombatTimerOnly).toHaveBeenCalledTimes(1);
        expect(service.currentCombatRound()).toBeNull();
        expect(service.activeCombat()).toBeNull();
    });

    it('gere un double KO incomplet en vidant letat et en arretant le timer local', () => {
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
        });

        expect(turnService.stopCombatTimerOnly).toHaveBeenCalledTimes(1);
        expect(service.currentCombatRound()).toBeNull();
        expect(service.activeCombat()).toBeNull();
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

function createPlayer(id: string, name: string, overrides: Partial<Player> = {}): Player {
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
        isVirtual: false,
        ...overrides,
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

function createDoubleKoPayload(attackerId: string, defenderId: string): BattleWonPayload {
    return {
        winnerId: '',
        loserId: '',
        loserPos: { x: 0, y: 0 },
        winnerHp: 0,
        loserHp: 0,
        doubleKo: true,
        attackerRespawn: {
            playerId: attackerId,
            position: { x: 1, y: 1 },
            hp: 6,
        },
        defenderRespawn: {
            playerId: defenderId,
            position: { x: 2, y: 2 },
            hp: 6,
        },
    };
}

function createActiveCombatPayload(attackerId: string, defenderId: string): ActiveCombatPayload {
    return {
        attackerId,
        defenderId,
        roundTimeSeconds: ROUND_TIME_SECONDS,
    };
}

function createCombatRoundDetails(overrides?: {
    attackerDamageTaken?: number;
    defenderDamageTaken?: number;
    attackerDamageDealt?: number;
    defenderDamageDealt?: number;
}): CombatRoundDetails {
    const attackerDamageTaken = overrides?.attackerDamageTaken ?? 0;
    const defenderDamageTaken = overrides?.defenderDamageTaken ?? 1;
    const attackerDamageDealt = overrides?.attackerDamageDealt ?? defenderDamageTaken;
    const defenderDamageDealt = overrides?.defenderDamageDealt ?? attackerDamageTaken;

    return {
        attacker: {
            playerId: 'a1',
            playerName: 'Attacker',
            attack: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
            defense: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
            damageDealt: attackerDamageDealt,
            damageTaken: attackerDamageTaken,
        },
        defender: {
            playerId: 'd1',
            playerName: 'Defender',
            attack: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
            defense: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
            damageDealt: defenderDamageDealt,
            damageTaken: defenderDamageTaken,
        },
    };
}
