import type {
    BusinessIntelligenceProfile,
    BusinessIndustry,
  } from "./types";
  
  /* ================================== */
  /* GENERIC BUSINESS DATA */
  /* ================================== */
  
  export type BusinessDataRow = Record<
    string,
    string | number | boolean | null | undefined
  >;
  
  /* ================================== */
  /* DETECTOR SCOPE */
  /* ================================== */
  
  export type DetectorScope =
    | "universal"
    | "industry";
  
  /* ================================== */
  /* LEAK SEVERITY */
  /* ================================== */
  
  export type LeakSeverity =
    | "low"
    | "medium"
    | "high"
    | "critical";
  
  /* ================================== */
  /* LEAK CONFIDENCE */
  /* ================================== */
  
  export type LeakConfidence =
    | "low"
    | "medium"
    | "high";
  
  /* ================================== */
  /* DETECTOR REQUIREMENTS */
  /* ================================== */
  
  export type DetectorRequirements = {
    requiredFields?: string[];
  
    optionalFields?: string[];
  
    requiredCapabilities?: Array<
      keyof BusinessIntelligenceProfile["capabilities"]
    >;
  };
  
  /* ================================== */
  /* DETECTOR CONTEXT */
  /* ================================== */
  
  export type DetectorContext = {
    profile: BusinessIntelligenceProfile;
  
    rows: BusinessDataRow[];
  
    now: Date;
  };
  
  /* ================================== */
  /* DETECTED LEAK */
  /* ================================== */
  
  export type DetectedBusinessLeak = {
    detectorId: string;
  
    leakType: string;
  
    title: string;
  
    description: string;
  
    category: string;
  
    severity: LeakSeverity;
  
    confidence: LeakConfidence;
  
    estimatedLoss: number;
  
    estimatedRecovery: number;
  
    customerName: string | null;
  
    sourceRowIndex: number | null;
  
    evidence: Record<string, unknown>;
  
    recommendedAction: string | null;
  
    metadata: Record<string, unknown>;
  };
  
  /* ================================== */
  /* DETECTOR RESULT */
  /* ================================== */
  
  export type DetectorResult = {
    detectorId: string;
  
    ran: boolean;
  
    leaks: DetectedBusinessLeak[];
  
    warnings: string[];
  
    errors: string[];
  };
  
  /* ================================== */
  /* DETECTOR MODULE */
  /* ================================== */
  
  export interface BusinessLeakDetector {
    /*
      Permanent unique ID.
  
      Example:
      "universal.unpaid-invoice"
      "construction.unbilled-change-order"
    */
  
    id: string;
  
    name: string;
  
    description: string;
  
    scope: DetectorScope;
  
    /*
      Universal detectors can leave this empty.
  
      Industry detectors specify which industries
      they are designed to analyze.
    */
  
    industries: BusinessIndustry[];
  
    requirements: DetectorRequirements;
  
    /*
      Determines whether this detector makes sense
      for the current business.
    */
  
    supports(
      profile: BusinessIntelligenceProfile
    ): boolean;
  
    /*
      Runs deterministic leak detection.
  
      Confirmed leaks should come from these
      deterministic modules, not AI guesses.
    */
  
    detect(
      context: DetectorContext
    ): DetectorResult | Promise<DetectorResult>;
  }