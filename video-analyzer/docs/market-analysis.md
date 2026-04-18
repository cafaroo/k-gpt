# Market analysis — video-analyzer SaaS

Senast uppdaterad: 2026-04-17

Denna analys kompletterar `research-framework.md` (produktens analytiska grund) och `unit-economics.xlsx` (COGS + marginaler) med en extern marknadsbild: hur stor möjligheten är, vilka som redan slåss om den, och var $1/credit-modellen sitter i landskapet.

## 0. Positionering som driver hela analysen

**Mission:** flytta Creative Analysis från godtyckliga känslor i review-möten till evidensbaserad analytik. Kategoriskiftet är från *creative review som åsiktsutbyte* till *creative analysis som disciplin* — ungefär som när finansanalys gick från magkänsla till DCF.

**Avgränsning — retrospektiv, inte prediktiv.** Vi svarar inte på "kommer den här vinna?" (det gör Memorable AI, Neurons). Vi svarar på "varför fungerade den här?" genom att koppla extraherad creative-struktur (hooks, beats, emotional arc, trust signals) till faktisk ad-platform performance-data. Syftet är editor-learning-loop: editorn ser mönstret, internaliserar det, producerar bättre content nästa omgång.

**Produkten = metoden + performance-overlay + matchern.** Notion-pluginen är leverans. Dashboarden är UI. Det som är svårt att kopiera är (a) rigorös metodik baserad på peer-reviewed research, (b) join:en mellan extraherad creative-struktur och faktisk ad-spend-data, och (c) matchern som tillförlitligt kopplar uppladdad creative till rätt ad-platform-rad (explicit tag → content-hash → filename → heuristik → human-in-the-loop confirmation). Utan (b) är vi en videobeskrivare. Utan (c) landar $400k+ av single-ad-spend på fel `analysis_id` och scorer:n lär sig en lögn. Se `performance-ingestion-architecture.md` §4 för matcher-designen.

**Invocation-modell: standup-driven, inte batch.** Produkten är inte en "analysera allt"-pipeline. Arbetsflödet är: teamet flaggar veckans high risers i creative standup, kör analys på de få creatives som faktiskt behöver förklaring, matar strukturella mönster in i nästa brief. Lägre volym per team men högre signal per analys — varje flaggad creative är redan pre-filtrerad för att vara värd att förstå, och i UGC-vertikalen har en enskild vinnande annons ofta $300–500k+ i spend bakom sig, vilket gör per-creative-evidensen i det närmaste deterministisk.

**Data-ingestion: CSV-först, OAuth som P1-bekvämlighet.** Kunder exporterar redan performance-data från varje plattform de kör på (Meta Ads Manager, TikTok Ads Manager, egen BI, byrå-rapporter). Vår primära path är CSV-upload + matcher; OAuth till Meta/TikTok är en P1-uppgradering som ersätter exportsteget när en brand är committerad. Det innebär att ad-platform API-beroende inte är existentiellt — en Meta app review-försening, deprekerad `ads_read`-scope eller återkallad per-brand OAuth-grant stoppar inte evidence-loopen så länge kunden kan släppa en CSV. Se `performance-ingestion-architecture.md` för hela ingestion-arkitekturen.

## 1. Marknadsstorlek

Den relevanta trattsynen från global videoannonsering till vår reachable wedge.

| Nivå | Storlek | Vad det omfattar |
|---|---|---|
| TAM | ~$180B (2025) | Global digital videoannonsering |
| SAM — UGC-slice | ~$50B | Short-form + creator-led ad spend (TikTok, Reels, Shorts) |
| Analytics layer | ~$2–3B | Performance creative analytics och pre-flight scoring |
| Reachable wedge | ~$400–800M | DTC-brands + mid-market agencies med ad spend > $50k/mo |
| 3-års SOM | ~$10–40M ARR | Realistisk capture för en ny mid-market-spelare |

Källor: eMarketer digital video ad forecast 2025, Statista short-form video ad spend, Goldman Sachs creator economy 2024-report, VidMob + Motion fundraise disclosures.

**Slutsats:** Marknaden är reell men fragmenterad. Du slåss inte om $180B — du slåss om en $500M analytics-subkategori där Motion, Foreplay, VidMob, Memorable AI och ett tiotal nyare spelare redan huggit in. Vinnande drag är smal ICP + tydlig wedge, inte bred pitch.

