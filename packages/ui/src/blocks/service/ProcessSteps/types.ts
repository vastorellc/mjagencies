export interface ProcessStep {
  step: number
  title: string
  description: string
  iconUrl?: string
}

export interface ProcessStepsProps {
  steps: ProcessStep[]
  className?: string
}
