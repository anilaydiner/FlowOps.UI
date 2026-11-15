import type { PermissionResponse, RoleResponse } from "./endpoints"

/**
 * Client-side mirror of the backend `AuthorizationEvaluator` (PLAN §7).
 *
 * Decides whether a user may perform a permission-gated action on a request,
 * using the same three-part gate the server enforces:
 *
 *   1. **Separation of duties** — the requester cannot act on their own
 *      request unless they hold `request:override:sod`.
 *   2. **Permission** — the user holds the base code (e.g. `request:approve`)
 *      or a scoped variant (`request:approve:…`) via any of their roles.
 *      No role codes are hardcoded: whatever the ADMIN / FINANCE_MANAGER /
 *      JUNIOR_APPROVER roles grant today (or after an admin re-saves them)
 *      is what this checks.
 *   3. **Scope** — if a permission carries a scope constraint, the target
 *      must satisfy it (DEPARTMENT / REQUEST_TYPE / STEP / THRESHOLD / SELF).
 *
 * The role API exposes permissions as bare codes, so scope metadata is
 * resolved from the permission catalog. A code can map to several catalog
 * records (e.g. `request:approve` global vs. REQUEST_TYPE-scoped), and all
 * of them are considered — matching how the evaluator walks the Permission
 * objects granted to the user's roles.
 *
 * The server remains authoritative: this only decides whether to surface an
 * action in the UI; every submitted action still goes through the same
 * evaluation server-side (a mismatch yields 403 with evidence).
 */

export const OVERRIDE_SOD_CODE = "request:override:sod"

/** The request being acted upon (mirrors the backend `TargetContext`). */
export interface DecisionTarget {
  requesterId?: number | null
  typeCode?: string | null
  departmentCode?: string | null
  stepCode?: string | null
  amount?: number | null
}

/** The authenticated user (fields from `/users/me`). */
export interface ActorUser {
  id?: number | null
  departmentCode?: string | null
  roles?: string[]
}

/** Mirrors `TargetContext.extractAmount` on the backend. */
export function extractAmount(
  payload?: Record<string, unknown> | null,
): number | null {
  if (!payload) return null
  const v = payload.amount
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

const eqi = (a?: string | null, b?: string | null): boolean =>
  a != null &&
  b != null &&
  a.trim() !== "" &&
  b.trim() !== "" &&
  a.toLowerCase() === b.toLowerCase()

function scopeMatches(
  perm: Pick<PermissionResponse, "scopeType" | "scopeValue">,
  user: ActorUser,
  target: DecisionTarget,
): boolean {
  const scope = (perm.scopeType ?? "").trim().toUpperCase()
  switch (scope) {
    case "":
      return true // no scope → global permission
    case "SELF":
      return (
        target.requesterId != null && user.id != null &&
        target.requesterId === user.id
      )
    case "DEPARTMENT":
      return eqi(user.departmentCode, target.departmentCode)
    case "REQUEST_TYPE":
      return eqi(perm.scopeValue, target.typeCode)
    case "STEP":
      return eqi(perm.scopeValue, target.stepCode)
    case "THRESHOLD": {
      const max = Number.parseFloat(perm.scopeValue ?? "")
      if (!Number.isFinite(max)) return false
      return (target.amount ?? 0) <= max
    }
    default:
      return false // unknown scope type → deny (conservative)
  }
}

/**
 * All permission records (code + scope metadata) the user holds via their
 * roles, resolved through the permission catalog.
 */
function heldPermissions(
  user: ActorUser,
  roles: RoleResponse[],
  permissions: PermissionResponse[],
): PermissionResponse[] {
  const byCode = new Map<string, PermissionResponse[]>()
  for (const p of permissions) {
    const code = (p.code ?? "").trim()
    if (!code) continue
    const list = byCode.get(code) ?? []
    list.push(p)
    byCode.set(code, list)
  }
  const roleCodes = new Set(
    (user.roles ?? []).map((r) => r?.trim()).filter((r): r is string => !!r),
  )
  const out: PermissionResponse[] = []
  for (const role of roles) {
    const code = (role.code ?? "").trim()
    if (!code || !roleCodes.has(code)) continue
    for (const permCode of role.permissions ?? []) {
      for (const p of byCode.get((permCode ?? "").trim()) ?? []) out.push(p)
    }
  }
  return out
}

/**
 * Evaluate whether `user` may perform the action identified by
 * `permissionCode` (e.g. `request:approve`) on the given `target` —
 * SoD + permission + scope, exactly like the server does.
 */
export function canAct(
  user: ActorUser,
  roles: RoleResponse[],
  permissions: PermissionResponse[],
  permissionCode: string,
  target: DecisionTarget,
): boolean {
  if (user.id == null) return false
  const held = heldPermissions(user, roles, permissions)

  // 1 — SoD: default deny for the requester (overridable by request:override:sod)
  if (target.requesterId != null && target.requesterId === user.id) {
    if (!held.some((p) => p.code === OVERRIDE_SOD_CODE)) return false
  }

  // 2 — candidates: exact code, or scoped variants (code + ":…")
  const base = permissionCode
  const candidates = held.filter(
    (p) => p.code === base || (p.code ?? "").startsWith(base + ":"),
  )
  if (candidates.length === 0) return false

  // 3 — the first candidate that passes the scope check wins
  return candidates.some((p) => scopeMatches(p, user, target))
}
