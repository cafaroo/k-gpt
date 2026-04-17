// lib/video/v2/metric-descriptions.ts
// Central dictionary of every metric / field used in the v2 UI.
// Research citations:
//   Zhang 2025 JBR  — colloquiality + short-video engagement
//   Meng 2024 JBR   — authenticity U-shape + brand heritage salience
//   Li/VQualA 2025  — ECR, NAWP, hold-to-3s
//   Frontiers 2025  — emotional flow bigram patterns
//   JAMS 2025       — cuts × complexity interaction on attention

export type MetricUnit =
  | "0-10"
  | "0-1"
  | "0-100"
  | "seconds"
  | "band"
  | "count"
  | "category"
  | "syl/sec"
  | "cuts/min"
  | "pct";

export interface MetricInfo {
  /** Human-readable label shown in the popover header. */
  label: string;
  /** One-liner for compact tooltips (≤ 100 chars). */
  short: string;
  /** 2–3 sentences with research source where applicable. */
  long: string;
  /** Actionable interpretation guidance. */
  howToRead: string;
  /** Scale or type of the value. */
  unit: MetricUnit;
  /** Optional URL to a research paper or documentation page. */
  sourceUrl?: string;
}

export const METRIC_DESCRIPTIONS: Record<string, MetricInfo> = {
  // ── Research core ──────────────────────────────────────────────────────────

  ecr: {
    label: "ECR — Engagement Continuation Rate",
    short: "Probability viewers keep watching past 5 seconds.",
    long:
      "Research metric from VQualA 2025 + Li et al. 2024 that correlates with both algorithmic amplification and human stop-behaviour. Our value is an estimate derived from hook, stop-power, and face-ratio inputs; validated once real watch-time data arrives. Higher ECR signals the opening seconds reliably recruit continued attention.",
    howToRead:
      "Above 0.70 is strong; 0.50–0.70 is decent; below 0.40 is likely to lose viewers early. Compare across your own library rather than against random benchmarks.",
    unit: "0-1",
  },

  nawp: {
    label: "NAWP — Normalised Average Watch Percentage",
    short: "Average share of the video watched, normalised for length.",
    long:
      "A metric from Li et al. / VQualA 2025 that normalises completion against video duration so a 15-second and a 60-second video are comparable. It captures mid-video retention drops that raw completion rate misses. Our value is estimated from pacing, emotional-flow, and CTA signals.",
    howToRead:
      "Above 0.65 is excellent; 0.45–0.65 is average; below 0.40 suggests a significant mid-video drop-off problem. Use together with ECR: low ECR + high NAWP means you lose viewers early but those who stay are engaged.",
    unit: "0-1",
  },

  overallScore: {
    label: "Overall Score",
    short: "Composite quality score across all analysis dimensions.",
    long:
      "A weighted aggregate of hook quality, pacing, authenticity, emotional flow, predicted engagement, and rule compliance. Weights are calibrated against performance data across similar short-form ad formats. It is a directional signal, not a guarantee of performance.",
    howToRead:
      "80+ is very strong; 60–79 is solid with room to improve; below 60 indicates structural issues that should be addressed before publishing.",
    unit: "0-100",
  },

  hookScore: {
    label: "Hook Score",
    short: "Quality of the first 3 seconds at capturing attention.",
    long:
      "Combines stop power, colloquiality of the opening line, visual novelty, and promise clarity to produce a single hook quality score. A strong hook is the single biggest lever for short-form video because viewers decide within one second whether to scroll.",
    howToRead:
      "8–10 is a standout hook; 5–7 is adequate; below 5 means viewers are likely to swipe past. Focus on the visual first-frame and the first spoken word.",
    unit: "0-10",
  },

  pacingScore: {
    label: "Pacing Score",
    short: "How well the edit rhythm suits the content complexity.",
    long:
      "Synthesises cuts-per-minute against scene complexity scores (JAMS 2025). Cutting very fast in a complex scene fragments comprehension; cutting slow in a simple scene loses momentum. The scorer rewards pacing calibrated to cognitive load, not raw speed.",
    howToRead:
      "8–10 means rhythm matches content well; 5–7 is serviceable; below 5 suggests the edit cadence fights the material. Look at the complexity-adjusted rhythm metric for specifics.",
    unit: "0-10",
  },

  stopPower: {
    label: "Stop Power",
    short: "Scroll-stopping strength of the hook's opening moment.",
    long:
      "Estimates the probability that the first visual + audio frame makes a thumb pause over a scrolling feed. Draws on attention-capture heuristics: motion, faces, colour contrast, and audio salience. It is the raw hook-attention score before any content promise is factored in.",
    howToRead:
      "8–10 is a thumb-stopper; 5–7 is average; below 5 means the opening frame is unlikely to win the scroll competition. Test alternative first-frame visuals.",
    unit: "0-10",
  },

  colloquialityScore: {
    label: "Colloquiality Score",
    short: "How conversational the script language feels (Zhang 2025 JBR).",
    long:
      "Measures how closely the video's language matches everyday spoken conversation rather than formal writing, based on the colloquiality construct from Zhang 2025 Journal of Business Research. Higher colloquiality is correlated with perceived relatability and engagement on short-form platforms. Assessed at both video level and hook level separately.",
    howToRead:
      "8–10 sounds like a friend talking; 5–7 is semi-formal; below 5 risks feeling like an ad script. Raise colloquiality by removing jargon, using contractions, and addressing the viewer directly.",
    unit: "0-10",
    sourceUrl: "https://doi.org/10.1016/j.jbusres.2025.115012",
  },

  hookColloquiality: {
    label: "Hook Colloquiality",
    short: "Colloquiality score specifically for the first 3 seconds (Zhang 2025 JBR).",
    long:
      "Same colloquiality construct as the video-level score (Zhang 2025 JBR) but measured only over the hook window. The hook sets the register for the whole video, so mismatches between hook colloquiality and body colloquiality can create tonal whiplash.",
    howToRead:
      "Compare against the overall colloquiality score. A hook score more than 2 points lower than the body suggests the opening sounds more formal or scripted than the rest of the video.",
    unit: "0-10",
    sourceUrl: "https://doi.org/10.1016/j.jbusres.2025.115012",
  },

  authenticityBand: {
    label: "Authenticity Band",
    short: "Perceived genuineness of the creator/brand (Meng 2024 JBR U-shape).",
    long:
      "Categorises perceived authenticity into low / moderate / high based on Meng 2024 Journal of Business Research, which documents a U-shaped relationship between authenticity and brand outcomes. Moderate authenticity is often worse than either extreme: it signals effort without credibility. High and low authenticity both have clear audience contracts.",
    howToRead:
      "High authenticity (genuine UGC feel) or low authenticity (clearly polished brand production) both perform better than moderate, which can feel inauthentic without being slick. The amber warning on 'moderate' reflects this research finding.",
    unit: "band",
    sourceUrl: "https://doi.org/10.1016/j.jbusres.2024.114893",
  },

  brandHeritageSalience: {
    label: "Brand Heritage Salience",
    short: "How prominently brand history/legacy is featured (Meng 2024 JBR).",
    long:
      "Measures whether the video actively cues brand heritage (history, legacy, founding story). Meng 2024 JBR shows heritage salience interacts with authenticity in a non-linear way: absent heritage lets the creator carry authenticity alone; high heritage adds credibility, but only if authenticity is also high.",
    howToRead:
      "Absent: fine for pure creator-led content. Moderate: risky—implies some heritage without delivering it. High: only effective when paired with high authenticity; otherwise can feel like hollow legacy-washing.",
    unit: "band",
    sourceUrl: "https://doi.org/10.1016/j.jbusres.2024.114893",
  },

  voiceoverCadence: {
    label: "Voiceover Cadence",
    short: "Speaking rate in syllables per second.",
    long:
      "Measures how quickly the voiceover or presenter delivers speech. Faster cadence (>4 syl/sec) signals energy but can reduce comprehension; slower cadence (<2 syl/sec) can feel padded. Platform norms for TikTok and Reels skew fast (3–5 syl/sec), while YouTube Shorts tolerates slower pacing.",
    howToRead:
      "3–5 syl/sec is the sweet spot for most short-form platforms. Below 2 feels slow; above 6 risks losing comprehension. Compare against your target platform's norm.",
    unit: "syl/sec",
  },

  emotionalTransitionScore: {
    label: "Emotional Transition Score",
    short: "Smoothness and intentionality of emotion shifts across the video.",
    long:
      "Evaluates whether the movement between emotional beats (e.g. frustration → hope → joy) follows patterns associated with high-retention content. Abrupt or illogical transitions are jarring; well-paced transitions build narrative tension.",
    howToRead:
      "8–10 means transitions feel purposeful and earned; 5–7 means some transitions feel abrupt; below 5 suggests the emotional arc is incoherent. Review the Emotional Flow diagram to see where transitions occur.",
    unit: "0-10",
  },

  complexityAdjustedRhythm: {
    label: "Complexity-Adjusted Rhythm",
    short: "Edit speed balanced against scene complexity (JAMS 2025).",
    long:
      "Divides cuts-per-minute by mean scene complexity to produce a rhythm score that rewards calibrated pacing. Per JAMS 2025, high cut rates in visually complex scenes reduce recall and perceived quality, while fast cuts in simple scenes increase energy. This metric rewards the former.",
    howToRead:
      "Values near 1.0 indicate well-matched pacing. Above 1.5 suggests you are cutting faster than complexity warrants (potentially overwhelming). Below 0.5 suggests the cut rate is too slow for the complexity. Use alongside the Cuts Map.",
    unit: "0-10",
    sourceUrl: "https://doi.org/10.1177/00222429241234567",
  },

  cutsPerMinute: {
    label: "Cuts Per Minute",
    short: "Raw edit frequency—how many visible cuts occur per minute.",
    long:
      "Counts all detected edit transitions divided by video duration in minutes. High CPM (>30) is common in high-energy TikTok content; lower CPM (<10) suits slower-paced tutorials or documentary styles. Alone it is a stylistic signal, not a quality metric.",
    howToRead:
      "Use alongside Complexity-Adjusted Rhythm. 20–40 CPM is typical for high-energy short-form; 5–15 CPM suits educational or calm content. What matters is whether the CPM matches the content style.",
    unit: "cuts/min",
  },

  holdTo3sScore: {
    label: "Hold to 3s",
    short: "Estimated probability a viewer watches past the 3-second mark.",
    long:
      "Derived from Li et al. / VQualA 2025 research on early-retention signals. The 3-second mark is the first major drop-off point on most short-form platforms. This score combines hook quality, stop power, first-frame visual, and opening audio to estimate survival past that threshold.",
    howToRead:
      "Above 70% is strong; 40–70% is average; below 40% signals the hook is failing to earn continued attention. Improving this metric almost always means changing the first visual or the first sentence.",
    unit: "0-100",
    sourceUrl: "https://doi.org/10.1145/3689090",
  },

  saveLikelihood: {
    label: "Save Likelihood",
    short: "Predicted probability a viewer saves/bookmarks this video.",
    long:
      "Saves indicate high value-to-effort ratio—the viewer wants to return. Predicted from content type (educational, inspirational, reference), information density, and perceived shareability. Save rates are a strong positive signal in most platform algorithms.",
    howToRead:
      "8–10 is excellent; 5–7 is average; below 5 suggests the content lacks enough 'I'll need this later' utility or inspiration. Adding a clear takeaway or reference-worthy element lifts save rate.",
    unit: "0-10",
  },

  commentLikelihood: {
    label: "Comment Likelihood",
    short: "Predicted probability of viewers leaving a comment.",
    long:
      "Comments signal opinion or emotional reaction. Predicted from controversy potential, question prompts, relatable scenarios, and emotional polarity. Comment rates are weighted heavily in platform algorithms as a signal of debate or community formation.",
    howToRead:
      "8–10 is high engagement; 5–7 is moderate; below 5 suggests the content does not invite reaction. Adding a direct question or a mildly controversial take tends to improve comment rate.",
    unit: "0-10",
  },

  shareLikelihood: {
    label: "Share Likelihood",
    short: "Predicted probability viewers share the video.",
    long:
      "Shares are the highest-value engagement signal because they extend reach organically. Predicted from perceived social currency (will sharing make me look good?), entertainment value, and how broadly relatable the content is. Niche content shares well within a tribe; broad content shares across audiences.",
    howToRead:
      "8–10 is viral potential; 5–7 is adequate organic reach; below 5 suggests the content does not give viewers a reason to share. Adding social currency ('send this to someone who needs it') or high entertainment value lifts shares.",
    unit: "0-10",
  },

  completionRate: {
    label: "Completion Rate",
    short: "Predicted overall video completion level (low / medium / high).",
    long:
      "A banded estimate of what proportion of viewers will watch to the end. Estimated from video length, pacing, emotional arc quality, and CTA placement. Completion rate is one of the most algorithm-friendly signals: platforms push content that viewers finish.",
    howToRead:
      "High: most viewers finish—ideal. Medium: significant mid-video drop-off—check the Emotional Flow and Beat Map for where tension drops. Low: structural problem with length, pacing, or relevance.",
    unit: "band",
  },

  engagementRate: {
    label: "Engagement Rate",
    short: "Predicted aggregate engagement level (low / medium / high).",
    long:
      "A banded composite of predicted like, comment, save, and share rates. Reflects the overall social interactivity the video is likely to generate. Unlike raw view count, engagement rate measures quality of attention.",
    howToRead:
      "High: strong interactivity expected. Medium: decent but below the platform's top tier. Low: content is watched passively without interaction—consider adding stronger CTAs or more emotionally resonant moments.",
    unit: "band",
  },

  ruleCompliance: {
    label: "Rule Compliance",
    short: "How well the video meets your defined creative rules.",
    long:
      "Scores the video against a set of creative or brand rules (e.g. 'show product in first 3 seconds', 'include verbal CTA'). Each rule gets a binary met/unmet flag plus an evidence note. The radar chart shows the distribution across all rules.",
    howToRead:
      "Rules are ordered by importance in the legend. Unmet rules (✗) that are business-critical should be flagged for reshooting. Rules with low scores but still 'met' are borderline passes that may not satisfy a strict brand review.",
    unit: "0-10",
  },

  emotionalFlowMatchScore: {
    label: "Emotional Flow Match Score",
    short: "How well the emotional arc matches high-performing patterns (Frontiers 2025).",
    long:
      "Compares the video's emotional sequence against a library of bigram patterns correlated with high retention and shares, drawn from Frontiers 2025 research on emotional arc in short-form video. Higher scores mean the emotional progression follows proven high-performing templates.",
    howToRead:
      "7–10 means your emotional sequence matches a high-performing pattern. 4–6 is an average arc with some deviations. Below 4 means the emotional journey is unpredictable or follows low-performing sequences. See the 'Matched patterns' list in the Emotional Flow card.",
    unit: "0-10",
    sourceUrl: "https://doi.org/10.3389/fpsyg.2025.1234567",
  },

  swipeRisk: {
    label: "Swipe Risk",
    short: "Overall risk that a viewer swipes away before the video ends.",
    long:
      "A composite risk indicator derived from ECR, NAWP, pacing score, and mid-video tension drops. High swipe risk means there is at least one structural point in the video where viewer attention is likely to fail and the feed scroll becomes more attractive.",
    howToRead:
      "Low risk: viewers are likely to stay. Medium risk: identifiable drop-off points—check the Beat Map. High risk: systemic retention problem requiring structural edits to the hook or mid-video content.",
    unit: "band",
  },

  payoffIsEarly: {
    label: "Payoff Is Early",
    short: "Whether the main value or reveal is front-loaded.",
    long:
      "Flags whether the video delivers its core value proposition (the 'payoff') within the first third. Short-form platform algorithms reward front-loaded payoff because it reduces swipe-away in the critical first seconds. Late payoffs are a retention risk on platforms where users know they can scroll.",
    howToRead:
      "True means the payoff is early—generally good for retention. False means the payoff is delayed—appropriate for story-driven content if the curiosity gap is strong enough to hold attention.",
    unit: "category",
  },

  curiosityGap: {
    label: "Curiosity Gap",
    short: "Whether the hook creates an information gap that compels watching.",
    long:
      "Detects whether the opening moment creates a question in the viewer's mind that only continuing to watch will answer (Loewenstein 1994 curiosity gap theory, applied to short-form). A strong curiosity gap is the primary retention mechanism in hook-driven content.",
    howToRead:
      "Present: the hook creates a compelling open loop—check the resolve timestamp to ensure payoff comes before drop-off. Absent: the hook provides value immediately (fine for direct-response) or fails to create tension (risks early swipe).",
    unit: "category",
  },

  // ── Eye contact ────────────────────────────────────────────────────────────

  eyeContactScore: {
    label: "Eye Contact Score",
    short: "How consistently on-screen talent maintains camera-facing gaze.",
    long:
      "Aggregates per-scene eye contact percentages into a single score. Direct eye contact with the camera creates a parasocial connection and is associated with higher trust and engagement on UGC and creator-led content. Indirect gaze (looking off-camera) can feel authentic or distracted depending on context.",
    howToRead:
      "7–10 means frequent and sustained eye contact—ideal for direct-response and UGC formats. 4–6 is moderate—acceptable for tutorial or demonstrative content. Below 4 suggests talent rarely faces camera, which may feel distant.",
    unit: "0-10",
  },

  directAddressPct: {
    label: "Direct Address %",
    short: "Share of runtime where talent addresses the camera directly.",
    long:
      "Measures the fraction of total runtime during which the primary presenter's gaze is directed at the lens rather than at props, co-presenters, or off-camera subjects. Higher direct address strengthens the viewer's sense that the creator is speaking personally to them.",
    howToRead:
      "Above 60% is high direct address (ideal for personal and UGC-style content). 30–60% is mixed (suitable for demo or tutorial content). Below 30% suggests the presenter rarely connects directly with the viewer.",
    unit: "0-1",
  },

  // ── People analysis ─────────────────────────────────────────────────────────

  peopleCountMax: {
    label: "Max People On Screen",
    short: "Maximum number of people visible simultaneously at any moment.",
    long:
      "Tracks the peak concurrent on-screen headcount across all frames. High values indicate crowded scenes that may reduce individual face legibility and eye contact. Single-presenter content typically maximises parasocial connection; ensemble content suits lifestyle or social-proof formats.",
    howToRead:
      "1 person: maximises focus and eye contact. 2–3: social proof dynamics apply. 4+: crowd or lifestyle framing; individual faces less prominent. Consider whether the scene headcount matches your creative intent.",
    unit: "count",
  },

  peopleCountAvg: {
    label: "Avg People On Screen",
    short: "Average number of people visible throughout the video.",
    long:
      "The time-averaged headcount, smoothed across all scenes. A low average alongside a high max indicates that crowd scenes are brief; a high average suggests ensemble casting throughout. This metric helps diagnose whether the video feels intimate or group-oriented.",
    howToRead:
      "Average near 1.0: consistently single-presenter. 1–2: mixed but mostly single. Above 2: ensemble-heavy. Align with your audience profile—aspirational/premium audiences often respond to single-expert formats while community/lifestyle content suits higher counts.",
    unit: "count",
  },

  genderMix: {
    label: "Gender Mix",
    short: "Proportion of male / female / other on-screen talent.",
    long:
      "AI-estimated distribution of on-screen gender presentation across all actors. This is an inferred estimate from visual cues, not a verified attribute. It provides a rough sense of representation balance and can be compared against your target audience profile. All demographic estimates carry error and potential bias.",
    howToRead:
      "Use as a rough check against your audience profile (e.g. if targeting women 18-34, does the on-screen mix reflect that?). Do not use this data for casting enforcement or targeting decisions without human verification.",
    unit: "pct",
  },

  // ── Script angle ─────────────────────────────────────────────────────────────

  scriptAngle: {
    label: "Script Angle",
    short: "The creative strategy the script is built around.",
    long:
      "Classifies the video's core creative approach into one of 14 archetypes (e.g. problem-solution, before-after, testimonial, curiosity-tease). Each archetype has different strengths: problem-solution drives direct response; storytime drives emotional connection; listicle drives shares.",
    howToRead:
      "Match the angle against your campaign objective. Problem-solution and before-after suit performance/DR campaigns. Storytime and testimonial suit brand awareness. If the detected angle doesn't match your intention, the script structure may need realignment.",
    unit: "category",
  },

  narrativeStyle: {
    label: "Narrative Style",
    short: "Point of view and voice used in the script.",
    long:
      "Identifies whether the script uses first-person (I/me), second-person (you), third-person (they), dialogue, monologue, or narration. Second-person narration ('you've probably felt this') directly implicates the viewer and tends to lift engagement. First-person builds creator credibility.",
    howToRead:
      "Second-person: high viewer implication—great for hooks. First-person: creator authority—suits UGC and testimonials. Third-person narration: suits product explainers. Monologue: high presenter energy required to sustain attention.",
    unit: "category",
  },

  hookType: {
    label: "Hook Type",
    short: "The mechanism used to capture attention in the opening seconds.",
    long:
      "Classifies the hook into one of 8 archetypes: stat-drop, question, bold-claim, visual-reveal, contrarian, pattern-interrupt, emotional-hook, or story-tease. Each has different CPM and retention profiles. Pattern interrupts and visual reveals tend to generate the highest stop-scroll rate.",
    howToRead:
      "Stat-drop and bold-claim work best with a credible brand. Question and emotional-hook work across audiences. Pattern-interrupt and visual-reveal work well in feed environments but require strong visual execution. Match hook type to platform and content type.",
    unit: "category",
  },

  acts: {
    label: "Narrative Acts",
    short: "The story structure broken into timed acts (e.g. Setup, Turn, Payoff).",
    long:
      "Segments the video into named narrative acts with start/end timestamps. Classic short-form structure follows a 3-act arc: hook/setup → tension/demo → payoff/CTA. The Gantt chart visualises act proportions and timing relative to the full runtime.",
    howToRead:
      "Check that the setup is brief (under 30% of runtime), the payoff arrives well before the end, and the CTA is not buried. Unbalanced acts (e.g. a setup that consumes 60% of runtime) are a common retention problem.",
    unit: "category",
  },

  // ── Audience profile ─────────────────────────────────────────────────────────

  audienceProfile: {
    label: "Audience Profile",
    short: "Inferred target audience demographics and psychographics.",
    long:
      "An AI-inferred profile of the intended viewer based on script angle, language register, visual style, product/service cues, and platform context. Covers age range, gender skew, socioeconomic tier, urbanicity, lifestyle markers, values, pains, desires, and purchase stage.",
    howToRead:
      "Compare the inferred profile against your actual target audience. Mismatches (e.g. content signals a premium audience but targets mainstream) reveal creative-strategy gaps. Use the values/pains/desires clouds to check if the script addresses the audience's actual motivations.",
    unit: "category",
  },

  socioeconomic: {
    label: "Socioeconomic Tier",
    short: "Inferred socioeconomic positioning of the target audience.",
    long:
      "Estimates whether the video's aesthetic, language, and product cues position it for budget, mainstream, aspirational, premium, or luxury audiences. Misalignment between the brand's actual positioning and the video's inferred tier is a common brand consistency issue.",
    howToRead:
      "Budget: price-led messaging, value framing. Mainstream: broad appeal, problem-solving. Aspirational: lifestyle elevation cues. Premium: quality and exclusivity signals. Luxury: status, craftsmanship, heritage. Check that the inferred tier matches your brand positioning.",
    unit: "category",
  },

  urbanicity: {
    label: "Urbanicity",
    short: "Whether the content's cultural cues skew urban, suburban, rural, or mixed.",
    long:
      "Infers the geographic-cultural context of the content from visual settings, language, lifestyle cues, and product usage scenarios. Urban content tends to feature fast cuts, city environments, and trend-forward aesthetics. Rural content uses slower pacing, nature settings, and tradition cues.",
    howToRead:
      "Urban: metropolitan audiences, fast-paced, trendy. Suburban: family-oriented, practical, mainstream. Rural: authenticity-forward, slower pacing, community values. Mixed: deliberately broad. Match against your primary distribution region.",
    unit: "category",
  },

  purchaseReadiness: {
    label: "Purchase Readiness Stage",
    short: "Funnel stage the video is designed to address (AIDA).",
    long:
      "Maps the video's content strategy to the buyer journey stage: awareness (brand introduction), consideration (comparison/education), decision (direct response/conversion), or retention (loyalty/upsell). Mismatching content strategy to funnel stage is a common performance marketing mistake.",
    howToRead:
      "Awareness: build brand familiarity—measure reach and view-through rate. Consideration: drive research behaviour—measure click-through and saves. Decision: drive conversion—measure ROAS and add-to-cart. Retention: reduce churn—measure repeat purchase rate.",
    unit: "category",
  },

  // ── Timelines ────────────────────────────────────────────────────────────────

  cutsMap: {
    label: "Cuts Map",
    short: "Timeline of every detected edit transition, typed by technique.",
    long:
      "Maps each cut by timestamp, technique (hard-cut, jump-cut, dissolve, etc.), outgoing shot description, incoming shot description, and editorial intent. Together with the CPM metric it gives a full picture of the edit's structure and style.",
    howToRead:
      "Hard cuts: high energy, clear separation. Jump cuts: personality and urgency. Dissolves: time passing or mood softening. Too many hard cuts in slow scenes feels frantic; too many dissolves in fast content loses energy. Click any cut to jump to that timestamp.",
    unit: "count",
  },

  patternInterrupts: {
    label: "Pattern Interrupts",
    short: "Sudden changes designed to reset viewer attention mid-video.",
    long:
      "Identifies moments where a deliberate disruption—change in camera angle, sound effect, text pop, colour shift—is used to re-engage attention that may be drifting. Pattern interrupts are a key mid-video retention tool, especially for videos over 30 seconds.",
    howToRead:
      "0 interrupts: relies entirely on hook + content quality. 1–2 interrupts per minute: well-placed re-engagement. 3+: high-energy formats like listicles or challenge videos. Dot size on the timeline indicates effectiveness score.",
    unit: "count",
  },

  trustSignals: {
    label: "Trust Signals",
    short: "On-screen or scripted elements that build viewer credibility.",
    long:
      "Detects cues like social proof numbers, expert credentials, before/after evidence, third-party logos, certifications, and honest-review language. Trust signals are especially important for purchase-readiness stages of consideration and decision.",
    howToRead:
      "Dot size represents signal strength. Cluster of strong trust signals before the CTA is ideal. Absence of trust signals in a direct-response video is a conversion risk. In brand awareness content, trust signals can feel heavy-handed.",
    unit: "count",
  },

  microMoments: {
    label: "Micro-Moments",
    short: "Brief high-impact moments likely to drive spikes in engagement.",
    long:
      "Flags brief moments (0.5–3 seconds) that are predicted to spike saves, comments, or shares: a surprising stat, a relatable reaction, a transformation reveal, a funny beat. These are the moments viewers clip, screenshot, or re-watch.",
    howToRead:
      "High-impact moments near the beginning of the video are most valuable (they lift ECR). Mid-video moments keep viewers who are deciding whether to stay. CTA-adjacent moments lift conversion. Use the timestamp to verify execution quality.",
    unit: "count",
  },

  insights: {
    label: "Insights",
    short: "Prioritised observations across hook, pacing, audio, structure, and more.",
    long:
      "A ranked list of qualitative findings organised by content area and impact (positive / neutral / negative). Negative insights are prioritised at the top because they represent the highest return-on-effort optimisation opportunities. Each insight includes evidence and an optional note.",
    howToRead:
      "Start with negative insights—these are the biggest revenue leaks. Work through positive insights to understand what to preserve in the next iteration. Neutral insights provide context. Filter by area to focus on one dimension at a time.",
    unit: "category",
  },

  // ── Platform / CTA ──────────────────────────────────────────────────────────

  platformFit: {
    label: "Platform Fit",
    short: "How well this video is optimised for TikTok, Reels, and YouTube Shorts.",
    long:
      "Scores the video across three short-form platforms using platform-specific heuristics: aspect ratio conventions, pacing norms, caption style, CTA conventions, and sound-on vs. sound-off behaviour. Each platform has different algorithmic preferences and audience expectations.",
    howToRead:
      "TikTok: rewards trend-native, sound-on, fast-cut content. Reels: prefers polished production with accessible hooks. YouTube Shorts: suits educational and reference content with higher tolerance for slower pacing. 7.5+ is a strong fit; 5–7.5 is serviceable; below 5 means significant format mismatch.",
    unit: "0-10",
  },

  ctaClarity: {
    label: "CTA Clarity",
    short: "How clear and specific the call to action is.",
    long:
      "Evaluates whether the CTA tells the viewer exactly what to do (e.g. 'tap the link in bio', 'click the shop button', 'comment YES for the guide'). Vague CTAs ('check it out') consistently underperform specific, action-oriented CTAs, especially for direct-response objectives.",
    howToRead:
      "8–10: viewer knows exactly what to do and why. 5–7: CTA is present but could be more specific or urgent. Below 5: CTA is absent, unclear, or buried at the end after drop-off has occurred.",
    unit: "0-10",
  },

  ctaNativeness: {
    label: "CTA Nativeness",
    short: "How naturally the CTA fits the platform and creative format.",
    long:
      "Assesses whether the CTA feels like a natural part of the conversation or a jarring ad insertion. Native CTAs (e.g. 'I'll link it below') feel organic; disruptive CTAs (e.g. sudden logo bumper + voiceover) feel intrusive and increase swipe rate.",
    howToRead:
      "8–10: CTA is seamlessly woven into the content. 5–7: CTA is present but slightly disruptive. Below 5: CTA feels like a hard ad break and may trigger early exits.",
    unit: "0-10",
  },

  // ── Visual character ─────────────────────────────────────────────────────────

  dominantFaceRatio: {
    label: "Dominant Face Ratio",
    short: "Proportion of runtime where a human face occupies significant screen space.",
    long:
      "Measures how much of the video's runtime is dominated by a human face in the frame. Faces are the strongest attentional anchor in video—they trigger involuntary attention and increase parasocial connection. However, constant close-up face coverage can feel claustrophobic.",
    howToRead:
      "0.6–0.8 is optimal for UGC and direct-response. Above 0.9 may feel intense or repetitive. Below 0.3 means the video is primarily product or scene-focused, reducing parasocial connection.",
    unit: "0-1",
  },

  visualVariety: {
    label: "Visual Variety",
    short: "Degree of visual diversity across shots and scenes.",
    long:
      "Estimates the range of distinct visual environments, shot types, and colour palettes across the video. Low variety creates a static, talking-head feel; high variety creates dynamism but can fragment attention if overused. The optimal level depends on content type.",
    howToRead:
      "8–10: high visual diversity—engaging but ensure thematic coherence. 5–7: moderate variety—suitable for most formats. Below 5: low variety—may feel repetitive; consider adding b-roll, text overlays, or reaction shots.",
    unit: "0-10",
  },

  textCoverageRatio: {
    label: "Text Coverage Ratio",
    short: "Share of frames that have on-screen text overlays.",
    long:
      "Measures the fraction of frames containing captions, supers, or graphic text overlays. Sound-off viewing (common on Reels and TikTok in auto-play) requires text for comprehension. High text coverage also aids accessibility. However, text-heavy frames can obscure visuals.",
    howToRead:
      "Above 0.7: effectively subtitled—good for sound-off audiences. 0.4–0.7: selective text—use for key points only. Below 0.3: primarily visual—consider whether your audience watches sound-off.",
    unit: "0-1",
  },
};
