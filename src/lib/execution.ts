import type { RequestResponse } from "@/api/endpoints"

/**
 * Human labels for the backend's ExecutionProgress.AttentionReason enum.
 * The server computes these; we only explain them.
 */
export const ATTENTION_LABELS: Record<string, string> = {
  REVIEW_BLOCKED: "Approval review is blocked",
  OUTCOME_UNKNOWN: "Closed, but the final outcome is unknown",
  EXECUTION_HISTORY_UNKNOWN: "Approved, but execution history is unknown",
  MISSING_FROZEN_PLAN: "No frozen execution plan was recorded",
  PLAN_INCONSISTENT: "Execution plan does not match recorded jobs",
  MISSING_JOBS: "Expected execution jobs are missing",
  MISSING_JOB_BINDINGS: "Some jobs are missing their plan bindings",
  JOB_IDENTITY_MISMATCH: "A job's identity does not match the plan",
  MATERIALIZATION_UNVERIFIABLE: "Plan materialization cannot be verified",
  UNEXPECTED_JOBS: "Unexpected execution jobs are present",
  UNCERTAIN_EXECUTION: "One or more jobs have uncertain outcomes",
  RETRIES_EXHAUSTED: "A job exhausted its retries (dead letter)",
  EXECUTION_LEASE_EXPIRED: "An execution lease expired mid-run",
  EXPECTED_JOB_CANCELLED: "Expected jobs were cancelled",
  STOPPED_REQUEST_HAS_RUNNABLE_JOBS: "Stopped request still has runnable jobs",
}

export function attentionLabel(reason?: string): string {
  if (!reason) return ""
  return ATTENTION_LABELS[reason] ?? reason.replace(/_/g, " ")
}

/** All attention reasons as one readable sentence (for tooltips/summaries). */
export function attentionText(req: RequestResponse): string {
  const reasons = req.executionProgress?.attentionReasons ?? []
  if (reasons.length === 0) return "Execution needs attention"
  return reasons.map(attentionLabel).join(" · ")
}

/**
 * Whether the request has any execution surface worth showing:
 * a state other than NOT_PLANNED, jobs, or an attention flag.
 */
export function hasExecution(req: RequestResponse): boolean {
  return (
    (req.executionState ?? "NOT_PLANNED") !== "NOT_PLANNED" ||
    (req.executionJobs?.length ?? 0) > 0 ||
    req.requiresAttention === true
  )
}
