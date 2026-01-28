import { Component } from '@angular/core';
import { ToolsSidebarComponent } from '@app/components/tools-sidebar/tools-sidebar.component';
import { MapEditorComponent } from '@app/components/map/map-editor.component';

@Component({
    selector: 'app-edition-page',
    templateUrl: './edition-page.component.html',
    styleUrls: ['./edition-page.component.scss'],
    standalone: true,
    imports: [ToolsSidebarComponent, MapEditorComponent],
})
export class EditionPageComponent {}
