import type { LearnerComponentKey } from "./learner-component-registry"
import { LearnerRoot, type LearnerRootProps } from "./learner-primitives"

type FamilyRootProps<Key extends LearnerComponentKey> = Omit<LearnerRootProps, "contractKey"> & {
  contractKey: Key
}

type TechnicalKey = Extract<LearnerComponentKey, `runtime.technical.${string}`>
type ActivityKey = Extract<LearnerComponentKey, `runtime.practice.${string}`>
type MediaKey = Extract<LearnerComponentKey, `runtime.media.${string}`>

function learnerFamilyRoot<Key extends LearnerComponentKey>() {
  return function LearnerFamilyRoot(props: FamilyRootProps<Key>) {
    return <LearnerRoot {...props} />
  }
}

export const LearnerTechnicalRoot = learnerFamilyRoot<TechnicalKey>()
export const LearnerActivityRoot = learnerFamilyRoot<ActivityKey>()
export const LearnerMediaRoot = learnerFamilyRoot<MediaKey>()
