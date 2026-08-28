import { CURSARE_DOCUMENT_LIMITS, CURSARE_DOCUMENT_VERSION, type CursareDocument } from "./schema"

export interface AuthoringNodeSpec {
  type: string
  syntax: string
  purpose: string
  guidance: string
  stableIds: string[]
  payloadSchema?: Record<string, unknown>
  example: string
}

export interface AuthoringGuide {
  version: 1
  dialect: "cursare-markdown-v1"
  overview: string
  documentSchema: Record<string, unknown>
  documentRules: {
    markdown: string
    canonicalization: string[]
    limits: typeof CURSARE_DOCUMENT_LIMITS
    ids: string
  }
  compositionGuidelines: string[]
  layout: AuthoringNodeSpec[]
  minimalDocument: CursareDocument
  completeDocument: CursareDocument
  marks: Array<{ type: string; syntax: string; description: string }>
  nodes: AuthoringNodeSpec[]
  invalidExamples: Array<{ reason: string; body: string }>
}

const stableId = {
  type: "string",
  pattern: "^[A-Za-z0-9][A-Za-z0-9:_-]*$",
  description: "A unique stable id. Preserve it when editing an existing document.",
}

const text = { type: "string" }
const url = {
  type: "string",
  maxLength: 2_048,
  description: "A safe HTTPS URL or an application-relative path when supported.",
}

