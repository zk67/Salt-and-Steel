import { PlayableGame } from '@app/interface/game.interface';
import { CurrentGamesService } from '@app/service/current-games.service';
import { TurnFlowService } from '@app/service/turn-flow.service';
import { Timer } from '@app/utils/game-timer';
import { TurnPhase } from '@common/enums/game.enums';
import { GameMode, MapObjectType, TileType } from '@common/enums/map.enums';
import { DiceTarget } from '@common/enums/player.enums';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';
import * as testConst from '@common/types/tests.constant';

/**
 * Description:
 * Ce fichier de tests verifie le bon fonctionnement du timer de tour
 * ainsi que la gestion du flux des tours dans TurnFlowService.
 *
 * Fonctionnement:
 * 1) On valide le comportement du timer avec des faux timers pour verifier
 * la decrementation du temps, l'arret du timer et l'expiration du tour.
 *
 * 2) On verifie ensuite les transitions de phase et le passage entre joueurs
 * pour s'assurer que TurnFlowService met correctement a jour l'etat de la partie.
 */

describe('Timer', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('decremente chaque seconde puis appelle changeTurn a lexpiration', () => {
        jest.useFakeTimers();
        const currentGamesService = { changeTurn: jest.fn() } as unknown as CurrentGamesService;
        const timer = new Timer(currentGamesService);

        timer.startTurnTimer(testConst.ROOM_ID, testConst.THREE_VALUE);

        jest.advanceTimersByTime(testConst.ONE_SECOND_MS);
        expect(timer.getCurrentTime(testConst.ROOM_ID)).toBe(testConst.TWO_VALUE);

        jest.advanceTimersByTime(testConst.ONE_SECOND_MS);
        expect(timer.getCurrentTime(testConst.ROOM_ID)).toBe(testConst.ONE_VALUE);

        jest.advanceTimersByTime(testConst.TWO_SECONDS_MS);
        expect(currentGamesService.changeTurn).toHaveBeenCalledWith(testConst.ROOM_ID);
    });

    it('stopTimer annule le timeout logique et empeche le passage de tour', () => {
        jest.useFakeTimers();
        const currentGamesService = { changeTurn: jest.fn() } as unknown as CurrentGamesService;
        const timer = new Timer(currentGamesService);

        timer.startTurnTimer(testConst.ROOM_ID, testConst.THREE_VALUE);
        timer.stopTimer(testConst.ROOM_ID);
        jest.advanceTimersByTime(testConst.FIVE_SECONDS_MS);

        expect(currentGamesService.changeTurn).not.toHaveBeenCalled();
        expect(timer.getCurrentTime(testConst.ROOM_ID)).toBe(testConst.NO_VALUE);
    });

    it('ignore un second startTurnTimer si un timer existe deja pour la room', () => {
        jest.useFakeTimers();
        const currentGamesService = { changeTurn: jest.fn() } as unknown as CurrentGamesService;
        const timer = new Timer(currentGamesService);

        timer.startTurnTimer(testConst.ROOM_ID, testConst.THIRTY_VALUE);
        timer.startTurnTimer(testConst.ROOM_ID, testConst.TEN_VALUE);

        jest.advanceTimersByTime(testConst.ONE_SECOND_MS);
        expect(timer.getCurrentTime(testConst.ROOM_ID)).toBe(testConst.THIRTY_VALUE - testConst.ONE_VALUE);
    });
});

