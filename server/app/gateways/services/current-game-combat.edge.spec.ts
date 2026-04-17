import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { CurrentGameCombatService } from '@app/gateways/services/current-game-combat.service';
import { PlayableGame } from '@app/interface/game.interface';
import { CurrentGamesService } from '@app/service/current-games.service';
import { CombatPosture } from '@common/enums/game.enums';
import { GameMode, MapObjectType, TileType } from '@common/enums/map.enums';
import { Game } from '@common/interfaces/game.interface';
import { TileData } from '@common/interfaces/map.interface';
import type { Socket } from 'socket.io';

/**
 * Description:
 * Ce fichier de tests verifie les cas limites de CurrentGameCombatService
 * pour le demarrage d'un combat et l'abandon en cours de combat.
 *
 * Fonctionnement:
 * 1) On instancie le service avec des mocks de CurrentGamesService
 * et CurrentGameBroadcastService.
 *
 * 2) On simule ensuite des refus de demarrage et des abandons invalides
 * pour verifier que rien n'est diffuse ni repris par erreur.
 */

const DEFAULT_TILE: TileData = { tileType: TileType.Basic, mapObject: MapObjectType.None };
const GRID_SIZE = 3;
const ROUND_TIME_SECONDS = 10;
const ROUND_TIMEOUT_MS = 10000;
const DEFAULT_PAUSED_TURN_SECONDS = 12;

describe('CurrentGameCombatService edge cases', () => {
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
            gameOver: jest.fn(),
            nextPlayerTurn: jest.fn(),
            resumeTurnTimer: jest.fn(),
            submitVirtualPlayerPostures: jest.fn(),
        } as unknown as jest.Mocked<CurrentGamesService>;
        broadcastService = {
            emitCombatStarted: jest.fn(),
            emitCombatRoundDetailsToRoom: jest.fn(),
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

    function createSocket(id = 'a1', roomId = 'room-1'): Socket {
        return {
            id,
            rooms: new Set([id, roomId]),
        } as unknown as Socket;
    }

    function createGameWithCombat(): PlayableGame {
        const tiles = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => ({ ...DEFAULT_TILE })));
        const game: Game = {
            _id: 'g1',
            name: 'Test',
            description: 'Test',
            minPlayers: 2,
            maxPlayers: 2,
            visible: true,
            imageUrl: '',
            date: new Date('2026-01-01'),
            size: GRID_SIZE,
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
                    isVirtual: false,
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
                    isVirtual: false,
                },
            ],
            activeCombat: {
                attackerId: 'a1',
                defenderId: 'd1',
                roundTimeSeconds: ROUND_TIME_SECONDS,
                pausedTurnRemainingSeconds: DEFAULT_PAUSED_TURN_SECONDS,
                postures: {
                    a1: CombatPosture.None,
                    d1: CombatPosture.None,
                },
            },
        };
    }

    it('ne diffuse rien si le serveur refuse de demarrer le combat', () => {
        currentGamesService.startCombat.mockReturnValue(false);

        service.handleStartCombat(createSocket('a1'), {
            attackerId: 'a1',
            defenderId: 'd1',
            roundTimeSeconds: ROUND_TIME_SECONDS,
        });

        expect(broadcastService.emitCombatStarted).not.toHaveBeenCalled();
        jest.advanceTimersByTime(ROUND_TIMEOUT_MS);
        expect(currentGamesService.resolveCombatRoundOnTimeout).not.toHaveBeenCalled();
    });

    it('ignore un abandon si aucun combat nest actif ou si le joueur nest pas implique', () => {
        const noCombatGame = createGameWithCombat();
        noCombatGame.activeCombat = null;

        currentGamesService.getGameByRoomId
            .mockReturnValueOnce(noCombatGame)
            .mockReturnValueOnce(createGameWithCombat());

        expect(service.handleCombatSurrender('room-1', 'a1')).toBeNull();
        expect(service.handleCombatSurrender('room-1', 'x1')).toBeNull();
        expect(broadcastService.emitBattleWon).not.toHaveBeenCalled();
        expect(currentGamesService.resumeTurnTimer).not.toHaveBeenCalled();
        expect(currentGamesService.nextPlayerTurn).not.toHaveBeenCalled();
    });
});
