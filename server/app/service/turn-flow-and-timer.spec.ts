import { PlayableGame } from '@app/interface/game.interface';
import { CurrentGamesService } from '@app/service/current-games.service';
import { TurnFlowService } from '@app/service/turn-flow.service';
import { Timer } from '@app/utils/game-timer';
import { DiceTarget } from '@common/enums/player.enums';
import { Game, TurnPhase } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';

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
const ONE_SECOND_MS = 1000;
const TWO_SECONDS_MS = 2000;
const FIVE_SECONDS_MS = 5000;
const NO_VALUE = 0;
const FIRST_INDEX = 0;
const SECOND_INDEX = 1;
const ONE_VALUE = 1;
const TWO_VALUE = 2;
const THREE_VALUE = 3;
const FOUR_VALUE = 4;
const FIVE_VALUE = 5;
const SIX_VALUE = 6;
const SEVEN_VALUE = 7;
const TEN_VALUE = 10;
const THIRTY_VALUE = 30;
const ROOM_ID = 'room-1';
const GAME_ID = 'g1';
const FIRST_PLAYER_ID = 'p1';
const SECOND_PLAYER_ID = 'p2';
const FIRST_PLAYER_NAME = 'P1';
const SECOND_PLAYER_NAME = 'P2';
const GAME_DATE = new Date('2026-01-01');
const TILE_POSITION = { x: NO_VALUE, y: NO_VALUE };

