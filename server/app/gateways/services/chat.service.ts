import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
    private readonly playerNamesById = new Map<string, string>();

    setPlayerName(playerId: string | undefined, playerName: string | undefined): void {
        const id = playerId?.trim();
        const name = playerName?.trim();
        if (!id || !name) return;
        this.playerNamesById.set(id, name);
    }

    getPlayerName(playerId: string | undefined): string | undefined {
        const id = playerId?.trim();
        if (!id) return undefined;
        return this.playerNamesById.get(id);
    }

    removePlayer(playerId: string | undefined): void {
        const id = playerId?.trim();
        if (!id) return;
        this.playerNamesById.delete(id);
    }
}
