import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-popup',
  template: `
    @if (show) {
      <div class="popup-overlay">
        <div class="popup">
          <ng-content></ng-content>
        </div>
      </div>
    }
  `,
  styleUrls: ['./popup.component.scss'],
})
export class PopupComponent {
  @Input() show: boolean = false;
}
