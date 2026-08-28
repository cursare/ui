export const LEARNER_FAMILIES = [
  "flow",
  "aside",
  "technical",
  "media",
  "practice",
  "navigation",
  "enrollment",
  "engagement",
  "journey",
] as const

export const LEARNER_SURFACES = [
  "plain",
  "tinted",
  "data",
  "technical",
  "media",
  "activity",
  "overlay",
] as const

export const LEARNER_CONTAINMENTS = ["none", "semantic"] as const
export const LEARNER_MEASURES = ["inline", "prose", "wide", "media", "page"] as const
export const LEARNER_EFFECTS = ["trace", "focus", "lift", "reveal", "milestone"] as const
export const LEARNER_THEME_ROLES = [
  "neutral",
  "content-accent",
  "semantic-state",
  "source-owned",
] as const
export const LEARNER_TRANSITIONS = [
  "enter",
  "focus",
  "select",
  "reveal",
  "progress",
  "pickup",
  "reorder",
  "settle",
  "feedback",
  "milestone",
  "navigate",
] as const

export const LEARNER_ADDRESSABLE_NODE_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "table",
  "codeBlock",
  "callout",
  "horizontalRule",
  "image",
  "video",
  "fileAttachment",
  "reference",
  "questionPool",
  "steps",
  "diagram",
  "mathBlock",
  "audio",
  "embed",
  "poll",
] as const

export const LEARNER_STRUCTURAL_NODE_TYPES = [
  "step",
  "tableCell",
  "tableHeader",
  "tableRow",
] as const

export type LearnerFamily = (typeof LEARNER_FAMILIES)[number]
export type LearnerSurface = (typeof LEARNER_SURFACES)[number]
export type LearnerContainment = (typeof LEARNER_CONTAINMENTS)[number]
export type LearnerMeasure = (typeof LEARNER_MEASURES)[number]
export type LearnerEffect = (typeof LEARNER_EFFECTS)[number]
export type LearnerThemeRole = (typeof LEARNER_THEME_ROLES)[number]
export type LearnerTransition = (typeof LEARNER_TRANSITIONS)[number]
export type LearnerComponentOwner = "runtime" | "reader" | "blocks" | "web-adapter"
export type LearnerContainmentReason =
  | "activity-work-area"
  | "contextual-aside"
  | "data-boundary"
  | "destination-card"
  | "media-frame"
  | "technical-context"
  | "temporary-overlay"

type RuntimeLearnerComponentKey =
  | `runtime.flow.${"prose" | "lists" | "blockquote" | "rule" | "table" | "inline"}`
  | `runtime.aside.${"callout" | "steps"}`
  | `runtime.technical.${"code-block" | "math" | "diagram"}`
  | `runtime.media.${"image" | "video" | "audio" | "embed"}`
  | `runtime.practice.${"poll" | "quiz"}`
  | `runtime.navigation.${"file" | "reference"}`

type BlocksLearnerComponentKey = `blocks.${
  | "course-card"
  | "course-hero-card"
  | "course-catalog"
  | "course-hero"
  | "course-outline"
  | "course-player"
  | "course-shell"
  | "curriculum-journey"
  | "enrolled-course-home"
  | "intake-form-header"
  | "intake-fields"
  | "learner-home"
  | "study-resource-list"
  | "study-tools"}`

type WebLearnerComponentKey = `web.${
  | "organization-header"
  | "learner-header"
  | "storefront-hero-search"
  | "storefront-shelves"
  | "storefront-topic-filters"
  | "storefront-recommendations"
  | "storefront-empty-footer"
  | "campaign-access-status"
  | "offer-picker"
  | "cohort-picker"
  | "enroll-controls"
  | "checkout-notice"
  | "rating-social-proof"
  | "review-section"
  | "review-dialog"
  | "share-dialog"
  | "discussion-feed"
  | "learner-notes"
  | "continuation"
  | "completion"
  | "certificate"}`

