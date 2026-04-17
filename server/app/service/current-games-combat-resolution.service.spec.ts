import 'reflect-metadata';

import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { PlayableGame } from '@app/interface/game.interface';
import { CurrentGamesCombatService } from '@app/service/current-games-combat-resolution.service';
import { Timer } from '@app/utils/game-timer';
import { DiceTarget } from '@common/enums/player.enums';
import { CombatPosture, Game } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { COMBAT_TIMER } from '@common/types/player.constants';

/**
 * Description:
 * Ce fichier de tests verifie que CurrentGamesCombatService demarre un combat
 * seulement dans les conditions valides et initialise correctement l'etat
 * de combat cote serveur.
 *
 * Fonctionnement:
 * 1) On construit une partie minimale avec deux joueurs, un ordre de tour
 * explicite et un timer mocke pour controler le temps restant.
 *
 * 2) On valide ensuite les cas nominaux et les cas limites de demarrage:
 * joueur actif adjacent, joueur non actif, cible non adjacente et pause du timer.
 */

const DEFAULT_TILE: TileData = { tileType: TileType.Basic, mapObject: MapObjectType.None };
const GRID_SIZE = 4;
const PAUSED_TURN_SECONDS = 12;

describe('CurrentGamesCombatService', () => {
    let broadcastService: jest.Mocked<CurrentGameBroadcastService>;
    let timer: jest.Mocked<Timer>;
    let service: CurrentGamesCombatService;

    beforeEach(() => {
        broadcastService = {
            emitUpdateFlag: jest.fn(),
        } as unknown as jest.Mocked<CurrentGameBroadcastService>;
        timer = {
            getCurrentTime: jest.fn().mockReturnValue(PAUSED_TURN_SECONDS),
            stopTimer: jest.fn(),
            startTurnTimer: jest.fn(),
        } as unknown as jest.Mocked<Timer>;

        service = new CurrentGamesCombatService(broadcastService, timer);
    });

    function createPlayer(id: string, name: string, x: number, y: number): Player {
        return {
            id,
            name,
            speed: 6,
            hp: 6,
            maxHp: 6,
            attack: 4,
            defense: 4,
            d6target: DiceTarget.Attack,
            d4target: DiceTarget.Defense,
            position: { x, y },
            movementPoints: 6,
            actionsLeft: 1,
            hasAbandoned: false,
            isOrganizer: false,
            turnOrder: 0,
            hasFlag: false,
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

    function createGame(attackerPosition = { x: 0, y: 0 }, defenderPosition = { x: 1, y: 0 }): PlayableGame {
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
                createPlayer('a1', 'Attacker', attackerPosition.x, attackerPosition.y),
                createPlayer('d1', 'Defender', defenderPosition.x, defenderPosition.y),
            ],
            turnOrder: ['a1', 'd1'],
            currentTurnIndex: 0,
            activeCombat: null,
        };
    }

    it('demarre un combat quand le joueur actif cible un joueur adjacent', () => {
        const game = createGame();

        const started = service.startCombat(game, 'a1', 'd1');

        expect(started).toBe(true);
        expect(timer.getCurrentTime).toHaveBeenCalledWith('room-1');
        expect(timer.stopTimer).toHaveBeenCalledWith('room-1');
        expect(game.activeCombat).toEqual({
            attackerId: 'a1',
            defenderId: 'd1',
            roundTimeSeconds: COMBAT_TIMER,
            pausedTurnRemainingSeconds: PAUSED_TURN_SECONDS,
            postures: {
                a1: CombatPosture.None,
                d1: CombatPosture.None,
            },
        });
    });

    it('refuse de demarrer un combat si la cible nest pas adjacente', () => {
        const game = createGame({ x: 0, y: 0 }, { x: 3, y: 3 });

        const started = service.startCombat(game, 'a1', 'd1');

        expect(started).toBe(false);
        expect(timer.stopTimer).not.toHaveBeenCalled();
        expect(game.activeCombat).toBeNull();
    });

    it('refuse de demarrer un combat si lattaquant nest pas le joueur actif', () => {
        const game = createGame();
        game.currentTurnIndex = 1;

        const started = service.startCombat(game, 'a1', 'd1');

        expect(started).toBe(false);
        expect(timer.stopTimer).not.toHaveBeenCalled();
        expect(game.activeCombat).toBeNull();
    });

    it('refuse de demarrer un second combat quand un combat est deja actif', () => {
        const game = createGame();
        game.activeCombat = {
            attackerId: 'a1',
            defenderId: 'd1',
            roundTimeSeconds: COMBAT_TIMER,
            pausedTurnRemainingSeconds: PAUSED_TURN_SECONDS,
            postures: {
                a1: CombatPosture.None,
                d1: CombatPosture.None,
            },
        };

        const started = service.startCombat(game, 'a1', 'd1');

        expect(started).toBe(false);
        expect(timer.stopTimer).not.toHaveBeenCalled();
    });
});
