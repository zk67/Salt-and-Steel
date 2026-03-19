import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatMessage } from '@common/interfaces/chat.message.interface';

@Component({
    selector: 'app-chat',
    imports: [CommonModule, FormsModule],
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements AfterViewChecked {
    private _messages: ChatMessage[] = [];
    private _playerName: string = '';
    private _currentPlayerId: string = '';
    @Output() messageSent = new EventEmitter<string>();
    @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

    private messageCount = this.messages.length;

    @Input()
    set messages(messages: ChatMessage[]) {
        this._messages = messages;
    }

    @Input()
    set playerName(playerName: string) {
        this._playerName = playerName;
    }

    @Input()
    set currentPlayerId(currentPlayerId: string) {
        this._currentPlayerId = currentPlayerId;
    }

    get messages(): ChatMessage[] {
        return this._messages;
    }

    get playerName(): string {
        return this._playerName;
    }

    get currentPlayerId(): string {
        return this._currentPlayerId;
    }

    ngAfterViewChecked(): void {
        if (this.messages.length === 0) return;

        if (this.isOwnMessage(this.messages[this.messages.length - 1]) && this.messages.length > this.messageCount) {
            this.messageCount = this.messages.length;
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
        if (message.playerId === this.currentPlayerId)
            return true;
        return false;
    }

    sendMessage(): void {
        const content = this.newMessage.trim();
        if (!content) return;

        this.messageSent.emit(content);
        this.newMessage = '';
    }

    onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.sendMessage();
        }
    }
}