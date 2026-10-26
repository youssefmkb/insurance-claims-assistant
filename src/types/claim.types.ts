// src/types/claim.types.ts

export interface ClaimData {
  claimId: string;
  reportDate: string;
  vehicles: Vehicle[];
  parties: Party[];
  damages: Damage[];
  circumstances: string;
  witnesses: string[];
  rawText: string;
}

export interface Vehicle {
  licensePlate: string;
  make: string;
  model: string;
  insurancePolicy: string;
}

export interface Party {
  role: "responsible" | "victim" | "unknown";
  name: string;
  contact: string;
  injuries: boolean;
}

export interface Damage {
  target: "vehicle" | "property" | "person";
  description: string;
  severity: "minor" | "moderate" | "severe";
}

export type ClaimSeverity =
  | "AUTO_PROCESS"
  | "REVIEW_NEEDED"
  | "URGENT_ESCALATION";

export interface ClassificationResult {
  severity: ClaimSeverity; // décision finale, celle du juge
  initialSeverity?: ClaimSeverity; // proposition de Haiku, gardée pour la traçabilité
  confidence: number; // 0 à 1
  reasoning: string;
  judgeVerdict: JudgeVerdict;
}

export interface JudgeVerdict {
  approved: boolean;
  feedback: string;
  finalSeverity: ClaimSeverity;
}

export interface NotificationPayload {
  claimData: ClaimData;
  classification: ClassificationResult;
  generatedAt: string;
}