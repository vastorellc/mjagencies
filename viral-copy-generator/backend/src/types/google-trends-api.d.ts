// Type declarations for google-trends-api@4.9.2
// No @types package available — hand-rolled minimal declarations for project usage
declare module 'google-trends-api' {
  interface RelatedQueriesOptions {
    keyword: string
    geo?: string
    startTime?: Date
    endTime?: Date
    hl?: string
  }

  interface InterestOverTimeOptions {
    keyword: string | string[]
    geo?: string
    startTime?: Date
    endTime?: Date
    hl?: string
  }

  interface GoogleTrendsAPI {
    relatedQueries(options: RelatedQueriesOptions): Promise<string>
    interestOverTime(options: InterestOverTimeOptions): Promise<string>
    interestByRegion(options: Record<string, unknown>): Promise<string>
    relatedTopics(options: RelatedQueriesOptions): Promise<string>
    dailyTrends(options: Record<string, unknown>): Promise<string>
    realTimeTrends(options: Record<string, unknown>): Promise<string>
  }

  const googleTrends: GoogleTrendsAPI
  export default googleTrends
}