## 2. Konkurrentpositionering

Med retrospektiv-linsen blir konkurrentbilden skarpare: tools grupperas i tre buckets beroende på om de ser på creative FÖRE deploy, EFTER deploy, eller båda.

### 2.1 Retrospektiva analys-verktyg (vår bucket)

Dessa analyserar deployed creative och försöker förklara performance i efterhand. Det är vår faktiska konkurrens.

| Spelare | Depth | Performance-integration | Kort karaktäristik |
|---|---|---|---|
| **VidMob** | Hög | Hög | Enterprise-only ($50k+ kontrakt). Närmast vår produktform men prissatt för Fortune 500, inte för editor-team. |
| **Motion** | Låg–medel | Hög | Ad-spend dashboards + winning-ads library. $30M Series B 2024. Stark på attribution-tagging, svag på creative-struktur. |
| **Atria** | Medel | Medel | Nyare creative analytics för performance marketers. Mid-market pricing. |
| **Segwise** | Medel | Medel | Competitive intelligence + creative trend tracking. |
| **Foreplay** | Låg | Noll | Swipe-file / ad-library. Inspirationstool, inget analyslager. |

### 2.2 Prediktiva pre-flight-verktyg (angränsande kategori, INTE konkurrenter)

Dessa scorer creatives *innan* deploy och lovar "kommer den här fungera?". Vi är explicit inte dem, och det är en feature. Prediktion är vetenskapligt svårt och felaktiga prognoser skadar trovärdighet; retrospektiv förklaring är både mer tractable och mer användbar för learning-loop.

| Spelare | Ansats | Kort karaktäristik |
|---|---|---|
| **Memorable AI** | AI effectiveness-scoring | Pre-launch score per creative. Lab-feeling. |
| **Neurons** | Neuro-inspired prediction | Eye-tracking-baserade attention maps. Pre-flight only. |
| **System1** | Konsult + emotionell test | UK-baserad byrå-stil creative testing. Projektbaserat. |

**Strategisk implikation:** om kund frågar "förutspår ni vilken creative som vinner?" → svaret är nej, och det är medvetet. Vi förklarar *varför* dina existerande winners vann och losers förlorade, så dina editors ritar om nästa brief med evidens.

### 2.3 Vinnande kvadranten

*Deep retrospektiv analys × real performance-overlay × mid-market pricing × editor-accessible workflow.* VidMob har depth + perf men fel pris. Motion har perf men ytlig creative-struktur. Memorable/Neurons har depth men i prediktiv kategori. Vår wedge: research-grade retrospektiv analys (peer-reviewed metodik, hooks/beats/emotional arc/trust signals extraherade från creative + joinad mot faktisk ad-platform-data), prissatt för editor-team inte procurement.

## 3. Pricing landscape

Uppskattad kostnad per analyserad creative (konverterat från säte- eller kontraktsbaserad prissättning):

| Verktyg | ~ $/analys | Prismodell |
|---|---|---|
| Foreplay | $0.50 | Swipe-only, ingen analys |
| **Oss — Flash** | **$1** | 1 credit, analys + extended pass |
| **Oss — Pro** | **$3** | 3 credits, Pro-modell |
| Atria | $8 | Seat-based, uppskattat per analys |
| Motion | $12 | Seat-based $499+/mo |
| Segwise | $18 | Kontrakt, uppskattat |
| VidMob | $150 | Enterprise annual kontrakt |
| Memorable AI | $200 | Pre-flight scoring per creative |

**Prisbild:** Vi sitter en storleksordning under befintliga djupanalys-verktyg. $1 är under editorns psykologiska barriär (0.25% av en mid-tier UGC-produktion på $400, 0.00025% av en single-ad spend på $400k). $3 för Pro-analys är fortfarande <1% av produktionskostnad. Pris är inte beslutsfaktorn — kvalitet och workflow-fit är.

