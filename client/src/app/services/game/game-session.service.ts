import { Injectable, signal } from '@angular/core';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { Game } from '@common/interfaces/game.interface';

@Injectable({
    providedIn: 'root',
})
export class GameSessionService {
    readonly isDebugMode = signal<boolean>(false);
    readonly hostId = signal<string | null>(null);

    private selectedJoinRoomId: string | null = null;
    private selectedHostGame: Game | null = null;
    private chatMessages: ChatMessage[] = [];
    private gameLogMessages: ChatMessage[] = [];
    private gameTimer: number | null = null;

    setChatMessages(messages: ChatMessage[]): void {
        this.chatMessages = [...messages];
    }

    getChatMessages(): ChatMessage[] {
        return [...this.chatMessages];
    }

    clearChatMessages(): void {
        this.chatMessages = [];
    }

    setGameLogMessages(messages: ChatMessage[]): void {
        this.gameLogMessages = [...messages];
    }

    getGameLogMessages(): ChatMessage[] {
        return [...this.gameLogMessages];
    }

    clearGameLogMessages(): void {
        this.gameLogMessages = [];
    }

    setHostId(hostId: string): void {
        this.hostId.set(hostId);
    }

    toggleDebugMode(): void {
        this.isDebugMode.update((value) => !value);
    }

    setDebugMode(debugMode: boolean): void {
        this.isDebugMode.set(debugMode);
    }

    setSelectedJoinRoomId(roomId: string): void {
        this.selectedJoinRoomId = roomId;
    }

    getSelectedJoinRoomId(): string | null {
        return this.selectedJoinRoomId;
    }

    clearSelectedJoinRoomId(): void {
        this.selectedJoinRoomId = null;
    }

    setSelectedHostGame(game: Game): void {
        this.selectedHostGame = game;
    }

    getSelectedHostGame(): Game | null {
        return this.selectedHostGame;
    }

    clearSelectedHostGame(): void {
        this.selectedHostGame = null;
    }

    setGameTimer(timer: number): void {
        this.gameTimer = timer;
    }

    getGameTimer(): number | null {
        return this.gameTimer;
    }

    clear(): void {
        this.clearChatMessages();
        this.clearGameLogMessages();
        this.clearSelectedJoinRoomId();
        this.clearSelectedHostGame();
        this.isDebugMode.set(false);
        this.hostId.set(null);
    }
}
