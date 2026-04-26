export interface TimelineItem {
  date: string
  title: string
  description: string
}

export interface TimelineProps {
  items: TimelineItem[]
  className?: string
}
