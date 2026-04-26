export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqAccordionProps {
  headline?: string;
  items: FaqItem[];
  className?: string;
}
