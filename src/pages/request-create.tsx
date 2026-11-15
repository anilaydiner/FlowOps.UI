import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { adminApi, requestsApi } from "@/api/endpoints"
import { apiErrorText, isClientError } from "@/api/error-text"
import { ErrorBanner } from "@/components/field-error"
import { PageHeader } from "@/components/page"
import { DynamicPayloadForm } from "@/components/dynamic-payload-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export function RequestCreatePage() {
  const navigate = useNavigate()
  const [typeCode, setTypeCode] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const { data: typesData } = useQuery({
    queryKey: ["request-types"],
    queryFn: () => adminApi.requestTypes(),
    staleTime: 5 * 60_000,
  })
  const types = (typesData?.content ?? []).filter((t) => t.active !== false)
  const selected = types.find((t) => t.code === typeCode)

  const mutation = useMutation({
    mutationFn: ({
      typeCode,
      payload,
    }: {
      typeCode: string
      payload: Record<string, unknown>
    }) => requestsApi.createDraft(typeCode, payload),
    onSuccess: (req) => {
      toast.success("Draft created — submit it when ready")
      navigate(`/requests/${req.id}`)
    },
    onError: (err) => {
      setError(apiErrorText(err))
      if (!isClientError(err)) toast.error(apiErrorText(err))
    },
  })

  return (
    <div>
      <PageHeader
        title="New Request"
        description="Choose a request type and fill in the required details. Drafts can be submitted later."
      />

      {types.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            No request types are available. Ask an admin to configure types.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Request type</CardTitle>
            <CardDescription>
              Each type has its own required fields and approval workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex flex-col gap-2">
              <ErrorBanner message={error} />
              <Label>Type</Label>
              <Select
                value={typeCode}
                onValueChange={(v) => {
                  setTypeCode(v)
                  setError(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a request type" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.code} value={t.code ?? ""}>
                      {t.name} — {t.departmentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected ? (
              <DynamicPayloadForm
                key={selected.code}
                type={selected}
                submitting={mutation.isPending}
                submitLabel="Create draft"
                onCancel={() => navigate(-1)}
                onSubmit={(payload) =>
                  mutation.mutate({
                    typeCode: selected.code ?? typeCode,
                    payload,
                  })
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a request type to see its required fields.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
