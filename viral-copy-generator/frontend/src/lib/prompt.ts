import type { EngineSignals, Niche, Platform, LearningData } from './types'

// Real niche hashtag banks for Pakistani short-form creators (AI-07, CLAUDE.md rule 5 — no placeholders)
// Type: Record<string, string[]> to support custom niches not in the predefined list
export const NICHE_HASHTAGS: Record<string, string[]> = {
  travel: [
    '#PakistanTravel', '#VisitPakistan', '#TravelVlog', '#PakistanTourism',
    '#BackpackingPakistan', '#HiddenGems', '#TravelReels', '#Wanderlust',
    '#NorthernPakistan', '#GilgitBaltistan', '#Karakoram', '#TravelPakistan',
    '#PakistanMountains', '#SwatValley', '#ExplorePakistan',
  ],
  hotels: [
    '#PakistanHotels', '#LuxuryTravel', '#HotelReview', '#TravelStay',
    '#BudgetTravel', '#PakistanResorts', '#HotelTour', '#RoomTour',
    '#TravelAccommodation', '#PakistanBnB', '#HospitalityPK', '#HotelLife',
    '#TravelTips', '#PakistanLuxury', '#HotelVlog',
  ],
  cars: [
    '#PakistanCars', '#CarReview', '#CarVlog', '#AutoPakistan',
    '#CarLovers', '#DriveVlog', '#PakistanRoads', '#CarCommunity',
    '#JDMPakistan', '#CarPhotography', '#MotorheadPK', '#CarTalk',
    '#DrivingVlog', '#PakistanMotors', '#CarEnthusiast',
  ],
  bikes: [
    '#PakistanBikes', '#BikeLife', '#BikeVlog', '#MotorcyclePakistan',
    '#BikeRide', '#TwoWheels', '#BikerPakistan', '#MotorbikeLife',
    '#BikeTrip', '#SuzukiPakistan', '#YamahaPakistan', '#BikeReview',
    '#MotorcycleLife', '#PakistanMotorcycle', '#BikeAdventure',
  ],
  coding: [
    '#PakistanCoding', '#LearnToCode', '#ProgrammingLife', '#TechPakistan',
    '#WebDevelopment', '#PakistanDev', '#CodingTips', '#TechReels',
    '#ProgrammingTips', '#JavaScriptPK', '#ReactJS', '#TechTalk',
    '#PakistanTech', '#CodingLife', '#DevLife',
  ],
  lifestyle: [
    '#PakistanLifestyle', '#LifestyleVlog', '#DailyVlog', '#PakistaniLife',
    '#LifestyleReels', '#DayInMyLife', '#PakistanVlogger', '#DesiLifestyle',
    '#PakistanContent', '#LifestylePK', '#UrbanPakistan', '#PakiVlog',
    '#PakistanCreator', '#ContentPakistan', '#LifestyleCreator',
  ],
  food: [
    '#PakistanFood', '#FoodVlog', '#PakistaniFood', '#StreetFoodPakistan',
    '#FoodReview', '#FoodPorn', '#PakistaniCuisine', '#FoodTour',
    '#KarachiFood', '#LahoriFood', '#BiryaniLovers', '#FoodPhotography',
    '#PakistanFoodie', '#LocalFood', '#FoodReels',
  ],
  other: [
    '#Pakistan', '#PakistanReels', '#PakistanContent', '#PakiCreator',
    '#PakistanVlogger', '#ViralPakistan', '#PakistanShorts', '#DesiContent',
    '#PakistanYouTube', '#PakistanSocial', '#PakistanMedia', '#ContentCreator',
    '#PakistanInstagram', '#PakistanTikTok', '#PakistanShorts',
  ],
}

export interface BuildPromptOptions {
  enabledPlatforms: Platform[]
  scriptOutline?: string  // D-05: second pass — appended as improved_script_outline
}

