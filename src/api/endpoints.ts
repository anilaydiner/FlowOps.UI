import { api, type QueryParams } from "./client"
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
export type NotificationResponse = S["NotificationResponse"]
export type AuditEvent = S["AuditEvent"]
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
