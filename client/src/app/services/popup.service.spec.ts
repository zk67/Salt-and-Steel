import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NOTIFICATION_DURATION_MS, ONE_MILLISECOND } from '@common/types/tests.constant';
import { PopupService } from './popup.service';

/**
 * Description:
 * Ce fichier de tests verifie que PopupService gere correctement
 * les notifications temporaires et leur coexistence avec les autres popups.
 *
 * Fonctionnement:
 * 1) On initialise le service avec TestBed puis on utilise des faux timers
 * pour controler precisement la fermeture automatique des notifications.
 *
 * 2) On valide ensuite les cas nominaux et les cas limites:
 * fermeture automatique, fermeture manuelle, remplacement d'une notification
 * deja ouverte et coexistence avec les autres etats de popup.
 */

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

    it('remplace une notification en cours sans laisser le premier timeout fermer la seconde', fakeAsync(() => {
        service.openNotification('Premier message', NOTIFICATION_DURATION_MS);
        tick(NOTIFICATION_DURATION_MS - ONE_MILLISECOND);

        service.openNotification('Second message', NOTIFICATION_DURATION_MS);
        tick(ONE_MILLISECOND);

        expect(service.notificationShow()).toBeTrue();
        expect(service.notificationMessage()).toBe('Second message');

        tick(NOTIFICATION_DURATION_MS);

        expect(service.notificationShow()).toBeFalse();
        expect(service.notificationMessage()).toBe('');
    }));

    it('laisse une notification visible meme si un popup classique ou de choix est deja ouvert', () => {
        service.open('Nouveau tour');
        service.openChoice({
            title: 'Choix',
            message: 'Selectionnez une option.',
        });

        service.openNotification('Combat termine', NOTIFICATION_DURATION_MS);

        expect(service.show()).toBeTrue();
        expect(service.choiceShow()).toBeTrue();
        expect(service.notificationShow()).toBeTrue();
        expect(service.notificationMessage()).toBe('Combat termine');
    });
});
