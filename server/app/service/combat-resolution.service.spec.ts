import 'reflect-metadata'; //keep at top

import { PlayableGame } from '@app/interface/game.interface';
import { CombatResolutionService } from '@app/service/combat-resolution.service';
import { CombatRoundService } from '@app/service/combat-round.service';
import { DiceTarget } from '@common/enums/player.enums';
import { BattleWonPayload, CombatPosture, CombatRoundDetails, Game } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';

/**
 * Description:
 * Ce fichier de tests verifie que CombatResolutionService gere correctement
 * la resolution d'un combat, la soumission des postures, les degats,
 * les respawns, la gestion du drapeau et la fin de partie.
 *
 * Fonctionnement:
 * 1) On construit un contexte de jeu minimal avec deux joueurs et un combat actif.
 *
 * 2) On simule les differentes issues d'un round pour valider les mises a jour
 * des joueurs, les payloads retournes et les effets relies au mode de jeu.
 */
const DEFAULT_TILE: TileData = { tileType: TileType.Basic, mapObject: MapObjectType.None };
const ROUND_GRID_SIZE = 4;
const DEFAULT_PLAYER_SPEED = 6;
const DEFAULT_PLAYER_HP = 6;
const DEFAULT_PLAYER_STAT = 4;
const DEFAULT_MOVEMENT_POINTS = 6;
const DEFAULT_ACTIONS_LEFT = 1;
const DEFAULT_DICE_RESULT = 1;
const DEFAULT_ROUND_TOTAL = 5;
const DEFAULT_ROUND_TIME_SECONDS = 10;
const DEFAULT_PAUSED_TURN_SECONDS = 12;
const MINOR_DAMAGE = 2;
const HIGH_DAMAGE = 4;
const LETHAL_DAMAGE = 6;
const VICTORIES_BEFORE_LAST_WIN = 2;
const ATTACKER_SPAWN_POSITION = { x: 0, y: 0 };
const DEFENDER_START_POSITION = { x: 1, y: 0 };
const DEFENDER_SPAWN_POSITION = { x: 3, y: 3 };

