import { Component } from '@angular/core';
import { ChatComponent } from '@app/components/chat/chat.component';
import { JournalDeJeuComponent } from '@app/components/journal-de-jeu/journal-de-jeu.component';

@Component({
  selector: 'app-zone-de-message',
  imports: [JournalDeJeuComponent, ChatComponent],
  templateUrl: './zone-de-message.component.html',
  styleUrl: './zone-de-message.component.scss',
})
export class ZoneDeMessageComponent {
  activeTab: string = 'journal';

  setTab(tab: string) {
    this.activeTab = tab;
  }
}