export type LearnerComponentKey =
  | RuntimeLearnerComponentKey
  | BlocksLearnerComponentKey
  | WebLearnerComponentKey

export interface LearnerComponentContract {
  key: LearnerComponentKey
  owner: LearnerComponentOwner
  ownedNodes: readonly string[]
  family: LearnerFamily
  surface: LearnerSurface
  containment: LearnerContainment
  containmentReason: LearnerContainmentReason | null
  measure: LearnerMeasure
  themeRoles: readonly LearnerThemeRole[]
  anatomy: readonly string[]
  states: readonly string[]
  effects: readonly LearnerEffect[]
  motionRequiredFor: Readonly<Partial<Record<LearnerTransition, LearnerEffect>>>
  interactions: readonly string[]
  accessibility: readonly string[]
  responsive: readonly string[]
  locales: "none" | "en-pt-es"
  fixtures: readonly string[]
  checks: readonly string[]
}

interface ComponentInput {
  key: LearnerComponentKey
  owner: LearnerComponentOwner
  ownedNodes?: readonly string[]
  family: LearnerFamily
  surface: LearnerSurface
  containmentReason?: LearnerContainmentReason
  measure: LearnerMeasure
  anatomy: readonly string[]
  states?: readonly string[]
  effects?: readonly LearnerEffect[]
  interactions?: readonly string[]
  themeRoles?: readonly LearnerThemeRole[]
  locales?: "none" | "en-pt-es"
}

const CONTAINMENT_REASON: Record<Exclude<LearnerSurface, "plain">, LearnerContainmentReason> = {
  activity: "activity-work-area",
  data: "data-boundary",
  media: "media-frame",
  overlay: "temporary-overlay",
  technical: "technical-context",
  tinted: "contextual-aside",
}

const EFFECT_TRANSITION: Record<LearnerEffect, LearnerTransition> = {
  focus: "focus",
  lift: "pickup",
  milestone: "milestone",
  reveal: "reveal",
  trace: "progress",
}

function containmentReason(surface: LearnerSurface): LearnerContainmentReason | null {
  return surface === "plain" ? null : CONTAINMENT_REASON[surface]
}

function component(input: ComponentInput): LearnerComponentContract {
  const effects = input.effects ?? []
  const states = input.states ?? ["default", "long-content"]
  const interactions = input.interactions ?? ["passive"]
  const reason = input.containmentReason ?? containmentReason(input.surface)
  return Object.freeze({
    key: input.key,
    owner: input.owner,
    ownedNodes: Object.freeze([...(input.ownedNodes ?? [])]),
    family: input.family,
    surface: input.surface,
    containment: reason ? "semantic" : "none",
    containmentReason: reason,
    measure: input.measure,
    themeRoles: Object.freeze([
      ...(input.themeRoles ?? ["neutral", "content-accent", "semantic-state"]),
    ]),
    anatomy: Object.freeze([...input.anatomy]),
    states: Object.freeze([...states]),
    effects: Object.freeze([...effects]),
    motionRequiredFor: Object.freeze(
      Object.fromEntries(effects.map((effect) => [EFFECT_TRANSITION[effect], effect])),
    ),
    interactions: Object.freeze([...interactions]),
    accessibility: Object.freeze([
      "semantic-html",
      "visible-focus-when-interactive",
      "color-independent-state",
    ]),
    responsive: Object.freeze(["320-no-page-overflow", "200-percent-zoom", "long-copy-reflow"]),
    locales: input.locales ?? "en-pt-es",
    fixtures: Object.freeze([...states]),
    checks: Object.freeze([
      "semantic",
      "keyboard-when-interactive",
      "capture-1440-light",
      "capture-1440-dark",
      "capture-360-light",
      "theme-cascade",
      ...(interactions.includes("passive") ? [] : ["capture-active-settled"]),
      ...(effects.length ? ["capture-reduced-motion"] : []),
    ]),
  })
}

