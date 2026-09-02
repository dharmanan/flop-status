export function createFreshPracticeFixture(number: number): Promise<any>;
export function executePracticeFixture(number: number, fixture: any): Promise<any>;
export function evaluatePracticeFixture(number: number, result: any, fixture: any): Promise<boolean>;
export function practiceFieldValues(number: number, fixture: any): Record<string, string>;
export function renderPracticeFixture(number: number, fixture: any, result: any, passed: boolean): void;
export function interpretCapabilityUseResult(number: number, result: any, language?: string): { tone: string; title: string; detail: string };
export function renderCapabilityUseFeedback(number: number, result: any): { tone: string; title: string; detail: string };
