import { CurrentGamesService } from '@app/current-games.service';

export class Timer {
    private readonly tick = 1000;
    private intervals = new Map<string, NodeJS.Timeout>();
    private timers = new Map<string, number>();

    constructor(private readonly currentGamesService: CurrentGamesService) {}

    startTurnTimer(gameId: string, startValue: number): void {
        if (this.intervals.has(gameId)) return;

        this.timers.set(gameId, startValue);

        const interval = setInterval(() => {
            const current = this.timers.get(gameId);
            if (current === undefined) {
                this.stopTimer(gameId);
                return;
            }

            if (current > 0) {
                this.timers.set(gameId, current - 1);
            } else {
                this.stopTimer(gameId);
            }
        }, this.tick);

        this.intervals.set(gameId, interval);
    }

    getCurrentTime(gameId: string): number {
        return this.timers.get(gameId) ?? 0;
    }

    stopTimer(gameId: string): void {
        const interval = this.intervals.get(gameId);

        if (interval) {
            clearInterval(interval);
            this.intervals.delete(gameId);
        }

        this.currentGamesService.changeTurn(gameId);
        this.timers.delete(gameId);
    }
}