export function buildPrompt(
  signals: EngineSignals | null,
  description: string,
  niche: Niche,
  options: BuildPromptOptions,
  learningData?: LearningData,
): string {
  const hashtags = NICHE_HASHTAGS[niche] ?? NICHE_HASHTAGS.other
  const platforms = options.enabledPlatforms.join(', ')

  // Video signals section — only when analysis ran (D-06)
  const signalsSection = signals
    ? `
## Video Analysis Signals
- Duration: ${signals.durationSec.toFixed(1)}s
- Resolution: ${signals.width}×${signals.height} (aspect ratio: ${signals.aspectRatio.toFixed(4)})
- FPS: ${signals.fps}
- Face count: ${signals.faceCount}
- Scene changes: ${signals.sceneCount}
- Motion score: ${signals.motionScore.toFixed(2)} (0=static, 1=high motion)
- Brightness: ${signals.brightnessScore.toFixed(2)} (0=dark, 1=bright)
- Audio energy: ${signals.audioEnergy.toFixed(2)}
- Beat present: ${signals.beatPresent ? 'yes' : 'no'}
- Object/scene labels: ${signals.objectLabels.slice(0, 10).join(', ') || 'none detected'}
`
    : ''

  // Optional video description (D-06 both paths)
  const descSection = description.trim()
    ? `\n## Video Description\n${description.trim()}\n`
    : ''

  // Second pass: append improved_script_outline (D-05)
  const secondPassSection = options.scriptOutline
    ? `\n## Improved Script Outline (from first generation)\n${options.scriptOutline}\n\nPlease use this outline as the foundation and improve the copy further.\n`
    : ''

  // LEARNING-06: inject top hooks + hashtags from user's learning data (fresh, no caching)
  const learningSection = learningData && (learningData.topHooks.length > 0 || learningData.topHashtags.length > 0)
    ? `
## Your Top-Performing Content (based on your actual view data)
${learningData.topHooks.length > 0
  ? `Top hooks that performed best for you:\n${learningData.topHooks.map(h => `- "${h.hook_text}" (${h.max_views.toLocaleString()} views)`).join('\n')}`
  : ''}
${learningData.topHashtags.length > 0
  ? `\nTop hashtags by average views:\n${learningData.topHashtags.map(h => h.hashtag).join(' ')}`
  : ''}

Use this data to inform your copy -- especially the hook style and hashtag selection.
`
    : ''

  return `You are an expert social media copywriter for Pakistani short-form video creators.
Your task: generate platform-optimised copy for a short-form video in the "${niche}" niche.
Target audience: Pakistani creators and viewers. Language: English with natural Urdu phrases
where they feel authentic (e.g. "yaar", "zabardast", "masha Allah") — not forced, not every sentence.
Active platforms to generate copy for: ${platforms}.
${signalsSection}${descSection}${secondPassSection}${learningSection}
## Niche Hashtag Bank (select the most relevant)
${hashtags.join(' ')}

## Output Requirements
Respond ONLY with a valid JSON object. No markdown fences. No explanation. No extra text.
Required JSON structure:
{
  "youtube": {
    "title": "string (≤60 characters — a punchy title with keyword front-loaded)",
    "description": "string (≤150 characters — SEO-friendly, keyword-rich, includes channel CTA)",
    "tags": ["array", "of", "10-15", "keyword", "tags"],
    "hook": "string (first 3-5 words that appear as a text overlay in the first 1.5s)"
  },
  "instagram": {
    "caption": "string (150-200 characters, Urdu/English mix, conversational tone, ends with question or CTA)",
    "hashtags": ["#array", "of", "#25-30", "#hashtags"],
    "cover_text": "string (3-6 words shown on the thumbnail/cover — attention-grabbing)"
  },
  "tiktok": {
    "hook": "string (first 3-5 words/phrase — must stop the scroll in 0.5s)",
    "caption": "string (≤150 characters — punchy, emoji ok, CTA)",
    "hashtags": ["#array", "of", "#4-6", "#hashtags"]
  },
  "facebook": {
    "caption": "string (2-3 sentences, Urdu/English mix, storytelling opener, ends with CTA)",
    "cta": "string (one clear call-to-action sentence)",
    "hashtags": ["#2-3", "#hashtags"]
  },
  "x": {
    "tweet": "string (≤280 characters, punchy, hook + value + CTA)",
    "hashtags": ["#2-3", "#hashtags"]
  },
  "script_outline": "string (3-5 key moments with timestamps, e.g. '0:00 Hook — show X; 0:10 Build — explain Y; 0:45 CTA')"
}`
}
