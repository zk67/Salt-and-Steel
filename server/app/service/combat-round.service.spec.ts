import { PlayableGame } from '@app/interface/game.interface';
import { DiceTarget } from '@common/enums/player.enums';
import { CombatPosture } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { CombatRoundService } from './combat-round.service';

const DICE_6 = 6;
const DICE_4 = 4;

describe('CombatRoundService', () => {
    let service: CombatRoundService;

    beforeEach(() => {
        service = new CombatRoundService();
    });

    function createPlayer(id: string, name: string): Player {
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

    function createGame(debugMode: boolean): PlayableGame {
        return {
            roomId: 'room-1',
            players: [],
            debugMode,
            _game: {
                name: 'test',
                description: 'test',
                minPlayers: 2,
                maxPlayers: 2,
                visible: true,
                imageUrl: '',
                date: new Date(),
                size: 10,
                gameMode: GameMode.Classic,
                shrine: [],
                tiles: [[{ tileType: TileType.Basic, mapObject: MapObjectType.None }]],
            },
        };
    }

    it('should force max dice for attacker and min dice for defender when debug mode is active', () => {
        const game = createGame(true);
        const attacker = createPlayer('a1', 'Attacker');
        const defender = createPlayer('d1', 'Defender');

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

    it('should use random dice when debug mode is inactive', () => {
        const game = createGame(false);
        const attacker = createPlayer('a1', 'Attacker');
        const defender = createPlayer('d1', 'Defender');

        jest.spyOn(Math, 'random').mockReturnValue(0);

        const round = service.buildCombatRoundDetails(
            game,
            attacker,
            defender,
            CombatPosture.None,
            CombatPosture.None,
        );

        expect(round.attacker.attack.diceResult).toBe(1);
        expect(round.attacker.defense.diceResult).toBe(1);
        expect(round.defender.attack.diceResult).toBe(1);
        expect(round.defender.defense.diceResult).toBe(1);

        jest.restoreAllMocks();
    });

    it('should change behavior dynamically between rounds when debug mode is toggled on', () => {
        const game = createGame(false);
        const attacker = createPlayer('a1', 'Attacker');
        const defender = createPlayer('d1', 'Defender');

        jest.spyOn(Math, 'random').mockReturnValue(0);

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

        jest.restoreAllMocks();
    });
});