export const learnerComponentRegistry = Object.freeze([
  component({
    key: "runtime.flow.prose",
    owner: "runtime",
    ownedNodes: ["paragraph", "heading"],
    family: "flow",
    surface: "plain",
    measure: "prose",
    anatomy: ["content"],
  }),
  component({
    key: "runtime.flow.lists",
    owner: "runtime",
    ownedNodes: ["bulletList", "orderedList"],
    family: "flow",
    surface: "plain",
    measure: "prose",
    anatomy: ["items"],
    effects: ["focus"],
  }),
  component({
    key: "runtime.flow.blockquote",
    owner: "runtime",
    ownedNodes: ["blockquote"],
    family: "flow",
    surface: "plain",
    measure: "prose",
    anatomy: ["quote", "optional-attribution"],
  }),
  component({
    key: "runtime.flow.rule",
    owner: "runtime",
    ownedNodes: ["horizontalRule"],
    family: "flow",
    surface: "plain",
    measure: "prose",
    anatomy: ["separator"],
  }),
  component({
    key: "runtime.flow.table",
    owner: "runtime",
    ownedNodes: ["table", "tableRow", "tableHeader", "tableCell"],
    family: "flow",
    surface: "data",
    measure: "wide",
    anatomy: ["scroll-region", "grid", "headers", "cells"],
    effects: ["focus"],
    interactions: ["bounded-horizontal-scroll"],
  }),
  component({
    key: "runtime.flow.inline",
    owner: "runtime",
    ownedNodes: ["link", "code", "mathInline", "glossaryTerm"],
    family: "flow",
    surface: "plain",
    measure: "inline",
    anatomy: ["trigger-or-content", "optional-overlay"],
    states: ["default", "hover", "focus", "open", "long-content"],
    effects: ["focus", "reveal"],
    interactions: ["activate", "dismiss-overlay", "restore-focus"],
  }),
  component({
    key: "runtime.aside.callout",
    owner: "runtime",
    ownedNodes: ["callout"],
    family: "aside",
    surface: "tinted",
    measure: "wide",
    anatomy: ["wide-tinted-surface", "vector-icon", "prose-body"],
  }),
  component({
    key: "runtime.aside.steps",
    owner: "runtime",
    ownedNodes: ["steps", "step"],
    family: "aside",
    surface: "plain",
    measure: "wide",
    anatomy: ["spine", "markers", "headings", "bodies"],
    effects: ["trace"],
  }),
  ...(
    [
      ["code-block", ["codeBlock"], ["context-label", "actions", "code-canvas"]],
      ["math", ["mathBlock"], ["render", "fallback", "error"]],
      [
        "diagram",
        ["diagram"],
        ["shell", "header", "body", "render", "loading", "error", "actions"],
      ],
    ] as const
  ).map(([name, nodes, anatomy]) =>
    component({
      key: `runtime.technical.${name}`,
      owner: "runtime",
      ownedNodes: nodes,
      family: "technical",
      surface: "technical",
      measure: "wide",
      anatomy,
      states: ["default", "focus", "loading", "error", "long-content"],
      effects: name === "code-block" ? ["focus"] : ["focus", "reveal"],
      interactions: ["copy-or-switch-when-present", "bounded-horizontal-scroll"],
    }),
  ),
  ...(
    [
      ["image", ["image"], ["media", "caption", "fallback"]],
      ["video", ["video"], ["frame", "player", "status", "transcript", "resume-overlay"]],
      ["audio", ["audio"], ["player", "status", "optional-transcript"]],
      ["embed", ["embed"], ["frame", "loading", "error", "source-action"]],
    ] as const
  ).map(([name, nodes, anatomy]) =>
    component({
      key: `runtime.media.${name}`,
      owner: "runtime",
      ownedNodes: nodes,
      family: "media",
      surface: "media",
      measure: name === "audio" ? "wide" : "media",
      anatomy,
      states: ["loading", "default", "focus", "error", "long-content"],
      effects: ["focus", "reveal"],
      interactions: name === "image" ? ["passive"] : ["operate-media", "recover-error"],
    }),
  ),
  ...(
    [
      ["poll", ["poll"]],
      ["quiz", ["questionPool"]],
    ] as const
  ).map(([name, nodes]) =>
    component({
      key: `runtime.practice.${name}`,
      owner: "runtime",
      ownedNodes: nodes,
      family: "practice",
      surface: "activity",
      measure: "wide",
      anatomy: ["prompt", "instruction", "progress", "work-area", "primary-action", "feedback"],
      states: [
        "idle",
        "focus",
        "selected",
        "pending",
        "success",
        "error",
        "completed",
        "long-content",
      ],
      effects: name === "poll" ? ["focus", "trace"] : ["focus", "milestone"],
      interactions: ["answer", "submit", "retry", "restore-saved-result"],
    }),
  ),
  component({
    key: "runtime.navigation.file",
    owner: "runtime",
    ownedNodes: ["fileAttachment"],
    family: "navigation",
    surface: "plain",
    measure: "prose",
    anatomy: ["icon", "identity", "metadata", "action"],
    effects: ["focus"],
    interactions: ["open-or-download"],
  }),
  component({
    key: "runtime.navigation.reference",
    owner: "runtime",
    ownedNodes: ["reference"],
    family: "navigation",
    surface: "plain",
    measure: "wide",
    anatomy: ["identity", "availability-or-progress", "destination"],
    states: ["available", "completed", "locked", "unavailable", "focus"],
    effects: ["focus", "trace"],
    interactions: ["navigate-when-available"],
  }),
  component({
    key: "blocks.course-card",
    owner: "blocks",
    family: "journey",
    surface: "tinted",
    containmentReason: "destination-card",
    measure: "page",
    anatomy: ["cover", "identity", "progress-or-commerce", "action"],
    states: ["default", "hover", "focus", "long-content"],
    effects: ["focus", "lift"],
    interactions: ["navigate"],
  }),
  component({
    key: "blocks.course-hero-card",
    owner: "blocks",
    family: "journey",
    surface: "tinted",
    containmentReason: "destination-card",
    measure: "page",
    anatomy: ["cover", "identity", "progress", "action"],
    states: ["default", "hover", "focus", "long-content"],
    effects: ["focus", "lift"],
    interactions: ["navigate"],
  }),
  ...(
    [
      ["course-catalog", "journey", "plain", "page", ["heading", "search", "collection"]],
      ["course-hero", "journey", "media", "media", ["cover", "fallback"]],
      ["course-outline", "journey", "plain", "page", ["groups", "items", "current-done-locked"]],
      ["course-player", "journey", "plain", "page", ["reader", "progress", "continuation"]],
      ["course-shell", "journey", "plain", "page", ["curriculum-context", "reader", "active-tool"]],
      ["curriculum-journey", "journey", "plain", "page", ["groups", "items", "state"]],
      [
        "enrolled-course-home",
        "journey",
        "plain",
        "page",
        ["cover", "identity", "progress", "primary-action"],
      ],
      ["intake-form-header", "enrollment", "plain", "wide", ["context", "progress"]],
      [
        "intake-fields",
        "enrollment",
        "plain",
        "wide",
        ["questions", "uploads", "validation", "action"],
      ],
      ["learner-home", "journey", "plain", "page", ["identity", "resume", "active", "completed"]],
      [
        "study-resource-list",
        "engagement",
        "plain",
        "wide",
        ["kind", "identity", "metadata", "destination"],
      ],
      ["study-tools", "journey", "overlay", "page", ["trigger", "active-tool", "close"]],
    ] as const
  ).map(([name, family, surface, measure, anatomy]) =>
    component({
      key: `blocks.${name}`,
      owner: "blocks",
      family,
      surface,
      measure,
      anatomy,
      states: ["default", "focus", "empty", "long-content"],
      effects: ["focus", "reveal"],
      interactions: ["operate-through-host-callbacks"],
    }),
  ),
  ...(
    [
      [
        "organization-header",
        "journey",
        "plain",
        "page",
        ["cursare-mark", "organization-mark", "organization-name", "learner-navigation"],
      ],
      [
        "learner-header",
        "journey",
        "plain",
        "page",
        ["identity", "course-context", "progress-trace", "learner-actions", "account"],
      ],
      [
        "storefront-hero-search",
        "journey",
        "plain",
        "page",
        ["organization-identity", "welcome", "search", "primary-destination"],
      ],
      [
        "storefront-shelves",
        "journey",
        "plain",
        "page",
        ["resume", "active-courses", "completed-courses"],
      ],
      [
        "storefront-topic-filters",
        "journey",
        "plain",
        "page",
        ["filter-group", "selected-state", "results"],
      ],
      [
        "storefront-recommendations",
        "journey",
        "plain",
        "page",
        ["section-identity", "cards-or-cohort"],
      ],
      [
        "storefront-empty-footer",
        "journey",
        "plain",
        "page",
        ["explanation", "organization-navigation"],
      ],
      [
        "campaign-access-status",
        "enrollment",
        "tinted",
        "page",
        ["status", "message", "available-action"],
      ],
      [
        "offer-picker",
        "enrollment",
        "activity",
        "wide",
        ["offer-identity", "terms", "selection", "price", "action"],
      ],
      [
        "cohort-picker",
        "enrollment",
        "activity",
        "wide",
        ["cohort-identity", "dates", "availability", "selection"],
      ],
      [
        "enroll-controls",
        "enrollment",
        "plain",
        "page",
        ["terms", "price-or-status", "primary-action"],
      ],
      [
        "checkout-notice",
        "enrollment",
        "tinted",
        "wide",
        ["status", "trust", "explanation", "recovery"],
      ],
      ["rating-social-proof", "engagement", "plain", "inline", ["label", "value", "count"]],
      [
        "review-section",
        "engagement",
        "plain",
        "wide",
        ["summary", "reviews", "pagination", "trigger"],
      ],
      [
        "review-dialog",
        "engagement",
        "overlay",
        "wide",
        ["form", "validation", "action", "status"],
      ],
      [
        "share-dialog",
        "engagement",
        "overlay",
        "wide",
        ["trigger", "copy", "destinations", "status"],
      ],
      [
        "discussion-feed",
        "engagement",
        "plain",
        "wide",
        ["composer", "posts", "replies", "pagination"],
      ],
      [
        "learner-notes",
        "engagement",
        "overlay",
        "inline",
        ["context", "list", "editor", "save-delete-status"],
      ],
      [
        "continuation",
        "navigation",
        "plain",
        "wide",
        ["confirmed-state", "destination", "primary-action"],
      ],
      [
        "completion",
        "journey",
        "plain",
        "page",
        ["confirmed-outcome", "next-action", "optional-credential"],
      ],
      [
        "certificate",
        "journey",
        "plain",
        "page",
        ["organization", "cursare", "learner", "course", "issue-details", "actions"],
      ],
    ] as const
  ).map(([name, family, surface, measure, anatomy]) =>
    component({
      key: `web.${name}`,
      owner: "web-adapter",
      family,
      surface,
      measure,
      anatomy,
      states:
        name === "learner-header"
          ? [
              "global-learning",
              "school",
              "enrolled-course",
              "classroom",
              "certificate",
              "tenant-white-label",
              "scrolled",
              "focus",
              "print",
              "long-content",
            ]
          : ["default", "focus", "pending", "success", "error", "empty", "long-content"],
      effects: family === "journey" ? ["trace", "reveal"] : ["focus", "reveal"],
      interactions:
        name === "learner-header"
          ? ["navigate", "open-outline", "open-study-tool", "open-notes", "toggle-focus"]
          : ["operate-through-host-effect"],
      themeRoles:
        name === "organization-header" || name === "learner-header" || name === "certificate"
          ? ["neutral", "content-accent", "semantic-state", "source-owned"]
          : undefined,
    }),
  ),
])

