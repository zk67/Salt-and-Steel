import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { CurrentGameCombatService } from '@app/gateways/services/current-game-combat.service';
import { PlayableGame } from '@app/interface/game.interface';
import { CurrentGamesService, SubmitCombatPostureResult } from '@app/service/current-games.service';
import { CombatPosture, CombatRoundDetails, Game } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';
import type { Socket } from 'socket.io';

const DOUZE = 12;
const DIX_MILLE = 10000;
const NEUF = 9;
const TROIS = 3;
const NEUF_MILLE = 9000;
const NEUF_CENT_QUATRE_VINGT_DIX_NEUF = 999;
const NEUF_MILLE_UN = 9001;

describe('CurrentGameCombatService', () => {
    let currentGamesService: jest.Mocked<CurrentGamesService>;
    let broadcastService: jest.Mocked<CurrentGameBroadcastService>;
    let service: CurrentGameCombatService;

    beforeEach(() => {
        jest.useFakeTimers();

        currentGamesService = {
            startCombat: jest.fn(),
            getGameByRoomId: jest.fn(),
            submitCombatPosture: jest.fn(),
            resolveCombatRoundOnTimeout: jest.fn(),
            nextPlayerTurn: jest.fn(),
            resumeTurnTimer: jest.fn(),
        } as unknown as jest.Mocked<CurrentGamesService>;

        broadcastService = {
            emitCombatStarted: jest.fn(),
            emitCombatRoundDetails: jest.fn(),
            emitBattleWon: jest.fn(),
            emitGameOver: jest.fn(),
        } as unknown as jest.Mocked<CurrentGameBroadcastService>;

        service = new CurrentGameCombatService(currentGamesService, broadcastService);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    function createGameWithCombat(pausedTurnRemainingSeconds = DOUZE): PlayableGame {
        const tiles = Array.from({ length: 3 }, () =>
            Array.from(
                { length: 3 },
                () =>
                    ({
                        tileType: TileType.Basic,
                        mapObject: MapObjectType.None,
                    }) as TileData,
            ),
        );

        const game: Game = {
            _id: 'g1',
            name: 'Test',
            description: 'Test',
            minPlayers: 2,
            maxPlayers: 2,
            visible: true,
            imageUrl: '',
            date: new Date('2026-01-01'),
            size: 3,
            gameMode: GameMode.Classic,
            tiles,
            shrine: [],
        };

        return {
            _game: game,
            roomId: 'room-1',
            players: [
                {
                    id: 'a1',
                    name: 'Attacker',
                    speed: 6,
                    hp: 6,
                    maxHp: 6,
                    attack: 4,
                    defense: 4,
                    d6target: null,
                    d4target: null,
                    position: { x: 0, y: 0 },
                    movementPoints: 3,
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
                },
                {
                    id: 'd1',
                    name: 'Defender',
                    speed: 6,
                    hp: 6,
                    maxHp: 6,
                    attack: 4,
                    defense: 4,
                    d6target: null,
                    d4target: null,
                    position: { x: 1, y: 0 },
                    movementPoints: 6,
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
                },
            ],
            activeCombat: {
                attackerId: 'a1',
                defenderId: 'd1',
                roundTimeSeconds: 10,
                pausedTurnRemainingSeconds,
                postures: {
                    a1: CombatPosture.None,
                    d1: CombatPosture.None,
                },
            },
        };
    }

    function createRound(): CombatRoundDetails {
        return {
            attacker: {
                playerId: 'a1',
                playerName: 'Attacker',
                attack: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
                defense: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
                damageDealt: 1,
                damageTaken: 0,
            },
            defender: {
                playerId: 'd1',
                playerName: 'Defender',
                attack: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
                defense: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
                damageDealt: 0,
                damageTaken: 1,
            },
        };
    }

    function createSocket(id = 'a1', roomId = 'room-1'): Socket {
        return {
            id,
            rooms: new Set([id, roomId]),
        } as unknown as Socket;
    }

    it('démarre un combat, programme le timeout de 10 secondes et émet CombatStarted', () => {
        currentGamesService.startCombat.mockReturnValue(true);
        currentGamesService.getGameByRoomId.mockReturnValue(createGameWithCombat());
        currentGamesService.resolveCombatRoundOnTimeout.mockReturnValue({
            roundResolved: true,
            combatRound: createRound(),
            isGameOver: false,
        });

        service.handleStartCombat(createSocket('a1'), {
            attackerId: 'a1',
            defenderId: 'd1',
            roundTimeSeconds: 10,
        });

        expect(broadcastService.emitCombatStarted).toHaveBeenCalledWith(
            ['a1', 'd1'],
            { attackerId: 'a1', defenderId: 'd1', roundTimeSeconds: 10 },
        );

        jest.advanceTimersByTime(DIX_MILLE);

        expect(currentGamesService.resolveCombatRoundOnTimeout).toHaveBeenCalledWith('room-1');
        expect(broadcastService.emitCombatRoundDetails).toHaveBeenCalled();
    });

    it('annule le timeout du round courant puis programme immédiatement celui du round suivant', () => {
        const game = createGameWithCombat();
        currentGamesService.startCombat.mockReturnValue(true);
        currentGamesService.getGameByRoomId.mockReturnValue(game);

        currentGamesService.submitCombatPosture.mockReturnValue({
            roundResolved: true,
            combatRound: createRound(),
            isGameOver: false,
        });

        currentGamesService.resolveCombatRoundOnTimeout.mockReturnValue({
            roundResolved: true,
            combatRound: createRound(),
            isGameOver: false,
        });

        service.handleStartCombat(createSocket('a1'), {
            attackerId: 'a1',
            defenderId: 'd1',
            roundTimeSeconds: 10,
        });

        expect(broadcastService.emitCombatStarted).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(NEUF_MILLE);

        service.handleSubmitCombatPosture(createSocket('a1'), {
            posture: CombatPosture.Offensive,
        });

        // Le round courant est résolu immédiatement
        expect(broadcastService.emitCombatRoundDetails).toHaveBeenCalledTimes(1);
        expect(broadcastService.emitCombatStarted).toHaveBeenCalledTimes(2);

        // L'ancien timeout aurait expiré ici s'il n'avait pas été annulé
        jest.advanceTimersByTime(NEUF_CENT_QUATRE_VINGT_DIX_NEUF);
        expect(currentGamesService.resolveCombatRoundOnTimeout).toHaveBeenCalledTimes(0);

        // Le nouveau round a bien son propre timeout
        jest.advanceTimersByTime(NEUF_MILLE_UN);
        expect(currentGamesService.resolveCombatRoundOnTimeout).toHaveBeenCalledTimes(1);

        // Et comme le mock dit encore "roundResolved: true" + "isGameOver: false",
        // un autre round repart immédiatement
        expect(broadcastService.emitCombatStarted).toHaveBeenCalledTimes(TROIS);
    });

    it('quand un round se termine sans vainqueur, relance un nouveau CombatStarted pour le round suivant', () => {
        const game = createGameWithCombat();
        currentGamesService.getGameByRoomId.mockReturnValue(game);

        const result: SubmitCombatPostureResult = {
            roundResolved: true,
            combatRound: createRound(),
            isGameOver: false,
        };
        currentGamesService.submitCombatPosture.mockReturnValue(result);

        service.handleSubmitCombatPosture(createSocket('a1'), {
            posture: CombatPosture.Offensive,
        });

        expect(broadcastService.emitCombatRoundDetails).toHaveBeenCalledWith(['a1', 'd1'], result.combatRound);
        expect(broadcastService.emitCombatStarted).toHaveBeenCalledWith(
            ['a1', 'd1'],
            { attackerId: 'a1', defenderId: 'd1', roundTimeSeconds: 10 },
        );
    });

    it('quand le combat se termine sans game over et sans reprise du tour, passe au joueur suivant', () => {
        const result: SubmitCombatPostureResult = {
            roundResolved: true,
            combatRound: createRound(),
            isGameOver: false,
            shouldAdvanceTurn: true,
            battlePayload: {
                winnerId: 'd1',
                loserId: 'a1',
                winnerHp: 3,
                loserHp: 6,
                loserPos: { x: 2, y: 2 },
                combatRound: createRound(),
            },
        };
        currentGamesService.submitCombatPosture.mockReturnValue(result);
        currentGamesService.getGameByRoomId.mockReturnValue(createGameWithCombat());

        service.handleSubmitCombatPosture(createSocket('a1'), {
            posture: CombatPosture.Offensive,
        });

        expect(broadcastService.emitBattleWon).toHaveBeenCalledWith('room-1', {
            winnerId: 'd1',
            loserId: 'a1',
            winnerHp: 3,
            loserHp: 6,
            loserPos: { x: 2, y: 2 },
        });
        expect(currentGamesService.nextPlayerTurn).toHaveBeenCalledWith('room-1');
    });

    it('quand le combat finit en double KO, diffuse le payload puis passe au joueur suivant', () => {
        const result: SubmitCombatPostureResult = {
            roundResolved: true,
            combatRound: createRound(),
            isGameOver: false,
            shouldAdvanceTurn: true,
            battlePayload: {
                winnerId: '',
                loserId: '',
                winnerHp: 0,
                loserHp: 0,
                loserPos: { x: 0, y: 0 },
                doubleKo: true,
                attackerRespawn: {
                    playerId: 'a1',
                    position: { x: 0, y: 0 },
                    hp: 6,
                },
                defenderRespawn: {
                    playerId: 'd1',
                    position: { x: 2, y: 2 },
                    hp: 6,
                },
                combatRound: createRound(),
            },
        };
        currentGamesService.submitCombatPosture.mockReturnValue(result);
        currentGamesService.getGameByRoomId.mockReturnValue(createGameWithCombat());

        service.handleSubmitCombatPosture(createSocket('a1'), {
            posture: CombatPosture.Offensive,
        });

        expect(broadcastService.emitBattleWon).toHaveBeenCalledWith('room-1', {
            winnerId: '',
            loserId: '',
            winnerHp: 0,
            loserHp: 0,
            loserPos: { x: 0, y: 0 },
            doubleKo: true,
            attackerRespawn: {
                playerId: 'a1',
                position: { x: 0, y: 0 },
                hp: 6,
            },
            defenderRespawn: {
                playerId: 'd1',
                position: { x: 2, y: 2 },
                hp: 6,
            },
        });
        expect(currentGamesService.nextPlayerTurn).toHaveBeenCalledWith('room-1');
        expect(broadcastService.emitGameOver).not.toHaveBeenCalled();
    });

    it('quand le combat termine la partie, émet GameOver et ne change pas le tour', () => {
        const result: SubmitCombatPostureResult = {
            roundResolved: true,
            combatRound: createRound(),
            isGameOver: true,
            battlePayload: {
                winnerId: 'a1',
                loserId: 'd1',
                winnerHp: 4,
                loserHp: 6,
                loserPos: { x: 2, y: 2 },
                combatRound: createRound(),
            },
        };
        currentGamesService.submitCombatPosture.mockReturnValue(result);
        currentGamesService.getGameByRoomId.mockReturnValue(createGameWithCombat());

        service.handleSubmitCombatPosture(createSocket('a1'), {
            posture: CombatPosture.Offensive,
        });

        expect(broadcastService.emitGameOver).toHaveBeenCalledWith('room-1', 'a1');
        expect(currentGamesService.nextPlayerTurn).not.toHaveBeenCalled();
    });

    it('si le défenseur abandonne, linstigateur reprend son timer restant', () => {
        const game = createGameWithCombat(NEUF);
        currentGamesService.getGameByRoomId.mockReturnValue(game);

        service.handleCombatSurrender('room-1', 'd1');

        expect(currentGamesService.resumeTurnTimer).toHaveBeenCalledWith('room-1', NEUF);
        expect(currentGamesService.nextPlayerTurn).not.toHaveBeenCalled();
        expect(broadcastService.emitBattleWon).toHaveBeenCalled();
    });

    it('si linstigateur abandonne, le tour passe au joueur suivant', () => {
        const game = createGameWithCombat(NEUF);
        currentGamesService.getGameByRoomId.mockReturnValue(game);

        service.handleCombatSurrender('room-1', 'a1');

        expect(currentGamesService.nextPlayerTurn).toHaveBeenCalledWith('room-1');
        expect(currentGamesService.resumeTurnTimer).not.toHaveBeenCalled();
        expect(broadcastService.emitBattleWon).toHaveBeenCalled();
    });
});