**Packaging-implikation av standup-invocation.** Rena credit-pooler ($500 = 500 credits) straffar selektivt användande — kunden kör färre analyser för att spara krediter, vilket är tvärtemot beteendet vi vill belöna (flagga high risers aggressivt och kör analyser utan friktion). Bättre modell är **Team Standup-plan**: seat-baserad access + pooled team credit-bank. Riktnivå att testa mot Ryze: `$500/mo = 5 seats + 200 Pro-credits pool` för mid-sized team (motsvarar ~60 Pro-analyser/mo utan att räkna på Flash-analyser), skalar upp till `$1500/mo = 15 seats + 600 credits` för större team. Seats är access-granting (alla i teamet kan se analyserna under standupen), credits är den rörliga komponenten som täcker faktisk analys-körning. Det gör MRR predictable för oss och analys-körning friktionsfri för dem.

## 4. Kundsegment

Användaren är sällan köparen. Två parallella motions behövs — båda byggda runt samma ceremoniyta: **veckans creative standup**.

### Adoption-ytan: creative standup

Produkten slots in i en ceremoni som redan existerar hos varje ICP-team. Den typiska Monday-morgon-cykeln ser ut så här:

1. **Pre-standup (söndag kväll / måndag morgon):** Head of Creative eller performance lead scannar förra veckans performance-data, identifierar 5–10 "high risers" (creatives som bröt baseline på retention, CTR eller ROAS). Drar CSV från Ads Manager om ingen OAuth finns.
2. **Standup (15–45 min):** teamet tittar på varje high riser med strukturell analys bredvid performance-kurvan. Diskussion fokuserar på *varför* — hook, emotional arc, trust signals, pacing. Mönster noteras i Notion / Slack / mötesnoter.
3. **Post-standup (samma vecka):** brief-skrivare inkluderar strukturella insikter i nästa brief. Editor-teamet producerar content mot de bevisade mönstren, inte mot någons magkänsla.

Produkten är alltså inte "analysera allt" utan "gör standupen evidensbaserad". Det sätter tydlig design-constraint: latens för Pro-analys måste tåla "kör 5–10 innan mötet" (≤30 min ideal, ≤2h acceptabelt), resultatet måste vara skärmdumps-vänligt och Notion/Slack-embeddable, och en "High Risers This Week"-surface som auto-föreslår kandidater är en naturlig adjacent-feature (retrospektiv alert, inte prediktion — stänger loopen mellan Motion/ads-dashboards som visar *vilka* ads som vann och oss som förklarar *varför*).

### Primära användare (ICP)

Editors — ~50k i US/EU DTC-segmentet, producerar 20–100 cuts/mo, smärtpunkter iterationshastighet + "varför vann den här varianten"; de är deltagarna i standupen och förstärker adoption genom att dela analyser internt. In-house creators och creative teams i Ryze-profilen (team på 10–60, mix av inspelning och klippning) är design partner-segmentet där standup-ceremonin är mest mogen och där hook-kunskap behöver skala över många editors.

### Buyers

DTC-brands med meaningful ad spend (>$50k/mo totalt, ofta $300–500k+ per vinnande enskild annons) räknas i ~20k adresserbara konton; Head of Growth eller CMO signerar, pris-range $500–2000/mo för team-plan, upp till $5000+/mo för multi-team enterprise. Beslutskriterier: CAC-effektivitet, time-to-winning-ad, kvalitet på brief-output. Creative/performance-byråer (~5k) utgör den andra halvan — white-label tryck, multi-brand-konton, pris-range $2–20k/mo, beslut styrt av differentiering i pitches och klientrapportering.

### Go-to-market-implikation

Bottom-up via editors ger låg friktion och virala workflows (editorer delar analyser internt tills brand-sidan signerar kontrakt). Top-down via buyers körs som outbound till Head of Growth vid brands med meningsfull spend, med pitchen "kostnad för att förklara en vinnande annons är 0.00025% av dess spend; en strukturell insikt som lyfter retention 10% är värd $40k på en $400k-annons." Ryze som design partner bevisar båda motions samtidigt — in-house team adopterar bottom-up, brand committerar top-down via DP-avtal.

**Pitchen som säljer produkten, inte kategorin:** *"Runs your weekly creative standup. Every Monday your team surfaces last week's high risers, runs retrospective analyses, and feeds structural patterns into the next brief. Average time-to-insight: 7 minutes."* Mer kopierbart än "analyserar alla era videos" och speglar exakt det beteende som redan finns i teamet.

## 5. Marknadsdrivare 2026

