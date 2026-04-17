import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { GameService } from '@app/services/game/game.service';
import { MapService } from '@app/services/map/map.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { DiceTarget } from '@common/enums/player.enums';
import { MapObjectType, TileType } from '@common/enums/map.enums';
import { CombatRoundDetails } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { JournalDeJeuComponent } from './journal-de-jeu.component';

/**
 * Description:
 * Ce fichier de tests verifie que JournalDeJeuComponent journalise correctement
 * les details d'un round de combat et les messages de fin de partie.
 *
 * Fonctionnement:
 * 1) On initialise le composant avec des mocks de socket, de partie et de carte,
 * puis on recupere les callbacks enregistres sur les evenements socket.
 *
 * 2) On declenche ensuite les evenements de combat et de fin de partie
 * pour verifier que les messages ajoutes sont detailles, coherents et
 * sauvegardes dans le journal local du jeu.
 */

type SocketClientServiceMock = {
    on: jasmine.Spy;
    off: jasmine.Spy;
};

type GameServiceMock = {
    activePlayer: ReturnType<typeof signal<Player | null>>;
    clientPlayer: ReturnType<typeof signal<Player | null>>;
    getPlayers: jasmine.Spy;
    setGameLogMessages: jasmine.Spy;
    getGameLogMessages: jasmine.Spy;
};

type MapServiceMock = {
    getTile: jasmine.Spy;
};

const EXPECTED_COMBAT_MESSAGES = 4;

describe('JournalDeJeuComponent', () => {
    let component: JournalDeJeuComponent;
    let fixture: ComponentFixture<JournalDeJeuComponent>;
    let socketService: SocketClientServiceMock;
    let gameService: GameServiceMock;

    beforeEach(async () => {
        socketService = createSocketClientServiceMock();
        gameService = createGameServiceMock();

        await TestBed.configureTestingModule({
            imports: [JournalDeJeuComponent],
            providers: [
                { provide: SocketClientService, useValue: socketService },
                { provide: GameService, useValue: gameService },
                { provide: MapService, useValue: createMapServiceMock() },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(JournalDeJeuComponent);
        component = fixture.componentInstance;
        component.ngOnInit();
    });

    afterEach(() => {
        component.ngOnDestroy();
        TestBed.resetTestingModule();
    });

    it('journalise les valeurs detaillees du round et les differences de scores pour le joueur local', fakeAsync(() => {
        const attacker = createPlayer('a1', 'Attacker');
        const defender = createPlayer('d1', 'Defender');

        gameService.clientPlayer.set(attacker);
        gameService.getPlayers.and.returnValue([attacker, defender]);

        getSocketCallback<CombatRoundDetails>(socketService.on, GatewayEvents.HandleCombatRound)(createCombatRoundDetails());
        tick();

        const contents = component.messages().map((message) => normalizeText(message.content));
        expect(contents.length).toBe(EXPECTED_COMBAT_MESSAGES);
        expect(contents[0]).toContain('valeur de base = 4');
        expect(contents[0]).toContain('bonus de posture = 2');
        expect(contents[0]).toContain('resultat de de = 6');
        expect(contents[0]).toContain('malus = -2');
        expect(contents[0]).toContain('total = 10');
        expect(contents[2]).toContain('Difference entre ton attaque et la defense de Defender : 3');
        expect(contents[2]).toContain('degats infliges');
        expect(contents[3]).toContain('Difference entre l\'attaque de Defender et ta defense : 5');
        expect(contents[3]).toContain('degats subis');
        expect(gameService.setGameLogMessages).toHaveBeenCalledTimes(EXPECTED_COMBAT_MESSAGES);
    }));

    it('annonce le gagnant a tous dans le journal quand la partie se termine', fakeAsync(() => {
        const winner = createPlayer('a1', 'Attacker');
        const other = createPlayer('d1', 'Defender');

        gameService.getPlayers.and.returnValue([winner, other]);

        getSocketCallback<{ winnerId: string }>(socketService.on, GatewayEvents.GameOver)({ winnerId: winner.id });
        tick();

        const lastMessage = normalizeText(component.messages().at(-1)?.content);
        expect(lastMessage).toContain('Le jeu est termine');
        expect(lastMessage).toContain('Attacker');
        expect(lastMessage).toContain('Defender');
    }));
});

function createSocketClientServiceMock(): SocketClientServiceMock {
    return {
        on: jasmine.createSpy('on'),
        off: jasmine.createSpy('off'),
    };
}

function createGameServiceMock(): GameServiceMock {
    return {
        activePlayer: signal<Player | null>(null),
        clientPlayer: signal<Player | null>(null),
        getPlayers: jasmine.createSpy('getPlayers').and.returnValue([]),
        setGameLogMessages: jasmine.createSpy('setGameLogMessages'),
        getGameLogMessages: jasmine.createSpy('getGameLogMessages').and.returnValue([]),
    };
}

function createMapServiceMock(): MapServiceMock {
    return {
        getTile: jasmine.createSpy('getTile').and.returnValue({ tileType: TileType.Basic, mapObject: MapObjectType.None }),
    };
}

function createPlayer(id: string, name: string): Player {
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
    };
}

function createCombatRoundDetails(): CombatRoundDetails {
    return {
        attacker: {
            playerId: 'a1',
            playerName: 'Attacker',
            attack: { baseValue: 4, postureBonus: 2, diceResult: 6, penalty: -2, total: 10 },
            defense: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: -2, total: 3 },
            damageDealt: 3,
            damageTaken: 2,
        },
        defender: {
            playerId: 'd1',
            playerName: 'Defender',
            attack: { baseValue: 4, postureBonus: 0, diceResult: 5, penalty: 0, total: 8 },
            defense: { baseValue: 4, postureBonus: 2, diceResult: 1, penalty: 0, total: 7 },
            damageDealt: 2,
            damageTaken: 3,
        },
    };
}

function getSocketCallback<T>(spy: jasmine.Spy, eventName: string): (payload: T) => void {
    const call = spy.calls.all().find((currentCall) => currentCall.args[0] === eventName);
    return call?.args[1] as (payload: T) => void;
}

function normalizeText(value: string | null | undefined): string {
    return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
