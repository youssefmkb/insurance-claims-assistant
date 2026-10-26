// src/types/claim.schemas.ts

// Schémas Zod miroirs de claim.types.ts, utilisés comme inputSchema des tools.
// Ils valident les entrées à la frontière du serveur et produisent un JSON Schema
// complet pour les clients MCP.

import { z } from "zod";

const ClaimSeveritySchema = z.enum([
  "AUTO_PROCESS",
  "REVIEW_NEEDED",
  "URGENT_ESCALATION",
]);

const VehicleSchema = z.object({
  licensePlate: z.string(),
  make: z.string(),
  model: z.string(),
  insurancePolicy: z.string(),
});

const PartySchema = z.object({
  role: z.enum(["responsible", "victim", "unknown"]),
  name: z.string(),
  contact: z.string(),
  injuries: z.boolean(),
});

const DamageSchema = z.object({
  target: z.enum(["vehicle", "property", "person"]),
  description: z.string(),
  severity: z.enum(["minor", "moderate", "severe"]),
});

export const ClaimDataSchema = z
  .object({
    claimId: z.string(),
    reportDate: z.string(),
    vehicles: z.array(VehicleSchema),
    parties: z.array(PartySchema),
    damages: z.array(DamageSchema),
    circumstances: z.string(),
    witnesses: z.array(z.string()),
    rawText: z.string(),
  })
  .describe("Objet ClaimData retourné par analyze_claim_report");

const JudgeVerdictSchema = z.object({
  approved: z.boolean(),
  feedback: z.string(),
  finalSeverity: ClaimSeveritySchema,
});

export const ClassificationResultSchema = z
  .object({
    severity: ClaimSeveritySchema,
    initialSeverity: ClaimSeveritySchema.optional().describe(
      "Proposition de Haiku avant le verdict du juge, gardée pour la traçabilité",
    ),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    judgeVerdict: JudgeVerdictSchema,
  })
  .describe("Objet ClassificationResult retourné par classify_claim_severity");
