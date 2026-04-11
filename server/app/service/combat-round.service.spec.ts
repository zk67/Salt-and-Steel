import { PlayableGame } from '@app/interface/game.interface';
import { CombatRoundService } from '@app/service/combat-round.service';
import { DiceTarget } from '@common/enums/player.enums';
import { CombatPosture, Game } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';

const BASIC_TILE: TileData = { tileType: TileType.Basic, mapObject: MapObjectType.None };
const DICE_6 = 6;
const DICE_4 = 4;
const PENALTY = -2;
const TROIS = 3;
const DIX = 10;
const CINQ_5 = 5;
const MOITIE = 0.5;
const TROIS_QUART = 0.75;


describe('CombatRoundService', () => {
    let service: CombatRoundService;

    beforeEach(() => {
        service = new CombatRoundService();
        jest.restoreAllMocks();
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
            position: { x: 1, y: 1 },
            movementPoints: 6,
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
            ...overrides,
        };
    }

    function createGame(debugMode = false, attackerTileType = TileType.Basic, defenderTileType = TileType.Basic): PlayableGame {
        const tiles = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({ ...BASIC_TILE })));
        tiles[1][1] = { tileType: attackerTileType, mapObject: MapObjectType.None };
        tiles[1][2] = { tileType: defenderTileType, mapObject: MapObjectType.None };

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
            players: [],
            debugMode,
        };
    }

    it('calcule correctement attaque, défense, posture et dégâts', () => {
        const game = createGame(false);
        const attacker = createPlayer('a1', 'Attacker');
        const defender = createPlayer('d1', 'Defender', { position: { x: 2, y: 1 } });

        jest.spyOn(Math, 'random')
            .mockReturnValueOnce(MOITIE) // D6 -> 4
            .mockReturnValueOnce(0.0) // D4 -> 1
            .mockReturnValueOnce(0.0) // D6 -> 1
            .mockReturnValueOnce(TROIS_QUART); // D4 -> 4

        const round = service.buildCombatRoundDetails(
            game,
            attacker,
            defender,
            CombatPosture.Offensive,
            CombatPosture.Defensive,
        );

        expect(round.attacker.attack.total).toBe(DIX); // 4 + 2 + 4
        expect(round.attacker.defense.total).toBe(CINQ_5); // 4 + 1
        expect(round.defender.attack.total).toBe(CINQ_5); // 4 + 1
        expect(round.defender.defense.total).toBe(DIX); // 4 + 2 + 4
        expect(round.attacker.damageDealt).toBe(0);
        expect(round.defender.damageDealt).toBe(0);
    });

    it('applique le malus de glace de -2 sur attaque et défense', () => {
        const game = createGame(false, TileType.Ice, TileType.Basic);
        const attacker = createPlayer('a1', 'Attacker');
        const defender = createPlayer('d1', 'Defender', { position: { x: 2, y: 1 } });

        jest.spyOn(Math, 'random')
            .mockReturnValueOnce(0.0) // atk d6 -> 1
            .mockReturnValueOnce(0.0) // atk d4 -> 1
            .mockReturnValueOnce(0.0) // def d6 -> 1
            .mockReturnValueOnce(0.0); // def d4 -> 1

        const round = service.buildCombatRoundDetails(
            game,
            attacker,
            defender,
            CombatPosture.None,
            CombatPosture.None,
        );

        expect(round.attacker.attack.penalty).toBe(PENALTY);
        expect(round.attacker.defense.penalty).toBe(PENALTY);
        expect(round.attacker.attack.total).toBe(TROIS); // 4 + 1 - 2
        expect(round.attacker.defense.total).toBe(TROIS); // 4 + 1 - 2
    });

    it('force les dés à max/min quand le debug est actif', () => {
        const game = createGame(true);
        const attacker = createPlayer('a1', 'Instigator');
        const defender = createPlayer('d1', 'Defender', { position: { x: 2, y: 1 } });

        const round = service.buildCombatRoundDetails(
            game,
            attacker,
            defender,
            CombatPosture.None,
            CombatPosture.None,
        );

        expect(round.attacker.attack.diceResult).toBe(DICE_6);
        expect(round.attacker.defense.diceResult).toBe(DICE_4);
        expect(round.defender.attack.diceResult).toBe(1);
        expect(round.defender.defense.diceResult).toBe(1);
    });

    it('change dynamiquement entre deux rounds si le debug est activé pendant le combat', () => {
        const game = createGame(false);
        const attacker = createPlayer('a1', 'Instigator');
        const defender = createPlayer('d1', 'Defender', { position: { x: 2, y: 1 } });

        jest.spyOn(Math, 'random')
            .mockReturnValueOnce(0.0)
            .mockReturnValueOnce(0.0)
            .mockReturnValueOnce(0.0)
            .mockReturnValueOnce(0.0);

        const round1 = service.buildCombatRoundDetails(
            game,
            attacker,
            defender,
            CombatPosture.None,
            CombatPosture.None,
        );

        expect(round1.attacker.attack.diceResult).toBe(1);
        expect(round1.defender.attack.diceResult).toBe(1);

        game.debugMode = true;

        const round2 = service.buildCombatRoundDetails(
            game,
            attacker,
            defender,
            CombatPosture.None,
            CombatPosture.None,
        );

        expect(round2.attacker.attack.diceResult).toBe(DICE_6);
        expect(round2.attacker.defense.diceResult).toBe(DICE_4);
        expect(round2.defender.attack.diceResult).toBe(1);
        expect(round2.defender.defense.diceResult).toBe(1);
    });

    it('retourne 0 si aucun dé nest assigné à la stat ciblée', () => {
        const game = createGame(false);
        const attacker = createPlayer('a1', 'NoDice', {
            d6target: null,
            d4target: null,
        });
        const defender = createPlayer('d1', 'Defender', { position: { x: 2, y: 1 } });

        const round = service.buildCombatRoundDetails(
            game,
            attacker,
            defender,
            CombatPosture.None,
            CombatPosture.None,
        );

        expect(round.attacker.attack.diceResult).toBe(0);
        expect(round.attacker.defense.diceResult).toBe(0);
    });
});
