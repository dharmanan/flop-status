export interface C1PositivePracticeFixture {
  input: {
    public_key: string;
    message: string;
    signature: string;
  };
  expected_valid: true;
  display: {
    message: string;
  };
}

export interface C1PositivePracticeResult {
  valid: boolean;
  reason_code?: string;
  message_hash?: string;
}

export function createValidC1PracticeFixture(): Promise<C1PositivePracticeFixture>;
export function executeValidC1PracticeFixture(fixture: C1PositivePracticeFixture): Promise<C1PositivePracticeResult>;
