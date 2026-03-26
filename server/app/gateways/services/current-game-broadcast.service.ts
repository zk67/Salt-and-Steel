import { BattleWonPayload, DebugMovePayload, GameInfoPayload, MovePlayerPayload, ToggleDebugPayload } from '@common/interfaces/game.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { Position } from '@common/utils/map.utils';
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class CurrentGameBroadcastService {
    private server: Server | null = null;

    setServer(server: Server): void {
        this.server = server;
    }

    emitNewTurn(roomId: string, payload: unknown): void {
        this.server?.to(roomId).emit(GatewayEvents.NewTurn, payload);
    }

    emitPlayerMoved(roomId: string, payload: MovePlayerPayload): void {
        this.server?.to(roomId).emit(GatewayEvents.PlayerMoved, payload);
    }

    emitGameStartInfo(roomId: string, payload: GameInfoPayload): void {
        this.server?.to(roomId).emit(GatewayEvents.GameStartInfo, payload);
    }

    emitPlayers(roomId: string, players: unknown): void {
        this.server?.to(roomId).emit(GatewayEvents.PlayersToGame, players);
    }

    emitJoinableGames(joinableGames: unknown): void {
        this.server?.emit(GatewayEvents.JoinableGames, joinableGames);
    }

    emitDebugMove(roomId: string, payload: DebugMovePayload): void {
        this.server?.to(roomId).emit(GatewayEvents.HandleClickDebug, payload);
    }

    emitBattleWon(roomId: string, payload: BattleWonPayload): void {
        this.server?.to(roomId).emit(GatewayEvents.HandleBattleWon, payload);
    }

    emitGameOver(roomId: string, winnerId: string): void {
        this.server?.to(roomId).emit(GatewayEvents.GameOver, { winnerId });
    }

    emitGameClosed(roomId: string): void {
        this.server?.to(roomId).emit(GatewayEvents.GameClosed);
    }

    emitRemovePlayer(roomId: string, playerId: string): void {
        this.server?.to(roomId).emit(GatewayEvents.RemovePlayer, { playerId });
    }

    emitKicked(playerId: string): void {
        this.server?.to(playerId).emit(GatewayEvents.Kicked);
    }

    emitUnavailableAvatars(roomId: string, avatars: string[]): void {
        this.server?.to(roomId).emit(GatewayEvents.UnavailableAvatars, avatars);
    }

    emitToggleDebugMode(roomId: string, payload?: ToggleDebugPayload): void {
        this.server?.to(roomId).emit(GatewayEvents.HandleToggleDebugMode, payload);
    }

    emitActionOnTile(roomId: string, position: Position, playerId: string): void {
        this.server?.to(roomId).emit(GatewayEvents.ActionOnTile, { position, playerId });
    }
}
