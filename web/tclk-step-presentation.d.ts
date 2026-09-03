export interface StepLike {
  index: number;
  type: string;
  ok: boolean;
  reason?: string;
}

export function splitTimelineSteps(steps: StepLike[] | undefined | null): { applied: StepLike[]; rejected: StepLike[] };

export type RejectedRecordCategory = "already-terminal" | "not-applied";

export function rejectedRecordCategory(step: { reason?: string }): RejectedRecordCategory;
