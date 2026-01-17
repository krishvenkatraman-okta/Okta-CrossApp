"use client"

import { CheckCircle, AlertCircle, Loader2 } from "@/components/icons"

interface FlowStep {
  id: string
  title: string
  description?: string
  status: "pending" | "running" | "success" | "error"
  details?: string[]
}

interface FlowDiagramProps {
  steps: FlowStep[]
  title?: string
}

export function FlowDiagram({ steps, title }: FlowDiagramProps) {
  if (!steps || steps.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-gradient-to-br from-background to-muted/30 overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
      )}
      <div className="p-4">
        <div className="relative">
          {steps.map((step, idx) => (
            <div key={step.id} className="relative flex gap-4">
              {/* Vertical connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={`absolute left-[19px] top-10 w-0.5 h-[calc(100%-24px)] ${
                    step.status === "success"
                      ? "bg-green-500"
                      : step.status === "error"
                        ? "bg-destructive"
                        : "bg-border"
                  }`}
                />
              )}

              {/* Step indicator */}
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    step.status === "success"
                      ? "border-green-500 bg-green-500/10 text-green-600"
                      : step.status === "error"
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : step.status === "running"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted-foreground/30 bg-muted text-muted-foreground"
                  }`}
                >
                  {step.status === "running" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : step.status === "success" ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : step.status === "error" ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{idx + 1}</span>
                  )}
                </div>
              </div>

              {/* Step content */}
              <div className={`flex-1 pb-6 ${idx === steps.length - 1 ? "pb-0" : ""}`}>
                <div
                  className={`rounded-lg border p-3 transition-all duration-300 ${
                    step.status === "success"
                      ? "border-green-500/50 bg-green-50 dark:bg-green-950/20"
                      : step.status === "error"
                        ? "border-destructive/50 bg-destructive/5"
                        : step.status === "running"
                          ? "border-primary/50 bg-primary/5"
                          : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5
                        className={`text-sm font-semibold ${
                          step.status === "success"
                            ? "text-green-700 dark:text-green-400"
                            : step.status === "error"
                              ? "text-destructive"
                              : "text-foreground"
                        }`}
                      >
                        {step.title}
                      </h5>
                      {step.description && <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>}
                    </div>
                    {step.status === "success" && (
                      <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                        Complete
                      </span>
                    )}
                    {step.status === "running" && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        In Progress
                      </span>
                    )}
                    {step.status === "error" && (
                      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        Failed
                      </span>
                    )}
                  </div>

                  {/* Step details */}
                  {step.details && step.details.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                      {step.details.map((detail, detailIdx) => (
                        <div
                          key={detailIdx}
                          className={`flex items-center gap-2 text-xs ${
                            detail.includes("success") || detail.includes("verified") || detail.includes("received")
                              ? "text-green-600 dark:text-green-400"
                              : detail.includes("Error") || detail.includes("failed")
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          <span className="h-1 w-1 rounded-full bg-current shrink-0" />
                          <span className="font-mono text-[11px]">{detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Helper function to parse steps array into FlowStep format
export function parseStepsToFlow(steps: string[]): FlowStep[] {
  const flowSteps: FlowStep[] = []
  let currentStep: FlowStep | null = null

  steps.forEach((step) => {
    if (step.startsWith("Step ")) {
      // Extract step number and title
      const match = step.match(/Step (\d+):\s*(.+)/)
      if (match) {
        if (currentStep) {
          flowSteps.push(currentStep)
        }
        currentStep = {
          id: `step-${match[1]}`,
          title: match[2],
          status: "success",
          details: [],
        }
      }
    } else if (currentStep) {
      // Add as detail to current step
      const trimmedStep = step.trim()
      if (trimmedStep) {
        // Check for error status
        if (trimmedStep.startsWith("Error")) {
          currentStep.status = "error"
        }
        currentStep.details?.push(trimmedStep)
      }
    }
  })

  if (currentStep) {
    flowSteps.push(currentStep)
  }

  return flowSteps
}
