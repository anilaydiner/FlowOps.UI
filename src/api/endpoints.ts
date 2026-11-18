import { api, tokenStore, type QueryParams } from "./client"
import type { components } from "./schema"

type S = components["schemas"]

export type UserResponse = S["UserResponse"]
export type RoleResponse = S["RoleResponse"]
export type PermissionResponse = S["PermissionResponse"]
export type Department = S["Department"]
export type RequestTypeResponse = S["RequestTypeResponse"]
export type WorkflowResponse = S["WorkflowResponse"]
export type RequestResponse = S["RequestResponse"]
export type StepDto = S["StepDto"]
export type DecisionRequest = S["DecisionRequest"]
export type EligibleDelegateeResponse = S["EligibleDelegateeResponse"]
export type NotificationResponse = S["NotificationResponse"]
export type AuditEvent = S["AuditEvent"]
export type BlockedResponse = S["BlockedResponse"]
export type BlockedStep = S["BlockedStep"]
export type StepRecovery = S["StepRecovery"]
export type ParticipantResponse = S["ParticipantResponse"]
export type ExecutionProgress = S["ExecutionProgress"]
export type JobCounts = S["JobCounts"]
export type ExecutionJobDto = S["ExecutionJobDto"]
export type ExecutionRecoveryView = S["View"]
export type RecoveryJob = S["Job"]
export type Receipt = S["Receipt"]
export type AttemptsView = S["Attempts"]
export type AttemptEvent = S["Event"]
export type RecoverRequest = S["RecoverRequest"]
export type RolloutReport = S["Report"]
export type RolloutCheck = S["Check"]

/**
 * GET /requests/{id}/execution-plan returns `GetExecutionPlan.View`
 * ({known, plan}). The OpenAPI generator merges it with the unrelated
 * execution-recovery `View` under the same schema name, so it is typed here.
 */
export interface ExecutionPlanAction {
  position?: number
  action?: string
  idempotencyKey?: string
  input?: Record<string, unknown>
  correlationId?: string
}

export interface ExecutionPlanView {
  known?: boolean
  plan?: {
    id?: string
    requestId?: number
    typeId?: number
    typeCode?: string
    plannedAt?: string
    approval?: Record<string, unknown>
    actions?: ExecutionPlanAction[]
  }
}

export interface RecoveryCommand {
  commandId: string
  expectedVersion: number
  reason: string
}

export interface RecoveryResponse {
  requestVersion?: number
  command?: Receipt
}

export interface BlockedListQuery extends QueryParams {
  reason?: string
  blockedBefore?: string
  ownerId?: number
  team?: string
  page?: number
  size?: number
}
export type Page<T> = {
  content?: T[]
  page?: number
  size?: number
  totalElements?: number
  totalPages?: number
  first?: boolean
  last?: boolean
}

export const REQUEST_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "EXECUTED",
  "CLOSED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
] as const

export interface RequestListQuery extends QueryParams {
  status?: string
  typeCode?: string
  mine?: boolean
  page?: number
  size?: number
}

export const authApi = {
  login: (username: string, password: string) =>
    api<S["AuthResponse"]>("/auth/token", {
      method: "POST",
      body: { username, password },
      noRedirectOn401: true,
    }),
  /** Always 202 (uniform body) — no user enumeration. */
  forgotPassword: (email: string) =>
    api<{ message?: string }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
      noRedirectOn401: true,
    }),
  /** 200 on success; uniform 400 for bad/expired/used token or weak password. */
  resetPassword: (token: string, newPassword: string) =>
    api<null>("/auth/reset-password", {
      method: "POST",
      body: { token, newPassword },
      noRedirectOn401: true,
    }),
  /**
   * Revoke the current session server-side. 204 on success.
   * Sends the stored refresh token in the body (permitAll endpoint) so this
   * still revokes the session even when the access token is already expired.
   * Note: only include the body when a refresh token exists — the backend
   * body DTO is validated (@NotBlank) and an empty string would 400.
   */
  logout: () => {
    const refreshToken = tokenStore.getRefresh()
    return api<null>("/auth/logout", {
      method: "POST",
      ...(refreshToken ? { body: { refreshToken } } : {}),
      noRedirectOn401: true,
    })
  },
  /** Revoke EVERY session for the current user (requires a live access token). */
  logoutAll: () =>
    api<null>("/auth/logout-all", { method: "POST", noRedirectOn401: true }),
}

export const meApi = {
  get: () => api<UserResponse>("/users/me"),
}