describe('CombatResolutionService', () => {
    let combatRoundService: jest.Mocked<CombatRoundService>;
    let service: CombatResolutionService;

    beforeEach(() => {
        combatRoundService = {
            buildCombatRoundDetails: jest.fn(),
        } as unknown as jest.Mocked<CombatRoundService>;

        service = new CombatResolutionService(combatRoundService);
    });

    function createPlayer(id: string, name: string, overrides: Partial<Player> = {}): Player {
        return {
            id,
            name,
            speed: DEFAULT_PLAYER_SPEED,
            hp: DEFAULT_PLAYER_HP,
            maxHp: DEFAULT_PLAYER_HP,
            attack: DEFAULT_PLAYER_STAT,
            defense: DEFAULT_PLAYER_STAT,
            d6target: DiceTarget.Attack,
            d4target: DiceTarget.Defense,
            position: { ...ATTACKER_SPAWN_POSITION },
            movementPoints: DEFAULT_MOVEMENT_POINTS,
            actionsLeft: DEFAULT_ACTIONS_LEFT,
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
            ...overrides,
        };
    }

    function createGame(gameMode = GameMode.Classic): PlayableGame {
        const tiles = Array.from({ length: ROUND_GRID_SIZE }, () =>
            Array.from({ length: ROUND_GRID_SIZE }, () => ({ ...DEFAULT_TILE })),
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
            size: ROUND_GRID_SIZE,
            gameMode,
            tiles,
            shrine: [],
        };

        const attacker = createPlayer('a1', 'Attacker', { position: { ...ATTACKER_SPAWN_POSITION } });
        const defender = createPlayer('d1', 'Defender', { position: { ...DEFENDER_START_POSITION } });

        return {
            _game: game,
            roomId: 'room-1',
            players: [attacker, defender],
            spawnPoints: new Map([
                ['a1', { ...ATTACKER_SPAWN_POSITION }],
                ['d1', { ...DEFENDER_SPAWN_POSITION }],
            ]),
            activeCombat: {
                attackerId: 'a1',
                defenderId: 'd1',
                roundTimeSeconds: DEFAULT_ROUND_TIME_SECONDS,
                pausedTurnRemainingSeconds: DEFAULT_PAUSED_TURN_SECONDS,
                postures: {
                    a1: CombatPosture.None,
                    d1: CombatPosture.None,
                },
            },
        };
    }

    function makeRound(attackerDamageTaken: number, defenderDamageTaken: number): CombatRoundDetails {
        return {
            attacker: {
                playerId: 'a1',
                playerName: 'Attacker',
                attack: { baseValue: DEFAULT_PLAYER_STAT, postureBonus: 0, diceResult: DEFAULT_DICE_RESULT, penalty: 0, total: DEFAULT_ROUND_TOTAL },
                defense: { baseValue: DEFAULT_PLAYER_STAT, postureBonus: 0, diceResult: DEFAULT_DICE_RESULT, penalty: 0, total: DEFAULT_ROUND_TOTAL },
                damageDealt: defenderDamageTaken,
                damageTaken: attackerDamageTaken,
            },
            defender: {
                playerId: 'd1',
                playerName: 'Defender',
                attack: { baseValue: DEFAULT_PLAYER_STAT, postureBonus: 0, diceResult: DEFAULT_DICE_RESULT, penalty: 0, total: DEFAULT_ROUND_TOTAL },
                defense: { baseValue: DEFAULT_PLAYER_STAT, postureBonus: 0, diceResult: DEFAULT_DICE_RESULT, penalty: 0, total: DEFAULT_ROUND_TOTAL },
                damageDealt: attackerDamageTaken,
                damageTaken: defenderDamageTaken,
            },
        };
    }

    it('retourne le contexte seulement pour un participant du combat', () => {
        const game = createGame();

        expect(service.getCombatContext(game, 'a1')).not.toBeNull();
        expect(service.getCombatContext(game, 'd1')).not.toBeNull();
        expect(service.getCombatContext(game, 'x1')).toBeNull();
    });

    it('attend les deux postures avant de résoudre le round', () => {
        const game = createGame();

        const first = service.submitPlayerPosture(game, 'a1', CombatPosture.Offensive);
        expect(first).toBeNull();

        const second = service.submitPlayerPosture(game, 'd1', CombatPosture.Defensive);
        expect(second).toEqual({
            attackerPosture: CombatPosture.Offensive,
            defenderPosture: CombatPosture.Defensive,
        });
    });

    it('naccepte pas quun joueur change sa posture une fois choisie', () => {
        const game = createGame();

        expect(service.submitPlayerPosture(game, 'a1', CombatPosture.Offensive)).toBeNull();
        expect(service.submitPlayerPosture(game, 'a1', CombatPosture.Defensive)).toBeNull();
        expect(game.activeCombat?.postures.a1).toBe(CombatPosture.Offensive);
    });

    it('applique les dégâts simultanément et réinitialise les postures', () => {
        const game = createGame();
        const context = service.getCombatContext(game, 'a1');
        if (!context) throw new Error('Missing context');

        combatRoundService.buildCombatRoundDetails.mockReturnValue(makeRound(MINOR_DAMAGE, HIGH_DAMAGE));

        const round = service.resolveCombatRound(
            context,
            CombatPosture.Offensive,
            CombatPosture.Defensive,
        );

        expect(round.attacker.damageTaken).toBe(MINOR_DAMAGE);
        expect(round.defender.damageTaken).toBe(HIGH_DAMAGE);
        expect(context.attacker.hp).toBe(HIGH_DAMAGE);
        expect(context.defender.hp).toBe(MINOR_DAMAGE);
        expect(game.activeCombat?.postures.a1).toBe(CombatPosture.None);
        expect(game.activeCombat?.postures.d1).toBe(CombatPosture.None);
    });

    it('gère le double KO sans vainqueur', () => {
        const game = createGame();
        const attacker = game.players[0];
        const defender = game.players[1];
        attacker.hp = 0;
        defender.hp = 0;

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(LETHAL_DAMAGE, LETHAL_DAMAGE));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.isGameOver).toBe(false);
        expect(result.payload.winnerId).toBe('');
        expect(result.payload.loserId).toBe('');
        expect(result.payload.doubleKo).toBe(true);
        expect(result.payload.attackerRespawn).toEqual({
            playerId: attacker.id,
            position: ATTACKER_SPAWN_POSITION,
            hp: attacker.maxHp,
        });
        expect(result.payload.defenderRespawn).toEqual({
            playerId: defender.id,
            position: DEFENDER_SPAWN_POSITION,
            hp: defender.maxHp,
        });
        expect(attacker.position).toEqual(ATTACKER_SPAWN_POSITION);
        expect(defender.position).toEqual(DEFENDER_SPAWN_POSITION);
        expect(attacker.hp).toBe(attacker.maxHp);
        expect(defender.hp).toBe(defender.maxHp);
        expect(attacker.stats.victoryPoints).toBe(0);
        expect(defender.stats.victoryPoints).toBe(0);
    });

    it('should resolve a double KO by respawning both players, resetting hp and returning an explicit payload', () => {
        const game = createGame();
        const attacker = game.players.find((player) => player.id === 'a1');
        const defender = game.players.find((player) => player.id === 'd1');

        expect(attacker).toBeDefined();
        expect(defender).toBeDefined();

        if (!attacker || !defender) {
            throw new Error('Missing combat participants');
        }

        attacker.hp = 0;
        defender.hp = 0;

        const payload = service.createBattlePayload(makeRound(LETHAL_DAMAGE, LETHAL_DAMAGE));

        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.isGameOver).toBe(false);
        expect(result.payload.doubleKo).toBe(true);
        expect(result.payload.winnerId).toBe('');
        expect(result.payload.loserId).toBe('');

        expect(result.payload.attackerRespawn?.playerId).toBe(attacker.id);
        expect(result.payload.defenderRespawn?.playerId).toBe(defender.id);

        expect(attacker.hp).toBe(attacker.maxHp);
        expect(defender.hp).toBe(defender.maxHp);
        expect(attacker.position).toEqual(result.payload.attackerRespawn?.position);
        expect(defender.position).toEqual(result.payload.defenderRespawn?.position);
    });

    it('dépose le drapeau en double KO si un participant le transportait en mode CTF', () => {
        const game = createGame(GameMode.CTF);
        const attacker = game.players[0];
        const defender = game.players[1];
        attacker.hp = 0;
        defender.hp = 0;
        defender.hasFlag = true;
        defender.position = { ...DEFENDER_START_POSITION };

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(LETHAL_DAMAGE, LETHAL_DAMAGE));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.flagPayload).toEqual({
            playerId: defender.id,
            flagStatus: false,
            position: DEFENDER_START_POSITION,
        });
        expect(game._game.tiles[0][1].mapObject).toBe(MapObjectType.Flag);
        expect(defender.hasFlag).toBe(false);
    });

    it('donne la victoire, soigne le perdant à son max et le replace au spawn le plus proche', () => {
        const game = createGame();
        const attacker = game.players[0];
        const defender = game.players[1];
        defender.hp = 0;

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(0, LETHAL_DAMAGE));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.payload.winnerId).toBe(attacker.id);
        expect(result.payload.loserId).toBe(defender.id);
        expect(attacker.stats.victoryPoints).toBe(1);
        expect(defender.hp).toBe(defender.maxHp);
        expect(defender.position).toEqual(DEFENDER_SPAWN_POSITION);
        expect(result.payload.loserPos).toEqual(DEFENDER_SPAWN_POSITION);
    });

    it('dépose le drapeau si le perdant le transportait en mode CTF', () => {
        const game = createGame(GameMode.CTF);
        const attacker = game.players[0];
        const defender = game.players[1];
        defender.hp = 0;
        defender.hasFlag = true;
        defender.position = { ...DEFENDER_START_POSITION };

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(0, LETHAL_DAMAGE));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.flagPayload).toEqual({
            playerId: 'd1',
            flagStatus: false,
            position: DEFENDER_START_POSITION,
        });
        expect(game._game.tiles[0][1].mapObject).toBe(MapObjectType.Flag);
        expect(defender.hasFlag).toBe(false);
    });

    it('déclare game over au troisième combat gagné', () => {
        const game = createGame();
        const attacker = game.players[0];
        const defender = game.players[1];
        attacker.stats.victoryPoints = VICTORIES_BEFORE_LAST_WIN;
        defender.hp = 0;

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(0, LETHAL_DAMAGE));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.isGameOver).toBe(true);
        expect(result.payload.winnerId).toBe(attacker.id);
    });

    it('detecte immediatement la fin du combat des quun joueur tombe a 0 PV', () => {
        const attacker = createPlayer('a1', 'Attacker', { hp: 1 });
        const defender = createPlayer('d1', 'Defender', { hp: 2 });

        expect(service.isCombatFinished(attacker, defender)).toBe(false);

        attacker.hp = 0;
        expect(service.isCombatFinished(attacker, defender)).toBe(true);

        attacker.hp = 1;
        defender.hp = 0;
        expect(service.isCombatFinished(attacker, defender)).toBe(true);
    });

    it('replace le perdant sur la case libre la plus proche si son spawn est occupe', () => {
        const game = createGame();
        const attacker = game.players[0];
        const defender = game.players[1];
        const blockingPlayer = createPlayer('b1', 'Blocker', { position: { ...DEFENDER_SPAWN_POSITION } });

        game.players.push(blockingPlayer);
        defender.hp = 0;

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(0, LETHAL_DAMAGE));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.payload.loserPos).toEqual({ x: 3, y: 2 });
        expect(defender.position).toEqual({ x: 3, y: 2 });
        expect(defender.position).not.toEqual(DEFENDER_SPAWN_POSITION);
    });

});