function objectSchema(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

const titleAndDescription = {
  title: { ...text, description: "Plain-text block title written in a :::title field." },
  description: {
    ...text,
    description: "Accessible Markdown description written in a :::description field.",
  },
}

export const authoringGuide: AuthoringGuide = {
  version: 1,
  dialect: "cursare-markdown-v1",
  overview:
    "Generate one canonical Markdown source. Its first three blocks are exactly one cover directive, one level-one title and one description directive in any order; all remaining blocks are authored content. Preserve every stable id. Component fields are readable directives and attributes, never embedded JSON. Never emit editor state, HTML, task lists or undocumented directives.",
  documentSchema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["version", "markdown"],
    properties: {
      version: { const: CURSARE_DOCUMENT_VERSION },
      markdown: {
        type: "string",
        maxLength: CURSARE_DOCUMENT_LIMITS.maxBytes,
        description: "The complete canonical Cursare Markdown document.",
      },
    },
  },
  documentRules: {
    markdown:
      "Start with exactly one `:::cursare-cover`, one `# Title` and one `:::cursare-description` in any order. Then use CommonMark paragraphs, level 2–6 headings, blockquotes, thematic breaks, fenced code, links, images, bullet/numbered lists and GFM tables/strikethrough. Every body heading needs `{#section-id}`. A paragraph learner anchor uses `Text {#anchor-id}`; other ordinary blocks use `:::cursare-anchor{#anchor-id}`.",
    canonicalization: [
      "UTF-8 and LF line endings",
      "One blank line between blocks and no trailing blank lines",
      "Dash bullets, fenced code blocks, asterisk emphasis and strong marks",
      "Directive attributes sorted lexicographically",
      "Title, description and resource URLs trimmed",
      "Cover, title and description order preserved directly by Markdown block order",
    ],
    limits: CURSARE_DOCUMENT_LIMITS,
    ids: "Stable ids key progress, answers, votes and references. Preserve them on edits. New ids must be unique ASCII identifiers. Activities require unique question/item ids and option ids; references, steps and headings require stable ids.",
  },
  compositionGuidelines: [
    "Give each section one clear learning purpose and use descriptive level 2–6 headings in a logical hierarchy.",
    "Prefer short paragraphs, ordinary lists and examples for the main explanation. Use a callout only when the information deserves special emphasis.",
    "Use steps only for a genuine sequence. Do not use them as decorative cards or as a substitute for headings.",
    "Place a poll or quiz after the explanation it practices. Polls and quizzes must be top-level blocks, never nested inside callouts or steps.",
    "Give images meaningful alternative text, media a useful title or description, and links labels that make sense out of context.",
    "Do not invent content ids, media URLs or reference targets. Resolve existing ids and upload assets before inserting them.",
    "Preserve the document language, authorial tone, accessibility text and every stable id unless the publisher explicitly requests a change.",
  ],
  layout: [
    {
      type: "cover",
      syntax:
        ':::cursare-cover{src="https://images.example.com/course-cover.webp"}\nAccessible cover description\n:::',
      purpose: "The single canonical cover image for the content.",
      guidance:
        "Keep it within the first three blocks. Use an empty directive when there is no cover and always provide meaningful alternative text when src is present.",
      stableIds: [],
      payloadSchema: objectSchema({
        src: url,
        assetId: { ...text, description: "Existing organization asset id when available." },
        width: { type: "integer", minimum: 1 },
        height: { type: "integer", minimum: 1 },
        mimeType: text,
        focalX: { type: "number", minimum: 0, maximum: 1 },
        focalY: { type: "number", minimum: 0, maximum: 1 },
        creatorName: text,
        creatorUrl: url,
        sourceUrl: url,
        alt: { ...text, description: "Readable directive body, not an attribute." },
      }),
      example:
        ':::cursare-cover{src="https://images.example.com/feedback-loop.webp"}\nA learner reviewing a feedback loop diagram\n:::',
    },
    {
      type: "title",
      syntax: "# Course title",
      purpose: "The single level-one title of the content.",
      guidance:
        "Keep it within the first three blocks. Body sections start at level two and require stable ids.",
      stableIds: [],
      payloadSchema: objectSchema({ value: text }, ["value"]),
      example: "# Build useful feedback loops",
    },
    {
      type: "description",
      syntax: ":::cursare-description\nA concise promise for the learner.\n:::",
      purpose: "The single canonical summary shown before the authored body.",
      guidance:
        "Keep it within the first three blocks and write one concise, learner-facing description.",
      stableIds: [],
      payloadSchema: objectSchema({ value: text }, ["value"]),
      example:
        ":::cursare-description\nLearn to design feedback that leads to a clear next action.\n:::",
    },
  ],
  minimalDocument: {
    version: 1,
    markdown:
      ":::cursare-cover\n:::\n\n# Cursare platform demo\n\n:::cursare-description\nBuild, publish and teach from one portable document.\n:::\n\n## Start here {#start-here}\n\nWrite the lesson in **portable Markdown**.",
  },
  completeDocument: {
    version: 1,
    markdown: `:::cursare-cover{src="https://images.example.com/feedback-loop.webp"}
A learner reviewing a feedback loop diagram
:::

# Build useful feedback loops

:::cursare-description
Learn to turn observations into feedback that leads to a clear next action.
:::

## Begin with evidence {#begin-with-evidence}

Describe what happened before interpreting why it happened. Keep the observation specific enough that another person could recognize it.

::::callout{variant="info"}
:::title
Keep evidence separate from judgment
:::

“The draft arrived on Tuesday” is observable. “The team does not care” is an interpretation.
::::

## Use a simple sequence {#simple-sequence}

:::::steps
::::step{#feedback-observe}
:::title
Observe
:::

Name the behavior or result without assigning intent.
::::

::::step{#feedback-connect}
:::title
Connect
:::

Explain the concrete impact on the learner, team or outcome.
::::

::::step{#feedback-agree}
:::title
Agree
:::

Choose one next action and decide when to review it.
::::
:::::

## Check your understanding {#check-understanding}

:::::cursare-quiz{reveal="1"}
:::title
Evidence or interpretation?
:::

:::description
Choose the statement that can be directly observed.
:::

::::question{#feedback-question-evidence}
:::prompt
Which statement is observable?
:::

:::option{#feedback-answer-observable correct="true"}
The draft arrived on Tuesday
:::

:::option{#feedback-answer-judgment}
The team does not care
:::
::::
:::::`,
  },
  marks: [
    { type: "bold", syntax: "**text**", description: "Strong importance." },
    { type: "italic", syntax: "*text*", description: "Emphasis." },
    { type: "strike", syntax: "~~text~~", description: "GFM deletion." },
    { type: "code", syntax: "`code`", description: "Inline code." },
    {
      type: "link",
      syntax: "[label](https://example.com)",
      description: "Safe HTTP(S), mailto, tel, fragment or relative link.",
    },
    { type: "underline", syntax: ":underline[text]", description: "Underlined semantic." },
    {
      type: "highlight",
      syntax: ':highlight[text]{color="#ffee88"}',
      description: "Highlighted semantic with an explicit color.",
    },
    {
      type: "color",
      syntax: ':color[text]{color="#334455"}',
      description: "Text color semantic.",
    },
    {
      type: "glossary",
      syntax: ':glossary[Term]{definition="Definition"}',
      description: "Accessible glossary definition.",
    },
    {
      type: "math-inline",
      syntax: ':math-inline{latex="x^2"}',
      description: "Inline mathematical notation.",
    },
  ],
  nodes: [
    {
      type: "anchor",
      syntax: ":::cursare-anchor{#example-anchor}\n> One ordinary block.\n:::",
      purpose: "Adds learner identity to an ordinary block that has no native id syntax.",
      guidance:
        "Use it only when an ordinary block must be addressable for progress or notes. It must wrap exactly one block.",
      stableIds: ["id"],
      payloadSchema: objectSchema({ id: stableId }, ["id"]),
      example: ":::cursare-anchor{#evidence-example}\n> Evidence describes what happened.\n:::",
    },
    {
      type: "callout",
      syntax: '::::callout{variant="info"}\n:::title\nRemember\n:::\n\nMarkdown\n::::',
      purpose: "A titled note, warning, tip or example.",
      guidance:
        "Use sparingly for information that deserves emphasis; keep the main lesson narrative outside callouts.",
      stableIds: ["id when supplied"],
      payloadSchema: objectSchema({
        id: stableId,
        title: titleAndDescription.title,
        variant: { type: "string", enum: ["info", "success", "warning", "danger"] },
      }),
      example:
        '::::callout{variant="success"}\n:::title\nTry it\n:::\n\nPublish a draft before sharing.\n::::',
    },
    {
      type: "table",
      syntax:
        '::::table{columnWidths="140 220" learnerAnchorId="comparison-table"}\n:::title\nComparison\n:::\n\n| Feature | Purpose   |\n| ------- | --------- |\n| Content | Authoring |\n::::',
      purpose: "A titled GFM table with optional column widths and learner identity.",
      guidance: "Use for compact comparisons and structured facts, never for visual page layout.",
      stableIds: ["learnerAnchorId when supplied"],
      payloadSchema: objectSchema({
        learnerAnchorId: stableId,
        ...titleAndDescription,
        columnWidths: {
          type: "string",
          pattern: "^[1-9][0-9]*(?: [1-9][0-9]*)*$",
          description: "Space-separated positive widths matching the table columns.",
        },
      }),
      example:
        '::::table{columnWidths="140 220" learnerAnchorId="content-model-table"}\n:::title\nContent model\n:::\n\n:::description\nA compact comparison of the main entities.\n:::\n\n| Entity  | Responsibility |\n| ------- | -------------- |\n| Content | Authoring      |\n| Offer   | Delivery       |\n::::',
    },
    {
      type: "steps",
      syntax: ":::::steps\n::::step{#step-a}\n:::title\nTitle\n:::\n\nMarkdown\n::::\n:::::",
      purpose: "The only ordered presentation container.",
      guidance: "Use only for a genuine sequence and include at least one titled step.",
      stableIds: ["steps.id when supplied", "step.id"],
      payloadSchema: objectSchema({ id: stableId, ...titleAndDescription }),
      example:
        ":::::steps\n::::step{#draft}\n:::title\nDraft\n:::\n\nWrite once.\n::::\n\n::::step{#publish}\n:::title\nPublish\n:::\n\nValidate and release.\n::::\n:::::",
    },
    {
      type: "step",
      syntax: ":::::steps\n::::step{#step-a}\n:::title\nTitle\n:::\n\nMarkdown\n::::\n:::::",
      purpose: "One titled item inside a steps container.",
      guidance: "Keep it directly inside steps; steps cannot be nested inside another step.",
      stableIds: ["id"],
      payloadSchema: objectSchema({ id: stableId, title: titleAndDescription.title }, [
        "id",
        "title",
      ]),
      example:
        ":::::steps\n::::step{#observe}\n:::title\nObserve\n:::\n\nDescribe what happened.\n::::\n:::::",
    },
    {
      type: "image",
      syntax:
        '::::cursare-image{#image-a src="https://images.example.com/example.webp"}\n:::title\nOptional title\n:::\n\n:::description\nMeaningful alternative text.\n:::\n::::',
      purpose: "A block image with accessible description and optional attribution metadata.",
      guidance:
        "Use a real uploaded or safe HTTPS image and describe its meaning; do not repeat a nearby caption word for word.",
      stableIds: ["id when supplied"],
      payloadSchema: objectSchema(
        {
          id: stableId,
          src: url,
          assetId: text,
          width: { type: "integer", minimum: 1 },
          height: { type: "integer", minimum: 1 },
          mimeType: text,
          focalX: { type: "number", minimum: 0, maximum: 1 },
          focalY: { type: "number", minimum: 0, maximum: 1 },
          creatorName: text,
          creatorUrl: url,
          sourceUrl: url,
          ...titleAndDescription,
        },
        ["src"],
      ),
      example:
        '::::cursare-image{#feedback-cycle src="https://images.example.com/feedback-cycle.webp"}\n:::title\nFeedback cycle\n:::\n\n:::description\nThree arrows connect observation, impact and next action in a continuous cycle.\n:::\n::::',
    },
    {
      type: "video",
      syntax:
        '::::cursare-video{#video-a provider="youtube" src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"}\n:::title\nLesson video\n:::\n\n:::description\nWhat the learner should notice.\n:::\n::::',
      purpose: "A supported YouTube, Vimeo, HLS or direct video resource.",
      guidance:
        "Use a provider that matches the URL and add a title or description that explains the learning purpose.",
      stableIds: ["id when supplied"],
      payloadSchema: objectSchema(
        {
          id: stableId,
          src: url,
          provider: { type: "string", enum: ["file", "hls", "youtube", "vimeo"] },
          ...titleAndDescription,
        },
        ["src", "provider"],
      ),
      example:
        '::::cursare-video{#video-feedback provider="youtube" src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"}\n:::title\nFeedback in practice\n:::\n\n:::description\nNotice how the speaker separates observation from judgment.\n:::\n::::',
    },
    {
      type: "audio",
      syntax:
        '::::cursare-audio{#audio-a src="https://files.example.com/reflection.mp3"}\n:::title\nGuided reflection\n:::\n\n:::description\nA short audio exercise.\n:::\n::::',
      purpose: "A supported direct audio-file resource.",
      guidance: "Use a direct audio URL and explain what the learner will hear or do.",
      stableIds: ["id when supplied"],
      payloadSchema: objectSchema({ id: stableId, src: url, ...titleAndDescription }, ["src"]),
      example:
        '::::cursare-audio{#audio-reflection src="https://files.vidstack.io/sprite-fight/audio.mp3"}\n:::title\nGuided reflection\n:::\n\n:::description\nPause and identify one observation from your latest project.\n:::\n::::',
    },
    {
      type: "file",
      syntax:
        '::::cursare-file{name="worksheet.pdf" url="/files/worksheet.pdf"}\n:::title\nWorksheet\n:::\n\n:::description\nDownloadable practice sheet.\n:::\n::::',
      purpose: "A downloadable file attachment.",
      guidance: "Use a real organization file and provide a human-readable name and purpose.",
      stableIds: ["id when supplied"],
      payloadSchema: objectSchema(
        {
          id: stableId,
          url,
          name: text,
          mime: text,
          size: { type: "integer", minimum: 0 },
          ...titleAndDescription,
        },
        ["url", "name"],
      ),
      example:
        '::::cursare-file{mime="application/pdf" name="feedback-worksheet.pdf" size="2048" url="/examples/feedback-worksheet.pdf"}\n:::title\nFeedback worksheet\n:::\n\n:::description\nUse this sheet to prepare one feedback conversation.\n:::\n::::',
    },
    {
      type: "embed",
      syntax:
        '::::cursare-embed{src="https://stackblitz.com/edit/typescript?embed=1"}\n:::title\nInteractive example\n:::\n\n:::description\nA supported external activity.\n:::\n::::',
      purpose: "An interactive StackBlitz, CodeSandbox, CodePen, Figma, Desmos or GeoGebra embed.",
      guidance: "Use only a supported provider and explain what the learner should explore.",
      stableIds: ["id when supplied"],
      payloadSchema: objectSchema({ id: stableId, src: url, ...titleAndDescription }, ["src"]),
      example:
        '::::cursare-embed{#feedback-prototype src="https://stackblitz.com/edit/typescript?embed=1"}\n:::title\nInteractive feedback form\n:::\n\n:::description\nExplore how each field makes the next action more specific.\n:::\n::::',
    },
    {
      type: "diagram",
      syntax:
        "::::cursare-diagram{#diagram-a}\n:::title\nFlow\n:::\n\n:::description\nAccessible explanation of the diagram.\n:::\n\n:::source\ngraph TD; A-->B\n:::\n::::",
      purpose: "A Mermaid-style diagram source with an accessible description.",
      guidance:
        "Keep the graph small enough to read and make the description communicate the same essential relationship.",
      stableIds: ["id when supplied"],
      payloadSchema: objectSchema({ id: stableId, source: text, ...titleAndDescription }, [
        "source",
      ]),
      example:
        "::::cursare-diagram{#feedback-diagram}\n:::title\nFeedback loop\n:::\n\n:::description\nObservation leads to impact, which leads to an agreed next action.\n:::\n\n:::source\ngraph LR; Observe-->Impact; Impact-->Action; Action-->Observe\n:::\n::::",
    },
    {
      type: "math",
      syntax:
        "::::cursare-math{#formula-a}\n:::title\nFormula\n:::\n\n:::description\nAccessible explanation.\n:::\n\n:::latex\nx^2\n:::\n::::",
      purpose: "A display-math block with LaTeX source.",
      guidance: "Explain the variables in nearby prose or in the accessible description.",
      stableIds: ["id when supplied"],
      payloadSchema: objectSchema({ id: stableId, latex: text, ...titleAndDescription }, ["latex"]),
      example:
        "::::cursare-math{#formula-feedback-rate}\n:::title\nFeedback completion rate\n:::\n\n:::description\nCompleted feedback loops divided by started feedback loops.\n:::\n\n:::latex\nR = \\frac{completed}{started}\n:::\n::::",
    },
    {
      type: "poll",
      syntax:
        "::::cursare-poll{#poll-a}\n:::title\nReflection\n:::\n\n:::description\nChoose the option closest to your experience.\n:::\n\n:::question\nQuestion\n:::\n\n:::option{#option-a}\nFirst option\n:::\n\n:::option{#option-b}\nSecond option\n:::\n::::",
      purpose: "An ungraded top-level vote with aggregation.",
      guidance: "Use for reflection or opinion, never when one answer must be graded as correct.",
      stableIds: ["poll id", "every option id"],
      payloadSchema: objectSchema(
        {
          id: stableId,
          ...titleAndDescription,
          question: text,
          options: {
            type: "array",
            minItems: 2,
            maxItems: CURSARE_DOCUMENT_LIMITS.maxCollectionItems,
            items: objectSchema({ id: stableId, text }, ["id", "text"]),
          },
        },
        ["id", "question", "options"],
      ),
      example:
        "::::cursare-poll{#poll-feedback-focus}\n:::title\nChoose a focus\n:::\n\n:::description\nThere is no correct answer.\n:::\n\n:::question\nWhich part of feedback is hardest?\n:::\n\n:::option{#poll-observation}\nObservation\n:::\n\n:::option{#poll-next-action}\nNext action\n:::\n::::",
    },
    {
      type: "quiz",
      syntax:
        ':::::cursare-quiz{reveal="1"}\n:::title\nKnowledge check\n:::\n\n:::description\nApply the idea from this section.\n:::\n\n::::question{#question-a}\n:::prompt\nQuestion\n:::\n\n:::option{#option-a}\nWrong\n:::\n\n:::option{#option-b correct="true"}\nCorrect\n:::\n::::\n:::::',
      purpose: "A graded top-level quiz with one or more multiple-choice questions.",
      guidance:
        "Use after teaching the concept, write plausible options and mark exactly one correct option per question.",
      stableIds: ["quiz id when supplied", "every question id", "every option id"],
      payloadSchema: objectSchema(
        {
          id: stableId,
          reveal: { type: "integer", minimum: 1 },
          ...titleAndDescription,
          questions: {
            type: "array",
            minItems: 1,
            maxItems: CURSARE_DOCUMENT_LIMITS.maxCollectionItems,
            items: objectSchema(
              {
                id: stableId,
                prompt: text,
                options: {
                  type: "array",
                  minItems: 2,
                  items: objectSchema({ id: stableId, text, correct: { type: "boolean" } }, [
                    "id",
                    "text",
                  ]),
                },
              },
              ["id", "prompt", "options"],
            ),
          },
        },
        ["questions"],
      ),
      example:
        ':::::cursare-quiz{#quiz-feedback reveal="1"}\n:::title\nCheck your understanding\n:::\n\n:::description\nChoose the observable statement.\n:::\n\n::::question{#question-observable}\n:::prompt\nWhich statement is evidence?\n:::\n\n:::option{#answer-evidence correct="true"}\nThe draft arrived on Tuesday\n:::\n\n:::option{#answer-judgment}\nThe team does not care\n:::\n::::\n:::::',
    },
    {
      type: "reference",
      syntax:
        '::::cursare-reference{#module-a afterHours="72" dripAnchor="enroll" routeSegment="module-a" targetContentId="content-id"}\n:::title\nModule title\n:::\n\n:::description\nWhat the learner will study next.\n:::\n::::',
      purpose: "A recursive link to another content with parent-owned pacing metadata.",
      guidance:
        "Resolve a real same-organization content id first. Preserve the block id and never create a reference cycle.",
      stableIds: ["id"],
      payloadSchema: objectSchema(
        {
          id: stableId,
          targetContentId: text,
          routeSegment: {
            type: "string",
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          },
          title: titleAndDescription.title,
          description: titleAndDescription.description,
          afterHours: { type: "integer", minimum: 1 },
          dripAnchor: { type: "string", enum: ["enroll", "prev"] },
          requires: {
            type: "string",
            description: "Optional comma-separated stable ids required before release.",
          },
        },
        ["id", "targetContentId", "routeSegment", "title"],
      ),
      example:
        '::::cursare-reference{#advanced-feedback afterHours="72" dripAnchor="enroll" routeSegment="advanced-feedback" targetContentId="019f-example"}\n:::title\nAdvanced feedback patterns\n:::\n\n:::description\nContinue after practicing the basic feedback loop.\n:::\n::::',
    },
  ],
  invalidExamples: [
    { reason: "Task lists are stateful and unsupported.", body: "- [ ] Hidden state" },
    { reason: "Raw HTML is not portable.", body: '<iframe src="https://example.com"></iframe>' },
    {
      reason: "Opaque component payload attributes are not part of the Markdown dialect.",
      body: ':::cursare-poll{payload="opaque"}\n:::',
    },
    {
      reason: "Polls and quizzes must be top-level blocks.",
      body: ':::::callout{variant="info"}\n::::cursare-poll{#nested}\n::question[Question]\n::option[A]{#a}\n::option[B]{#b}\n::::\n:::::',
    },
  ],
}
