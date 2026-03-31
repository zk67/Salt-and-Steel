import { Injectable, inject } from '@angular/core';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ActiveCombatPayload, BattleWonPayload, CombatRoundDetails, GameInfoPayload, NewTurnPayload } from '@common/interfaces/game.interface';
import { GatewayEvents } from '@common/types/gateway.events';

type GameSocketHandlers = {
    onPlayerRemoved: (payload: { playerId: string }) => void;
    onGameStarted: (payload: GameInfoPayload) => void;
    onBattleWon: (payload: BattleWonPayload) => void;
    onNewTurn: (payload: NewTurnPayload) => void;
    onCombatRound: (payload: CombatRoundDetails) => void;
    onCombatStarted: (payload: ActiveCombatPayload) => void;
};

@Injectable({
    providedIn: 'root',
})
export class GameSocketEventsService {
    private readonly socketService = inject(SocketClientService);

    registerHandlers(handlers: GameSocketHandlers): void {
        this.socketService.on<{ playerId: string }>(GatewayEvents.RemovePlayer, handlers.onPlayerRemoved);
        this.socketService.on<GameInfoPayload>(GatewayEvents.GameStartInfo, handlers.onGameStarted);
        this.socketService.on<BattleWonPayload>(GatewayEvents.HandleBattleWon, handlers.onBattleWon);
        this.socketService.on<NewTurnPayload>(GatewayEvents.NewTurn, handlers.onNewTurn);
        this.socketService.on<CombatRoundDetails>(GatewayEvents.HandleCombatRound, handlers.onCombatRound);
        this.socketService.on<ActiveCombatPayload>(GatewayEvents.CombatStarted, handlers.onCombatStarted);
    }
}
