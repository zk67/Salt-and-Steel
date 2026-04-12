import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { PopupService } from './popup.service';

const NOTIFICATION_DURATION_MS = 3000;
const ONE_MILLISECOND = 1;

describe('PopupService', () => {
    let service: PopupService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [PopupService],
        });

        service = TestBed.inject(PopupService);
    });

    afterEach(() => TestBed.resetTestingModule());

    it('auto-close une notification apres la duree demandee', fakeAsync(() => {
        service.openNotification('Combat termine', NOTIFICATION_DURATION_MS);

        expect(service.notificationShow()).toBeTrue();
        expect(service.notificationMessage()).toBe('Combat termine');

        tick(NOTIFICATION_DURATION_MS - ONE_MILLISECOND);
        expect(service.notificationShow()).toBeTrue();

        tick(ONE_MILLISECOND);
        expect(service.notificationShow()).toBeFalse();
        expect(service.notificationMessage()).toBe('');
    }));

    it('garde la notification fermee quand le joueur la masque avant le timeout', fakeAsync(() => {
        service.openNotification('Combat termine', NOTIFICATION_DURATION_MS);

        service.closeNotification();
        tick(NOTIFICATION_DURATION_MS);

        expect(service.notificationShow()).toBeFalse();
        expect(service.notificationMessage()).toBe('');
    }));
});
