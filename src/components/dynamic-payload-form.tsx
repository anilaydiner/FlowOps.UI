import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { z } from "zod"
import type { RequestTypeResponse } from "@/api/endpoints"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface FieldRule {
  type?: string
  min?: number
  max?: number
  pattern?: string
}

type Field = z.ZodString | z.ZodNumber

export function buildZod(
  type: {
    requiredFields?: Record<string, string>
    validationRules?: Record<string, FieldRule>
  },
) {
  const shape: Record<string, Field> = {}
  for (const [key, label] of Object.entries(type.requiredFields ?? {})) {
    const rule = (type.validationRules?.[key] ?? {}) as FieldRule
    if (rule.type === "number") {
      let field: z.ZodNumber = z.coerce.number({
        error: `${label} must be a number`,
      })
      if (rule.min !== undefined)
        field = field.min(rule.min, `Must be at least ${rule.min}`)
      if (rule.max !== undefined)
        field = field.max(rule.max, `Must be at most ${rule.max}`)
      shape[key] = field
    } else {
      let field: z.ZodString = z
        .string()
        .trim()
        .min(1, `${label} is required`)
      if (rule.pattern) {
        field = field.regex(new RegExp(rule.pattern), `${label} has an invalid format`)
      }
      shape[key] = field
    }
  }
  return z.object(shape)
}

const LONG_TEXT_HINTS = /description|justification|reason|comment/i

/**
 * Renders the request type's `requiredFields` as a form, validating against
 * `validationRules` client-side. Calls onSubmit with the typed payload.
 */
export function DynamicPayloadForm({
  type,
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  type: RequestTypeResponse
  initial?: Record<string, unknown>
  submitting?: boolean
  submitLabel: string
  onSubmit: (payload: Record<string, unknown>) => void
  onCancel?: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const key of Object.keys(type.requiredFields ?? {})) {
      const raw = initial?.[key]
      v[key] = raw === undefined || raw === null ? "" : String(raw)
    }
    return v
  })

  const fields = Object.entries(type.requiredFields ?? {})

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {}
    for (const [key] of fields) {
      const rule = (type.validationRules?.[key] ?? {}) as FieldRule
      const raw = values[key] ?? ""
      if (rule.type === "number") {
        const n = Number(raw)
        payload[key] = raw === "" || Number.isNaN(n) ? raw : n
      } else {
        payload[key] = raw
      }
    }
    const result = buildZod(type).safeParse(payload)
    if (!result.success) {
      const first = result.error.issues[0]
      toast.error(first?.message ?? "Invalid input")
      return
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {type.description && (
        <p className="text-sm text-muted-foreground">{type.description}</p>
      )}
      {fields.map(([key, label]) => {
        const rule = (type.validationRules?.[key] ?? {}) as FieldRule
        const common = {
          id: key,
          name: key,
          required: true,
          value: values[key] ?? "",
          onChange: (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) => setValues((v) => ({ ...v, [key]: e.target.value })),
        }
        if (rule.type === "number") {
          return (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                {...common}
                type="number"
                step="any"
                min={rule.min}
                max={rule.max}
                placeholder={rule.min !== undefined ? `≥ ${rule.min}` : "Enter a number"}
              />
            </div>
          )
        }
        if (LONG_TEXT_HINTS.test(key)) {
          return (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={key}>{label}</Label>
              <Textarea {...common} rows={3} placeholder={label} />
            </div>
          )
        }
        return (
          <div key={key} className="flex flex-col gap-2">
            <Label htmlFor={key}>{label}</Label>
            <Input {...common} placeholder={label} />
          </div>
        )
      })}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
