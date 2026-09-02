export declare const CAPABILITY_ID: string;
export declare const PRODUCTION_TRIAL_ID: string;
export declare const TRIAL_VERSION: string;

export type CoercionType = "string" | "integer" | "number" | "boolean";
export type TransformReasonCode =
  | "TRANSFORMATION_MATCH"
  | "SOURCE_PATH_MISSING"
  | "INVALID_TYPE_COERCION"
  | "INVALID_TRANSFORMATION_SPEC"
  | "UNSUPPORTED_OPERATION"
  | "TARGET_PATH_CONFLICT";

export interface StructuredDataTransformationInput {
  source: unknown;
  spec: unknown;
}

export interface StructuredDataTransformationResult {
  reason_code: TransformReasonCode;
  result: unknown | null;
}

export interface StructuredDataTransformationPracticeFixture {
  input: StructuredDataTransformationInput;
  expected: StructuredDataTransformationResult;
}

export declare function coerceValue(value: unknown, type: CoercionType): unknown;
export declare function applyTransformation(source: unknown, spec: unknown): StructuredDataTransformationResult;
export declare function executeStructuredDataTransformation(
  input: StructuredDataTransformationInput,
): Promise<StructuredDataTransformationResult>;
export declare function createPracticeFixture(): StructuredDataTransformationPracticeFixture;
export declare function evaluatePractice(
  result: StructuredDataTransformationResult,
  fixture: StructuredDataTransformationPracticeFixture,
): Promise<boolean>;
