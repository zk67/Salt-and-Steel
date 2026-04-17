import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { TimeService } from '@app/services/game/time.service';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { DiceTarget } from '@common/enums/player.enums';
import { ActiveCombatPayload, CombatPosture, CombatRoundDetails } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { signal } from '@angular/core';
import { RightSidebarComponent } from './right-sidebar.component';

/**
 * Description:
 * Ce fichier de tests verifie que RightSidebarComponent affiche correctement
 * l'interface de combat, les details du round et les controles de posture
 * selon le contexte du joueur local.
 *
 * Fonctionnement:
 * 1) On instancie le composant avec des mocks simples de GameService,
 * TimeService, SocketClientService et Router.
 *
 * 2) On fait varier les signaux de combat et du joueur local pour verifier
 * l'affichage conditionnel, les valeurs rendues dans le DOM et les actions
 * envoyees au serveur quand un joueur choisit une posture.
 */

type GameServiceMock = {
    activePlayer: ReturnType<typeof signal<Player | null>>;
    clientPlayer: ReturnType<typeof signal<Player | null>>;
    isWaitTurn: ReturnType<typeof signal<boolean>>;
    hostId: ReturnType<typeof signal<string | null>>;
    isDebugMode: ReturnType<typeof signal<boolean>>;
    currentCombatRound: ReturnType<typeof signal<CombatRoundDetails | null>>;
    activeCombat: ReturnType<typeof signal<ActiveCombatPayload | null>>;
    isClientInActiveCombat: () => boolean;
    changeActionMode: jasmine.Spy;
    clearGameService: jasmine.Spy;
};

type TimeServiceMock = {
    time: ReturnType<typeof signal<number>>;
};

type SocketClientServiceMock = {
    send: jasmine.Spy;
};

const DISPLAYED_TIME_SECONDS = 9;

describe('RightSidebarComponent', () => {
    let fixture: ComponentFixture<RightSidebarComponent>;
    let gameService: GameServiceMock;
    let socketService: SocketClientServiceMock;
    let router: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        gameService = createGameServiceMock();
        socketService = createSocketClientServiceMock();
        router = jasmine.createSpyObj<Router>('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [RightSidebarComponent],
            providers: [
                { provide: GameService, useValue: gameService },
                { provide: TimeService, useValue: createTimeServiceMock() },
                { provide: SocketClientService, useValue: socketService },
                { provide: Router, useValue: router },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(RightSidebarComponent);
    });

    it('affiche les boutons de posture seulement pour le joueur implique dans le combat', () => {
        const client = createPlayer('a1', 'Client');
        const rival = createPlayer('d1', 'Rival');

        gameService.clientPlayer.set(client);
        gameService.activePlayer.set(client);
        gameService.activeCombat.set(createActiveCombatPayload(client.id, rival.id));

        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('.combat-posture-panel'))).toBeTruthy();

        gameService.clientPlayer.set(createPlayer('obs', 'Observer'));
        fixture.detectChanges();

        expect(fixture.debugElement.query(By.css('.combat-posture-panel'))).toBeNull();
    });

    it('masque le compte a rebours des observateurs pendant un combat', () => {
        const observer = createPlayer('obs', 'Observer');

        gameService.clientPlayer.set(observer);
        gameService.activePlayer.set(observer);
        gameService.activeCombat.set(createActiveCombatPayload('a1', 'd1'));

        fixture.detectChanges();

        const timeDisplay = fixture.debugElement.query(By.css('.time-display')).nativeElement as HTMLDivElement;
        expect(timeDisplay.textContent?.trim()).toBe('--');
    });

    it('affiche les details complets du round pour les deux combattants', () => {
        gameService.clientPlayer.set(createPlayer('a1', 'Client'));
        gameService.currentCombatRound.set(createCombatRoundDetails());

        fixture.detectChanges();

        const text = normalizeText(fixture.nativeElement.textContent);
        expect(text).toContain('Resultats du combat');
        expect(text).toContain('Attacker');
        expect(text).toContain('Defender');
        expect(text).toContain('Base 4');
        expect(text).toContain('Posture +2');
        expect(text).toContain('De 6');
        expect(text).toContain('Penalite -2');
        expect(text).toContain('Total 10');
        expect(text).toContain('Degats infliges : 3');
        expect(text).toContain('Degats infliges : 1');
    });

    it('envoie la posture choisie une seule fois et reactive le choix au round suivant', () => {
        const client = createPlayer('a1', 'Client');
        const rival = createPlayer('d1', 'Rival');

        gameService.clientPlayer.set(client);
        gameService.activePlayer.set(client);
        gameService.activeCombat.set(createActiveCombatPayload(client.id, rival.id));
        fixture.detectChanges();

        const buttons = fixture.debugElement.queryAll(By.css('.combat-posture-actions button'));
        const offensiveButton = buttons[0].nativeElement as HTMLButtonElement;
        const defensiveButton = buttons[1].nativeElement as HTMLButtonElement;

        offensiveButton.click();
        fixture.detectChanges();

        expect(socketService.send).toHaveBeenCalledWith(GatewayEvents.SubmitCombatPosture, {
            posture: CombatPosture.Offensive,
        });
        expect(offensiveButton.disabled).toBeTrue();
        expect(defensiveButton.disabled).toBeTrue();

        offensiveButton.click();
        expect(socketService.send).toHaveBeenCalledTimes(1);

        gameService.currentCombatRound.set(createCombatRoundDetails());
        fixture.detectChanges();

        expect((fixture.debugElement.queryAll(By.css('.combat-posture-actions button'))[0].nativeElement as HTMLButtonElement).disabled).toBeFalse();
    });
});

function createGameServiceMock(): GameServiceMock {
    const activePlayer = signal<Player | null>(null);
    const clientPlayer = signal<Player | null>(null);
    const activeCombat = signal<ActiveCombatPayload | null>(null);

    return {
        activePlayer,
        clientPlayer,
        isWaitTurn: signal(false),
        hostId: signal('host'),
        isDebugMode: signal(false),
        currentCombatRound: signal<CombatRoundDetails | null>(null),
        activeCombat,
        isClientInActiveCombat: () => {
            const combat = activeCombat();
            const playerId = clientPlayer()?.id;
            return !!combat && !!playerId && (combat.attackerId === playerId || combat.defenderId === playerId);
        },
        changeActionMode: jasmine.createSpy('changeActionMode'),
        clearGameService: jasmine.createSpy('clearGameService'),
    };
}

function createTimeServiceMock(): TimeServiceMock {
    return {
        time: signal(DISPLAYED_TIME_SECONDS),
    };
}

function createSocketClientServiceMock(): SocketClientServiceMock {
    return {
        send: jasmine.createSpy('send'),
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

function createActiveCombatPayload(attackerId: string, defenderId: string): ActiveCombatPayload {
    return {
        attackerId,
        defenderId,
        roundTimeSeconds: 10,
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
            damageTaken: 1,
        },
        defender: {
            playerId: 'd1',
            playerName: 'Defender',
            attack: { baseValue: 4, postureBonus: 0, diceResult: 1, penalty: 0, total: 5 },
            defense: { baseValue: 4, postureBonus: 2, diceResult: 1, penalty: 0, total: 7 },
            damageDealt: 1,
            damageTaken: 3,
        },
    };
}

function normalizeText(value: string | null | undefined): string {
    return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
