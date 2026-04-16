import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameService } from '@app/services/game/game.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { ChatMessage } from '@common/interfaces/chat.message.interface';
import { GatewayEvents } from '@common/types/gateway.events';

@Component({
    selector: 'app-chat',
    imports: [CommonModule, FormsModule],
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements AfterViewChecked, OnInit, OnDestroy {
    readonly messages = signal<ChatMessage[]>([]);
    readonly playerName = signal<string>('');
    readonly currentPlayerId = signal<string>('');
    @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

    private messageCount = this.messages().length;

    constructor(private gameService: GameService, private socketService: SocketClientService) {}

    ngOnInit(): void {
        this.socketService.on(GatewayEvents.Message, this.addMessage);
        this.messages.set(this.gameService.getChatMessages());
        const currentPlayer = this.gameService.clientPlayer();
        if (currentPlayer) {
            this.playerName.set(currentPlayer.name);
            this.currentPlayerId.set(currentPlayer.id);
        }
    }

    ngOnDestroy(): void {
        this.socketService.off(GatewayEvents.Message, this.addMessage);
    }

    ngAfterViewChecked(): void {
        const messages = this.messages();
        if (messages.length === 0) return;

        if (this.isOwnMessage(messages[messages.length - 1]) && messages.length > this.messageCount) {
            this.messageCount = messages.length;
            this.scrollToBottom();
        }
    }

    private scrollToBottom(): void {
        const messagesContainer = this.messagesContainer?.nativeElement;
        if (!messagesContainer) return;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    newMessage = '';
    readonly maxLength = 200;

    charsLeft(): number {
        return this.maxLength - this.newMessage.length;
    }

    isOwnMessage(message: ChatMessage): boolean {
        if (message.playerId === this.currentPlayerId())
            return true;
        return false;
    }

    sendMessage(): void {
        const content = this.newMessage.trim();
        if (!content) return;

        this.socketService.sendMessage(content);
        this.newMessage = '';
    }

    private addMessage = (msg: ChatMessage) => {
        this.messages.update((messages) => [...messages, msg]);
        this.gameService.setChatMessages(this.messages());
    };

    onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.sendMessage();
        }
    }
}