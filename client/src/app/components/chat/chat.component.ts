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
    @Input() messages: ChatMessage[] = [];
    @Input() playerName: string = '';
    @Input() currentPlayerId: string = '';
    @Output() messageSent = new EventEmitter<string>();
    @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

    private messageCount = this.messages.length;

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