export const requestsApi = {
  list: (query: RequestListQuery) =>
    api<Page<RequestResponse>>("/requests", { query }),
  queue: (query: RequestListQuery) =>
    api<Page<RequestResponse>>("/requests/queue", { query }),
  get: (id: number) => api<RequestResponse>(`/requests/${id}`),
  createDraft: (typeCode: string, payload: Record<string, unknown>) =>
    api<RequestResponse>("/requests", {
      method: "POST",
      body: { typeCode, payload },
    }),
  updateDraft: (id: number, payload: Record<string, unknown>) =>
    api<RequestResponse>(`/requests/${id}`, { method: "PUT", body: { payload } }),
  submit: (id: number) => api<RequestResponse>(`/requests/${id}/submit`, { method: "POST" }),
  cancel: (id: number) => api<RequestResponse>(`/requests/${id}/cancel`, { method: "POST" }),
  close: (id: number) => api<RequestResponse>(`/requests/${id}/close`, { method: "POST" }),
  decide: (id: number, body: DecisionRequest) =>
    api<RequestResponse>(`/requests/${id}/decisions`, { method: "POST", body }),
  eligibleDelegatees: (id: number) =>
    api<EligibleDelegateeResponse[]>(`/requests/${id}/eligible-delegatees`),
  askClarification: (id: number, question: string) =>
    api<S["ClarificationResponse"]>(`/requests/${id}/clarifications`, {
      method: "POST",
      body: { question },
    }),
  answerClarification: (id: number, clarificationId: number, answer: string) =>
    api<S["ClarificationResponse"]>(`/requests/${id}/clarifications/${clarificationId}`, {
      method: "PUT",
      body: { answer },
    }),
  audit: (id: number, query?: QueryParams) =>
    api<AuditEvent[]>(`/requests/${id}/audit`, { query }),
  /** Frozen approval-time action plan. known=false means legacy or not yet approved. */
  executionPlan: (id: number) => api<ExecutionPlanView>(`/requests/${id}/execution-plan`),
  /** Approval roster and delegation history (same access rules as request detail). */
  participants: (id: number) => api<ParticipantResponse[]>(`/requests/${id}/participants`),
  /** Operator recovery history (requires request:blocked:read). */
  recoveries: (id: number) => api<StepRecovery[]>(`/requests/${id}/recoveries`),
  /** Re-assign blocked participants and clear the block (requires request:recover). */
  recover: (id: number, body: RecoverRequest) =>
    api<RequestResponse>(`/requests/${id}/recover`, { method: "POST", body }),
  /** Re-evaluate eligibility without reassigning (requires request:recover). */
  recheck: (
    id: number,
    body: Pick<RecoverRequest, "stepInstanceId" | "expectedVersion" | "reason">,
  ) => api<RequestResponse>(`/requests/${id}/recheck`, { method: "POST", body }),
  /** Paged blocked-step operator view (requires request:blocked:read). */
  blockedList: (query: BlockedListQuery) =>
    api<Page<BlockedResponse>>("/requests/blocked", { query }),
}

/** Durable execution attention + immutable recovery history (execution:* permissions). */
export const executionRecoveryApi = {
  history: (requestId: number, limit?: number) =>
    api<ExecutionRecoveryView>(`/requests/${requestId}/execution-recovery`, {
      query: limit !== undefined ? { limit } : undefined,
    }),
  attempts: (requestId: number, jobId: number, query?: QueryParams) =>
    api<AttemptsView>(
      `/requests/${requestId}/execution-recovery/${jobId}/attempts`,
      { query },
    ),
  events: (requestId: number, jobId: number, query?: QueryParams) =>
    api<AttemptEvent[]>(
      `/requests/${requestId}/execution-recovery/${jobId}/attempt-events`,
      { query },
    ),
  reconcile: (requestId: number, jobId: number, body: RecoveryCommand) =>
    api<RecoveryResponse>(
      `/requests/${requestId}/execution-recovery/${jobId}/reconcile`,
      { method: "POST", body },
    ),
  retry: (requestId: number, jobId: number, body: RecoveryCommand) =>
    api<RecoveryResponse>(
      `/requests/${requestId}/execution-recovery/${jobId}/retry`,
      { method: "POST", body },
    ),
}

/** Rollout certification report (requires global execution:rollout:read). */
export const executionRolloutApi = {
  check: (phase?: "PRE_ENABLE" | "POST_ENABLE") =>
    api<RolloutReport>("/execution/rollout", {
      query: phase !== undefined ? { phase } : undefined,
    }),
}

export const notificationsApi = {
  list: (query?: QueryParams) =>
    api<Page<NotificationResponse>>("/notifications", { query }),
  unreadCount: () => api<S["UnreadCount"]>("/notifications/unread-count"),
  markRead: (id: number) =>
    api<NotificationResponse>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => api<null>("/notifications/read-all", { method: "PATCH" }),
}

export const adminApi = {
  users: (query?: QueryParams) => api<Page<UserResponse>>("/users", { query }),
  createUser: (body: S["UserRequest"]) =>
    api<UserResponse>("/users", { method: "POST", body }),
  updateUser: (id: number, body: S["UserRequest"]) =>
    api<UserResponse>(`/users/${id}`, { method: "PUT", body }),
  deleteUser: (id: number) => api<null>(`/users/${id}`, { method: "DELETE" }),
  roles: (query?: QueryParams) => api<Page<RoleResponse>>("/roles", { query }),
  createRole: (body: S["RoleRequest"]) =>
    api<RoleResponse>("/roles", { method: "POST", body }),
  updateRole: (id: number, body: S["RoleRequest"]) =>
    api<RoleResponse>(`/roles/${id}`, { method: "PUT", body }),
  deleteRole: (id: number) => api<null>(`/roles/${id}`, { method: "DELETE" }),
  permissions: (query?: QueryParams) =>
    api<Page<PermissionResponse>>("/permissions", { query }),
  requestTypes: (query?: QueryParams) =>
    api<Page<RequestTypeResponse>>("/request-types", { query: { size: 100, ...query } }),
  createRequestType: (body: S["RequestTypeRequest"]) =>
    api<RequestTypeResponse>("/request-types", { method: "POST", body }),
  updateRequestType: (id: number, body: S["RequestTypeRequest"]) =>
    api<RequestTypeResponse>(`/request-types/${id}`, { method: "PUT", body }),
  workflows: (query?: QueryParams) => api<Page<WorkflowResponse>>("/workflows", { query }),
  createWorkflow: (body: S["WorkflowRequest"]) =>
    api<WorkflowResponse>("/workflows", { method: "POST", body }),
  updateWorkflow: (id: number, body: S["WorkflowRequest"]) =>
    api<WorkflowResponse>(`/workflows/${id}`, { method: "PUT", body }),
  departments: (query?: QueryParams) => api<Page<Department>>("/departments", { query }),
}