describe('TurnFlowService', () => {
    let emitShrineBuffOff: jest.Mock;
    let service: TurnFlowService;
    let timer: jest.Mocked<Timer>;
    let emitTurnUpdate: jest.Mock;

    beforeEach(() => {
        emitShrineBuffOff = jest.fn();
        service = new TurnFlowService(emitShrineBuffOff);
        timer = {
            startTurnTimer: jest.fn(),
            stopTimer: jest.fn(),
        } as unknown as jest.Mocked<Timer>;
        emitTurnUpdate = jest.fn();
    });

    function createPlayer(id: string, name: string, overrides: Partial<Player> = {}): Player {
        return {
            id,
            name,
            speed: testConst.SIX_VALUE,
            hp: testConst.SIX_VALUE,
            maxHp: testConst.SIX_VALUE,
            attack: testConst.FOUR_VALUE,
            defense: testConst.FOUR_VALUE,
            d6target: DiceTarget.Attack,
            d4target: DiceTarget.Defense,
            position: testConst.TILE_POSITION,
            movementPoints: testConst.NO_VALUE,
            actionsLeft: testConst.ONE_VALUE,
            hasAbandoned: false,
            isOrganizer: false,
            turnOrder: testConst.NO_VALUE,
            stats: {
                combatPoints: testConst.NO_VALUE,
                victoryPoints: testConst.NO_VALUE,
                defeatPoints: testConst.NO_VALUE,
                totalLifeLost: testConst.NO_VALUE,
                totalDamageDealt: testConst.NO_VALUE,
                percentageOfTileVisited: testConst.NO_VALUE,
            },
            isVirtual: false,
            ...overrides,
        };
    }

    function createGame(): PlayableGame {
        const game: Game = {
            _id: testConst.GAME_ID,
            name: 'Test',
            description: 'Test',
            minPlayers: testConst.TWO_VALUE,
            maxPlayers: testConst.TWO_VALUE,
            visible: true,
            imageUrl: '',
            date: testConst.GAME_DATE,
            size: testConst.THREE_VALUE,
            gameMode: GameMode.Classic,
            tiles: [[{ tileType: TileType.Basic, mapObject: MapObjectType.None }]],
            shrine: [{
                objectType: MapObjectType.CombatShrine,
                position: [testConst.TILE_POSITION],
                imageUrl: [],
                turnLeftDeactivated: testConst.TWO_VALUE,
            }],
        };

        return {
            _game: game,
            roomId: testConst.ROOM_ID,
            players: [
                createPlayer(testConst.FIRST_PLAYER_ID, testConst.FIRST_PLAYER_NAME, {
                    speed: testConst.SEVEN_VALUE,
                    shrineBuffs: { bonusAmount: testConst.ONE_VALUE, turnsLeft: testConst.ONE_VALUE },
                    attack: testConst.FIVE_VALUE,
                    defense: testConst.FIVE_VALUE,
                }),
                createPlayer(testConst.SECOND_PLAYER_ID, testConst.SECOND_PLAYER_NAME, { speed: testConst.FIVE_VALUE }),
            ],
            turnOrder: [testConst.FIRST_PLAYER_ID, testConst.SECOND_PLAYER_ID],
            currentTurnIndex: testConst.FIRST_INDEX,
            currentPhase: TurnPhase.WaitTurn,
        };
    }

    it('startGameTurn met la partie en WaitTurn sur le premier joueur avec 3 secondes', () => {
        const game = createGame();

        service.startGameTurn(game, timer, emitTurnUpdate);

        expect(game.currentPhase).toBe(TurnPhase.WaitTurn);
        expect(game.currentTurnIndex).toBe(testConst.FIRST_INDEX);
        expect(timer.startTurnTimer).toHaveBeenCalledWith(testConst.ROOM_ID, testConst.TIMER_WAIT_TURN);
        expect(emitTurnUpdate).toHaveBeenCalledWith(
            testConst.ROOM_ID,
            expect.objectContaining({
                phase: TurnPhase.WaitTurn,
                playerId: testConst.FIRST_PLAYER_ID,
            }),
        );
    });

    it('changeTurn passe de WaitTurn a Turn, recharge le mouvement et lance 30 secondes', () => {
        const game = createGame();
        game.currentPhase = TurnPhase.WaitTurn;

        service.changeTurn(game, timer, emitTurnUpdate, jest.fn());

        expect(game.currentPhase).toBe(TurnPhase.Turn);
        expect(game.players[testConst.FIRST_INDEX].movementPoints).toBe(testConst.SEVEN_VALUE);
        expect(timer.startTurnTimer).toHaveBeenCalledWith(testConst.ROOM_ID, TIMER_TURN);
        expect(emitTurnUpdate).toHaveBeenCalledWith(
            testConst.ROOM_ID,
            expect.objectContaining({ phase: TurnPhase.Turn, playerId: testConst.FIRST_PLAYER_ID }),
        );
    });

    it('changeTurn pendant Turn delegue a nextPlayerTurn', () => {
        const game = createGame();
        game.currentPhase = TurnPhase.Turn;
        const spy = jest.spyOn(service, 'nextPlayerTurn');

        service.changeTurn(game, timer, emitTurnUpdate, jest.fn());

        expect(spy).toHaveBeenCalled();
    });

    it('nextPlayerTurn retire les effets temporaires, avance lindex et relance 3 secondes', () => {
        const game = createGame();
        game.currentPhase = TurnPhase.Turn;

        service.nextPlayerTurn(game, timer, emitTurnUpdate);

        expect(timer.stopTimer).toHaveBeenCalledWith(testConst.ROOM_ID);
        expect(game.currentPhase).toBe(TurnPhase.WaitTurn);
        expect(game._game.shrine[testConst.FIRST_INDEX].turnLeftDeactivated).toBe(testConst.ONE_VALUE);
        expect(game.players[testConst.FIRST_INDEX].movementPoints).toBe(testConst.NO_VALUE);
        expect(game.players[testConst.FIRST_INDEX].shrineBuffs).toBeUndefined();
        expect(game.players[testConst.FIRST_INDEX].attack).toBe(testConst.FOUR_VALUE);
        expect(game.players[testConst.FIRST_INDEX].defense).toBe(testConst.FOUR_VALUE);
        expect(emitShrineBuffOff).toHaveBeenCalledWith(testConst.ROOM_ID, testConst.FIRST_PLAYER_ID);
        expect(game.currentTurnIndex).toBe(testConst.SECOND_INDEX);
        expect(timer.startTurnTimer).toHaveBeenCalledWith(testConst.ROOM_ID, TIMER_WAIT_TURN);
        expect(emitTurnUpdate).toHaveBeenCalledWith(
            testConst.ROOM_ID,
            expect.objectContaining({ phase: TurnPhase.WaitTurn, playerId: testConst.SECOND_PLAYER_ID }),
        );
    });
});