- **AI UGC-översvämning** — UGC-produktion har 44% YoY prisras (2024→2025) pga AI-generator-verktyg som Arcads, HeyGen, Captions. Volymen kreativa ökar, men signal-to-noise sjunker. Analytics blir viktigare, inte mindre.
- **iOS 17+ + privacy loss** — sämre attribution → mer vikt på creative-level signals för att förklara performance. Spelar rakt in i vårt värdeerbjudande.
- **TikTok-osäkerhet** — US-ban-hot pushar spend till Reels + Shorts. Verktyg som fungerar cross-platform (vår default) vinner.
- **Meta Advantage+ opacity** — automation döljer creative-decisions från köparen. Extern analys blir enda sättet att förstå vad som faktiskt sker.

## 6. Risker och kontra-argument

Ordnade efter faktisk sannolikhet × impact givet CSV-primär arkitektur. Tidigare versioner av denna sektion listade ad-platform API-beroende som existentiellt — den riskklassen stryks här eftersom CSV-primary path eliminerar hela beroendekedjan (se §0 ovan och `performance-ingestion-architecture.md` för hela resonemanget).

- **Matcher-kvalitet i messy verkliga data.** Matchern (creative asset → `analysis_id`) är core IP. Om den misslyckas på >10% av riktiga uploads utan att queue:a till editor-confirmation, tappar vi trovärdigheten — felaktiga joins ger felaktiga scorer-weights, och en enda felattribuerad $400k-annons saboterar hela brand-datasetet. Mitigering: (a) hög instrumentering från dag 1 — per-upload match-report, confidence histogram per workspace, (b) Ryze som kalibreringspartner — deras riktiga data tränar tröskelvärden innan vi skalar, (c) human-in-the-loop-confirmation för alla matches under 0.9 confidence.
- **Motion bygger djupare analys** — de har kapital ($30M) och distribution. Fönster att etablera wedge är ~12–18 månader. Deras styrka är attribution-dashboards, inte strukturell creative-analys; risken ökar om de rekryterar en research-lead och börjar publicera metodik.
- **Gemini prissänker eller försämrar video-stöd** — kan sänka vår COGS ytterligare (bra) eller tvinga modellbyte (dålig). Mitigering: håll modellval-abstraktion i kod.
- **Enterprise kommer ned-marknaden** — VidMob kan släppa billigare tier. Mitigering: vinn editor-loyalty innan det händer.
- **Agenturer bygger in-house** — stora byråer (Jellyfish, Dept, Tinuiti) kan bygga egna verktyg. Mitigering: positionera som "neutral infrastructure", sälj till dem som whitelabel snarare än konkurrent.
- **Attributions-förfall (iOS 17+, Advantage+)** — pushar kunder mot creative-level signals, vilket är bra för oss, MEN samma opacity gör det svårare att joina en specifik ad-leverans till faktisk uppspelning. Mitigering: analysera på creative-grupper (bucket-nivå) när single-ad-attribution är brusig.
- **Ad-platform OAuth-rör blir dyrare/svårare** — Meta app review stramar åt, TikTok ändrar API-surface, scope-deprecations. Impact: *låg* under CSV-primär arkitektur. OAuth är en P1-bekvämlighetslager, inte en förutsättning. Om Meta blockar oss helt kan kunden fortfarande exportera CSV. Mitigering: bygg adapters som isolerar platform-quirks, stötta brand-scoped OAuth med graceful-degradation till CSV.

## 7. Rekommendationer

