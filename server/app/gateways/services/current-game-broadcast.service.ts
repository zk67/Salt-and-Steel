import {
    ActionOnTilePayload, ActiveCombatPayload, BattleWonPayload, CombatRoundDetails, DebugMovePayload, GameInfoPayload,
    GameOverPayload, MovePlayerPayload, PassFlagPayload, ToggleDebugPayload, UpdateFlagPayload,
} from '@common/interfaces/game.interface';
import { GameMode } from '@common/enums/map.enums';
import { GatewayEvents } from '@common/types/gateway.events';
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

    emitCombatRoundDetails(playerIds: string[], payload: CombatRoundDetails): void {
        const uniquePlayerIds = [...new Set(playerIds)];

        for (const playerId of uniquePlayerIds) {
            this.server?.to(playerId).emit(GatewayEvents.HandleCombatRound, payload);
        }
    }

    emitCombatRoundDetailsToRoom(roomId: string, payload: CombatRoundDetails): void {
        this.server?.to(roomId).emit(GatewayEvents.HandleCombatRound, payload);
    }

    emitGameOver(roomId: string, payload: GameOverPayload | string): void {
        this.server?.to(roomId).emit(GatewayEvents.GameOver, payload);
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

    emitActionOnTile(roomId: string, payload: ActionOnTilePayload): void {
        this.server?.to(roomId).emit(GatewayEvents.ActionOnTile, payload);
    }

    emitCombatStarted(roomId: string, payload: ActiveCombatPayload): void {
        this.server?.to(roomId).emit(GatewayEvents.CombatStarted, payload);
    }

    emitShrineBuffOff(roomId: string, playerId: string): void {
        this.server?.to(roomId).emit(GatewayEvents.ShrineBuffOff, playerId);
    }

    emitGameMode(roomId: string, gameMode: GameMode, maxPlayers: number): void {
        this.server?.to(roomId).emit(GatewayEvents.GetGameModes, { gameMode, maxPlayers });
    }

    emitHandlePassFlag(roomId: string, payload: PassFlagPayload): void {
        this.server?.to(roomId).emit(GatewayEvents.HandlePassFlag, payload);
    }

    emitUpdateFlag(roomId: string, payload: UpdateFlagPayload): void {
        this.server?.to(roomId).emit(GatewayEvents.HandleUpdateFlag, payload);
    }
}