const learnerComponentRegistryByKey = new Map(
  learnerComponentRegistry.map((contract) => [contract.key, contract] as const),
)

export function validateLearnerComponentRegistry(
  contracts: readonly LearnerComponentContract[] = learnerComponentRegistry,
): string[] {
  const errors: string[] = []
  const keys = new Set<string>()
  const ownedNodes = new Map<string, string>()

  for (const contract of contracts) {
    if (keys.has(contract.key)) errors.push(`Duplicate component key: ${contract.key}`)
    keys.add(contract.key)

    if (contract.anatomy.length === 0) errors.push(`${contract.key}: anatomy is empty`)
    if (contract.states.length === 0) errors.push(`${contract.key}: states are empty`)
    if (contract.themeRoles.length === 0) errors.push(`${contract.key}: themeRoles are empty`)
    if (contract.accessibility.length === 0) errors.push(`${contract.key}: accessibility is empty`)
    if (contract.responsive.length === 0) errors.push(`${contract.key}: responsive is empty`)
    if (contract.fixtures.length === 0) errors.push(`${contract.key}: fixtures are empty`)
    if (contract.checks.length === 0) errors.push(`${contract.key}: checks are empty`)

    const primaryActions = contract.anatomy.filter((part) => part === "primary-action")
    if (primaryActions.length > 1) errors.push(`${contract.key}: multiple primary actions`)

    const fixtures = new Set(contract.fixtures)
    for (const state of contract.states) {
      if (!fixtures.has(state)) errors.push(`${contract.key}: state ${state} has no fixture`)
    }

    for (const capture of ["capture-1440-light", "capture-1440-dark", "capture-360-light"]) {
      if (!contract.checks.includes(capture)) {
        errors.push(`${contract.key}: missing baseline ${capture}`)
      }
    }
    if (contract.effects.length > 0 && !contract.checks.includes("capture-reduced-motion")) {
      errors.push(`${contract.key}: animated component needs a reduced-motion capture`)
    }

    if (contract.containment === "none" && contract.containmentReason !== null) {
      errors.push(`${contract.key}: containment reason requires semantic containment`)
    }
    if (contract.containment === "semantic" && contract.containmentReason === null) {
      errors.push(`${contract.key}: semantic containment requires a reason`)
    }
    if (
      contract.family === "flow" &&
      contract.surface === "plain" &&
      contract.containment !== "none"
    ) {
      errors.push(`${contract.key}: plain Flow roots cannot use containment`)
    }

    const declaredEffects = new Set(contract.effects)
    for (const [transition, effect] of Object.entries(contract.motionRequiredFor)) {
      if (!declaredEffects.has(effect)) {
        errors.push(`${contract.key}: ${transition} maps to undeclared effect ${effect}`)
      }
    }
    for (const effect of declaredEffects) {
      if (!Object.values(contract.motionRequiredFor).includes(effect)) {
        errors.push(`${contract.key}: effect ${effect} has no required transition`)
      }
    }

    for (const node of contract.ownedNodes) {
      if (contract.owner !== "runtime") continue
      const existing = ownedNodes.get(node)
      if (existing) errors.push(`Runtime node ${node} is owned by ${existing} and ${contract.key}`)
      else ownedNodes.set(node, contract.key)
    }
  }

  return errors
}

export function learnerComponentContract(key: LearnerComponentKey): LearnerComponentContract {
  const contract = learnerComponentRegistryByKey.get(key)
  if (!contract) throw new TypeError(`Unknown learner component contract: ${key}`)
  return contract
}

export function learnerComponentAttributes(key: LearnerComponentKey) {
  const contract = learnerComponentContract(key)
  return {
    "data-learner-component": contract.key,
    "data-learner-containment": contract.containment,
    "data-learner-family": contract.family,
    "data-learner-measure": contract.measure,
    "data-learner-surface": contract.surface,
  } as const
}
