import type { LearnerAnchor } from "@/components/cursare/foundation/model/learner-runtime"

// Never mutates the reader's rendered content.
export function learnerAnchorDomTargets(
  root: Pick<ParentNode, "querySelector">,
  anchors: readonly LearnerAnchor[],
): Array<{ anchor: LearnerAnchor; element: HTMLElement }> {
  return anchors.flatMap((anchor) => {
    const escaped = anchor.id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')
    const element = root.querySelector(`[data-learner-anchor-id="${escaped}"]`)
    return element ? [{ anchor, element: element as HTMLElement }] : []
  })
}
