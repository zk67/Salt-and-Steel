import { Component, computed, effect, HostListener, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Button, ButtonVariant } from '@app/components/game/game-button/game-button.component';
import { PlayerInfoComponent } from '@app/components/game/player-info/player-info.component';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameService } from '@app/services/game/game.service';
import { TimeService } from '@app/services/game/time.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { CombatPosture } from '@common/enums/game.enums';
import { ActiveCombatPayload, CombatRoundDetails, SubmitCombatPosturePayload } from '@common/interfaces/game.interface';
import { GatewayEvents } from '@common/types/gateway.events';

@Component({
    selector: 'app-right-sidebar',
    templateUrl: './right-sidebar.component.html',
    styleUrl: './right-sidebar.component.scss',
    imports: [PlayerInfoComponent, Button],
})
export class RightSidebarComponent {
    private readonly hasSubmittedCombatPosture = signal(false);
    private lastActiveCombat: ActiveCombatPayload | null = null;
    private lastCombatRound: CombatRoundDetails | null = null;
    readonly buttonVariant = ButtonVariant;

    currentTime = computed(() => this.timerService.time());
    isYourTurn = computed(() => this.gameService.activePlayer()?.id === this.gameService.clientPlayer()?.id && !this.gameService.isWaitTurn());
    actionPointsLeft = computed(() => (this.gameService.clientPlayer()?.actionsLeft ?? 0) > 0);
    isHost = computed(() => this.gameService.hostId() === this.gameService.clientPlayer()?.id);
    isDebugMode = computed(() => this.gameService.isDebugMode());
    combatRound = this.gameService.currentCombatRound;
    activeCombat = this.gameService.activeCombat;
    isClientInActiveCombat = this.gameService.isClientInActiveCombat;
    isCombatPostureSelectionDisabled = computed(() => this.hasSubmittedCombatPosture());

    constructor(private timerService: TimeService, private gameService: GameService,
        private socketService: SocketClientService, private router: Router) {
        effect(() => {
            const activeCombat = this.activeCombat();
            const combatRound = this.combatRound();

            if (activeCombat !== this.lastActiveCombat || combatRound !== this.lastCombatRound) {
                this.hasSubmittedCombatPosture.set(false);
                this.lastActiveCombat = activeCombat;
                this.lastCombatRound = combatRound;
            }
        });
    }

    @HostListener('window:beforeunload')
    onBeforeUnload(): void {
        this.socketService.send(GatewayEvents.Surrender);
    }

    @HostListener('window:popstate')
    onPopState(): void {
        this.onSurrender();
    }

    onAction = () => {
        if (this.isCombatActive()) {
            return;
        }
        if (this.isYourTurn() && this.actionPointsLeft()) {
            this.gameService.changeActionMode();
        }
    };

    onEndTurn = () => {
        if (this.isCombatActive()) {
            return;
        }
        if (this.isYourTurn() || (this.isDebugMode() && this.isHost())) {
            this.socketService.send(GatewayEvents.EndTurnEarly);
        }
    };

    onSurrender = () => {
        this.socketService.send(GatewayEvents.Surrender);
        this.gameService.clearGameService();
        this.router.navigate([APP_ROUTES.home]);
    };

    formatModifier(value: number): string {
        return value > 0 ? `+${value}` : `${value}`;
    }

    onChooseOffensivePosture(): void {
        this.submitCombatPosture(CombatPosture.Offensive);
    }

    onChooseDefensivePosture(): void {
        this.submitCombatPosture(CombatPosture.Defensive);
    }

    private submitCombatPosture(posture: CombatPosture): void {
        if (this.hasSubmittedCombatPosture()) {
            return;
        }

        this.hasSubmittedCombatPosture.set(true);
        this.socketService.send(GatewayEvents.SubmitCombatPosture, {
            posture,
        } as SubmitCombatPosturePayload);
    }

    isCombatActive = computed(() => !!this.gameService.activeCombat());
    displayedTime = computed(() => {
        if (this.isCombatActive() && !this.isClientInActiveCombat()) {
            return '--';
        }

        return `${this.currentTime()}s`;
    });
}
