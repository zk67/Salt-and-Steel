import 'reflect-metadata'; //keep at top

import { PlayableGame } from '@app/interface/game.interface';
import { CombatResolutionService } from '@app/service/combat-resolution.service';
import { CombatRoundService } from '@app/service/combat-round.service';
import { DiceTarget } from '@common/enums/player.enums';
import { BattleWonPayload, CombatPosture, CombatRoundDetails, Game } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';


const BASIC_TILE: TileData = { tileType: TileType.Basic, mapObject: MapObjectType.None };
const QUATRE = 4;
const SIX = 6;

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
            speed: 6,
            hp: 6,
            maxHp: 6,
            attack: 4,
            defense: 4,
            d6target: DiceTarget.Attack,
            d4target: DiceTarget.Defense,
            position: { x: 0, y: 0 },
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
            ...overrides,
        };
    }

    function createGame(gameMode = GameMode.Classic): PlayableGame {
        const tiles = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({ ...BASIC_TILE })));
        const game: Game = {
            _id: 'g1',
            name: 'Test',
            description: 'Test',
            minPlayers: 2,
            maxPlayers: 2,
            visible: true,
            imageUrl: '',
            date: new Date('2026-01-01'),
            size: 4,
            gameMode,
            tiles,
            shrine: [],
        };

        const attacker = createPlayer('a1', 'Attacker', { position: { x: 0, y: 0 } });
        const defender = createPlayer('d1', 'Defender', { position: { x: 1, y: 0 } });

        return {
            _game: game,
            roomId: 'room-1',
            players: [attacker, defender],
            spawnPoints: new Map([
                ['a1', { x: 0, y: 0 }],
                ['d1', { x: 3, y: 3 }],
            ]),
            activeCombat: {
                attackerId: 'a1',
                defenderId: 'd1',
                roundTimeSeconds: 10,
                pausedTurnRemainingSeconds: 12,
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
                attack: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
                defense: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
                damageDealt: defenderDamageTaken,
                damageTaken: attackerDamageTaken,
            },
            defender: {
                playerId: 'd1',
                playerName: 'Defender',
                attack: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
                defense: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
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

    it('applique les dégâts simultanément et réinitialise les postures', () => {
        const game = createGame();
        const context = service.getCombatContext(game, 'a1');
        if (!context) throw new Error('Missing context');

        combatRoundService.buildCombatRoundDetails.mockReturnValue(makeRound(2, QUATRE));

        const round = service.resolveCombatRound(
            context,
            CombatPosture.Offensive,
            CombatPosture.Defensive,
        );

        expect(round.attacker.damageTaken).toBe(2);
        expect(round.defender.damageTaken).toBe(QUATRE);
        expect(context.attacker.hp).toBe(QUATRE);
        expect(context.defender.hp).toBe(2);
        expect(game.activeCombat?.postures.a1).toBe(CombatPosture.None);
        expect(game.activeCombat?.postures.d1).toBe(CombatPosture.None);
    });

    it('gère le double KO sans vainqueur', () => {
        const game = createGame();
        const attacker = game.players[0];
        const defender = game.players[1];
        attacker.hp = 0;
        defender.hp = 0;

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(SIX, SIX));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.isGameOver).toBe(false);
        expect(result.payload.winnerId).toBe('');
        expect(result.payload.loserId).toBe('');
        expect(result.payload.doubleKo).toBe(true);
        expect(result.payload.attackerRespawn).toEqual({
            playerId: attacker.id,
            position: { x: 0, y: 0 },
            hp: attacker.maxHp,
        });
        expect(result.payload.defenderRespawn).toEqual({
            playerId: defender.id,
            position: { x: 3, y: 3 },
            hp: defender.maxHp,
        });
        expect(attacker.position).toEqual({ x: 0, y: 0 });
        expect(defender.position).toEqual({ x: 3, y: 3 });
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

        const payload = service.createBattlePayload(makeRound(SIX, SIX));

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
        defender.position = { x: 1, y: 0 };

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(SIX, SIX));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.flagPayload).toEqual({
            playerId: defender.id,
            flagStatus: false,
            position: { x: 1, y: 0 },
        });
        expect(game._game.tiles[0][1].mapObject).toBe(MapObjectType.Flag);
        expect(defender.hasFlag).toBe(false);
    });

    it('donne la victoire, soigne le perdant à son max et le replace au spawn le plus proche', () => {
        const game = createGame();
        const attacker = game.players[0];
        const defender = game.players[1];
        defender.hp = 0;

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(0, SIX));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.payload.winnerId).toBe(attacker.id);
        expect(result.payload.loserId).toBe(defender.id);
        expect(attacker.stats.victoryPoints).toBe(1);
        expect(defender.hp).toBe(defender.maxHp);
        expect(defender.position).toEqual({ x: 3, y: 3 });
        expect(result.payload.loserPos).toEqual({ x: 3, y: 3 });
    });

    it('dépose le drapeau si le perdant le transportait en mode CTF', () => {
        const game = createGame(GameMode.CTF);
        const attacker = game.players[0];
        const defender = game.players[1];
        defender.hp = 0;
        defender.hasFlag = true;
        defender.position = { x: 1, y: 0 };

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(0, SIX));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.flagPayload).toEqual({
            playerId: 'd1',
            flagStatus: false,
            position: { x: 1, y: 0 },
        });
        expect(game._game.tiles[0][1].mapObject).toBe(MapObjectType.Flag);
        expect(defender.hasFlag).toBe(false);
    });

    it('déclare game over au troisième combat gagné', () => {
        const game = createGame();
        const attacker = game.players[0];
        const defender = game.players[1];
        attacker.stats.victoryPoints = 2;
        defender.hp = 0;

        const payload: BattleWonPayload = service.createBattlePayload(makeRound(0, SIX));
        const result = service.finalizeCombatAfterRound(game, payload, attacker, defender);

        expect(result.isGameOver).toBe(true);
        expect(result.payload.winnerId).toBe(attacker.id);
    });

});
