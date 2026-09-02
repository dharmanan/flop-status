export interface PausableLoopOptions {
  isVisible(): boolean;
  schedule(tick: (time: number) => void): number;
  cancel(id: number): void;
  onFrame(time: number): void;
}

export interface PausableLoop {
  resumeIfVisible(): void;
  isRunning(): boolean;
  destroy(): void;
}

export function createPausableLoop(options: PausableLoopOptions): PausableLoop;