describe('Timer', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('decremente chaque seconde puis appelle changeTurn a lexpiration', () => {
        jest.useFakeTimers();
        const currentGamesService = { changeTurn: jest.fn() } as unknown as CurrentGamesService;
        const timer = new Timer(currentGamesService);

        timer.startTurnTimer(ROOM_ID, THREE_VALUE);

        jest.advanceTimersByTime(ONE_SECOND_MS);
        expect(timer.getCurrentTime(ROOM_ID)).toBe(TWO_VALUE);

        jest.advanceTimersByTime(ONE_SECOND_MS);
        expect(timer.getCurrentTime(ROOM_ID)).toBe(ONE_VALUE);

        jest.advanceTimersByTime(TWO_SECONDS_MS);
        expect(currentGamesService.changeTurn).toHaveBeenCalledWith(ROOM_ID);
    });

    it('stopTimer annule le timeout logique et empeche le passage de tour', () => {
        jest.useFakeTimers();
        const currentGamesService = { changeTurn: jest.fn() } as unknown as CurrentGamesService;
        const timer = new Timer(currentGamesService);

        timer.startTurnTimer(ROOM_ID, THREE_VALUE);
        timer.stopTimer(ROOM_ID);
        jest.advanceTimersByTime(FIVE_SECONDS_MS);

        expect(currentGamesService.changeTurn).not.toHaveBeenCalled();
        expect(timer.getCurrentTime(ROOM_ID)).toBe(NO_VALUE);
    });

    it('ignore un second startTurnTimer si un timer existe deja pour la room', () => {
        jest.useFakeTimers();
        const currentGamesService = { changeTurn: jest.fn() } as unknown as CurrentGamesService;
        const timer = new Timer(currentGamesService);

        timer.startTurnTimer(ROOM_ID, THIRTY_VALUE);
        timer.startTurnTimer(ROOM_ID, TEN_VALUE);

        jest.advanceTimersByTime(ONE_SECOND_MS);
        expect(timer.getCurrentTime(ROOM_ID)).toBe(THIRTY_VALUE - ONE_VALUE);
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
            speed: SIX_VALUE,
            hp: SIX_VALUE,
            maxHp: SIX_VALUE,
            attack: FOUR_VALUE,
            defense: FOUR_VALUE,
            d6target: DiceTarget.Attack,
            d4target: DiceTarget.Defense,
            position: TILE_POSITION,
            movementPoints: NO_VALUE,
            actionsLeft: ONE_VALUE,
            hasAbandoned: false,
            isOrganizer: false,
            turnOrder: NO_VALUE,
            stats: {
                combatPoints: NO_VALUE,
                victoryPoints: NO_VALUE,
                defeatPoints: NO_VALUE,
                totalLifeLost: NO_VALUE,
                totalDamageDealt: NO_VALUE,
                percentageOfTileVisited: NO_VALUE,
            },
            isVirtual: false,
            ...overrides,
        };
    }

    function createGame(): PlayableGame {
        const game: Game = {
            _id: GAME_ID,
            name: 'Test',
            description: 'Test',
            minPlayers: TWO_VALUE,
            maxPlayers: TWO_VALUE,
            visible: true,
            imageUrl: '',
            date: GAME_DATE,
            size: THREE_VALUE,
            gameMode: GameMode.Classic,
            tiles: [[{ tileType: TileType.Basic, mapObject: MapObjectType.None }]],
            shrine: [{
                objectType: MapObjectType.CombatShrine,
                position: [TILE_POSITION],
                imageUrl: [],
                turnLeftDeactivated: TWO_VALUE,
            }],
        };

        return {
            _game: game,
            roomId: ROOM_ID,
            players: [
                createPlayer(FIRST_PLAYER_ID, FIRST_PLAYER_NAME, {
                    speed: SEVEN_VALUE,
                    shrineBuffs: { bonusAmount: ONE_VALUE, turnsLeft: ONE_VALUE },
                    attack: FIVE_VALUE,
                    defense: FIVE_VALUE,
                }),
                createPlayer(SECOND_PLAYER_ID, SECOND_PLAYER_NAME, { speed: FIVE_VALUE }),
            ],
            turnOrder: [FIRST_PLAYER_ID, SECOND_PLAYER_ID],
            currentTurnIndex: FIRST_INDEX,
            currentPhase: TurnPhase.WaitTurn,
        };
    }

    it('startGameTurn met la partie en WaitTurn sur le premier joueur avec 3 secondes', () => {
        const game = createGame();

        service.startGameTurn(game, timer, emitTurnUpdate);

        expect(game.currentPhase).toBe(TurnPhase.WaitTurn);
        expect(game.currentTurnIndex).toBe(FIRST_INDEX);
        expect(timer.startTurnTimer).toHaveBeenCalledWith(ROOM_ID, TIMER_WAIT_TURN);
        expect(emitTurnUpdate).toHaveBeenCalledWith(
            ROOM_ID,
            expect.objectContaining({
                phase: TurnPhase.WaitTurn,
                playerId: FIRST_PLAYER_ID,
            }),
        );
    });

    it('changeTurn passe de WaitTurn a Turn, recharge le mouvement et lance 30 secondes', () => {
        const game = createGame();
        game.currentPhase = TurnPhase.WaitTurn;

        service.changeTurn(game, timer, emitTurnUpdate, jest.fn());

        expect(game.currentPhase).toBe(TurnPhase.Turn);
        expect(game.players[FIRST_INDEX].movementPoints).toBe(SEVEN_VALUE);
        expect(timer.startTurnTimer).toHaveBeenCalledWith(ROOM_ID, TIMER_TURN);
        expect(emitTurnUpdate).toHaveBeenCalledWith(
            ROOM_ID,
            expect.objectContaining({ phase: TurnPhase.Turn, playerId: FIRST_PLAYER_ID }),
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

        expect(timer.stopTimer).toHaveBeenCalledWith(ROOM_ID);
        expect(game.currentPhase).toBe(TurnPhase.WaitTurn);
        expect(game._game.shrine[FIRST_INDEX].turnLeftDeactivated).toBe(ONE_VALUE);
        expect(game.players[FIRST_INDEX].movementPoints).toBe(NO_VALUE);
        expect(game.players[FIRST_INDEX].shrineBuffs).toBeUndefined();
        expect(game.players[FIRST_INDEX].attack).toBe(FOUR_VALUE);
        expect(game.players[FIRST_INDEX].defense).toBe(FOUR_VALUE);
        expect(emitShrineBuffOff).toHaveBeenCalledWith(ROOM_ID, FIRST_PLAYER_ID);
        expect(game.currentTurnIndex).toBe(SECOND_INDEX);
        expect(timer.startTurnTimer).toHaveBeenCalledWith(ROOM_ID, TIMER_WAIT_TURN);
        expect(emitTurnUpdate).toHaveBeenCalledWith(
            ROOM_ID,
            expect.objectContaining({ phase: TurnPhase.WaitTurn, playerId: SECOND_PLAYER_ID }),
        );
    });
});