1. **Land Ryze som design partner, hart.** Signed DP-avtal med 12-månaders 50% discount + IP-klargöring. Ryze är design partner-labbet: standup-driven usage model, $400k+ per enskild vinnande annons, 55 editors som genererar per-creative evidence med otrolig täthet. 40–160 high-riser-analyser/mo × joinad performance-data = det första research-grade retro-validation-datasetet. Värt mer än $10k/mo MRR från kalla leads det första halvåret.
2. **CSV + matchern är core IP, bygg den först.** Matchern (creative asset → `analysis_id`, se `performance-ingestion-architecture.md` §4) är den komponent som avgör om evidence-loopen fungerar. Bygg CSV-upload, template-library per platform-export, matcher med alla fyra strategier (explicit tag → hash → filename → heuristik), confidence-thresholds, och editor-facing confirmation-queue *före* allt annat. OAuth till Meta/TikTok är P1-bekvämlighetslager — den ersätter export-steget, den *möjliggör* inget som CSV inte redan levererar. Notion-plugin är leveransyta; matchern är produkten.
3. **Team-plan pricing.** Credit-based unit economics (94% Flash-marginal) är bekräftade. Men paketera som Team Standup-plan: seat-baserad access + pooled team credit-bank (riktnivå $500/mo = 5 seats + 200 Pro-credits) snarare än ren credit-meter. Skäl: standup-driven usage innebär selektiv körning av high risers, inte bulk-analys; ren credit-pool straffar selektivitet och ger oförutsägbar MRR. Se §3 "Packaging-implikation av standup-invocation" ovan.
4. **Publicera metodiken som moat.** Peer-reviewed-refererad whitepaper om hur ECR/NAWP/BeatMap/emotionalArc opererar subjektivt creative-tyckande till mätbara features, plus retro-validation mot faktisk performance. Med $400k+ i single-ad spend är varje retro-validerat case study flaggskeppsklass. Varje publicerat case-study (struktur → performance-join → retro-validering) är värt 20 kalla leads. Editor-first tone, CFO-citerbar evidence.
5. **"Runs your weekly creative standup" som GTM-pitch.** Positionera produkten runt en ceremoni kunden redan äger (creative standup), inte runt en kapabilitet de aldrig bad om ("analyserar alla era videos"). Adjacent-feature: **High Risers This Week** — en automatisk måndag-morgon-surface som listar veckans creatives som bröt baseline och erbjuder en-klicks-analys. Det är retrospektiv alert (inte prediktion), det stänger loopen mellan Motion-dashboards (*vilka* ads vann) och oss (*varför* de vann), och det gör plattformen sticky utan att bli en dashboard-klon.
6. **Publicera första retro-validerade case study inom 90 dagar från DP-start.** Med Ryze's spend-täthet har du evidence nog för en whitepaper efter en handfull analyser — det är GTM-raketbränsle som inte ens VidMob har kunnat publicera (deras enterprise-NDA:er stänger ner casen). Mät differentiating claim mot Motion och VidMob i head-to-head på en betalande kunds backkatalog: "vi kan peka på *vilken struktur* i dina winners som driver performance — inte bara vilka ads som vann."

## 8. Öppna frågor för nästa session

- **CSV-export-cadence hos Ryze idag:** hur ofta exporterar de performance-data från Meta Ads Manager / TikTok Ads Manager? Veckovis under standup-prep? Mer sällan? Svaret avgör hur friktionsfritt CSV-primär pathen känns vs. hur snabbt OAuth-upgrade blir önskad.
- **Ryze's standup-ceremoni konkret:** hur ser creative standup ut idag? Frekvens, deltagare, verktyg, vilka creatives diskuteras, hur surfas performance-data? Designen av "High Risers This Week"-featuren och analys-UX:en bör byggas runt deras riktiga ceremony, inte vår gissning om den.
- **Creative-ID-mappning:** hur konsekvent taggar Ryze sina uppladdningar till ad-platform-creatives idag? Om mappningen är manuell (troligt) behöver matchern kalibreras mot deras faktiska filename-konventioner. Fråga om 5–10 exempel-filnamn × hur de återfinns i Ads Manager-exporten.
- **Attribution-fönster:** vilken standard ska vi använda för "winner vs loser" retrospektivt? 7d click / 1d view? Första 72h retention? Med $400k+ per single ad är statistisk kraft inte problemet — frågan är vilken definition av "vinnare" som är mest actionable för editor-teamet.
- **Faktisk high-riser-volym hos Ryze:** hur många creatives per vecka bryter baseline tillräckligt för att vara värda standup-diskussion? 5? 15? 40? Svaret sätter storleken på Team Standup credit-poolens default och avgör om latens för Pro-analys (≤30 min vs ≤2h) är en hård eller mjuk constraint.
- **Quarterly case study-commit:** 50% discount mot ett citerbart retrospektivt resultat (t.ex. "när hook-struktur X applicerades i 12 cuts över 6 veckor steg genomsnittlig 3s-retention med Y%"). Med $400k+ per vinnande annons är ett enda retro-validerat case study potentiellt flagship-class GTM-content.
