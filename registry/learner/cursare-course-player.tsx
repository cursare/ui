import type { CoursePlayerProps } from "./course-player"
import { CoursePlayer } from "./course-player"
import {
  type CursareClient,
  type CursareServerClientOptions,
  createCursareServerClient,
} from "./cursare-client"

export {
  CursareApiError,
  type CursareClient,
  type CursareFetch,
  type CursareLearnerContent,
  type CursareServerClientOptions,
  createCursareServerClient,
} from "./cursare-client"

export interface CursareCoursePlayerProps
  extends Omit<CoursePlayerProps, "basePath" | "content" | "theme"> {
  client: CursareClient
  contentId: string
  basePath?: string
  theme?: string | null
}

export type ConfiguredCursareCoursePlayerProps = Omit<CursareCoursePlayerProps, "client">

export async function CursareCoursePlayer({
  client,
  contentId,
  basePath = "",
  theme,
  ...playerProps
}: CursareCoursePlayerProps) {
  const content = await client.getLearnerContent(contentId)
  return (
    <CoursePlayer
      {...playerProps}
      basePath={basePath}
      content={content.document}
      theme={theme ?? content.theme}
    />
  )
}

export function createCursareCoursePlayer(options: CursareServerClientOptions) {
  const client = createCursareServerClient(options)
  return function ConfiguredCursareCoursePlayer(props: ConfiguredCursareCoursePlayerProps) {
    return <CursareCoursePlayer {...props} client={client} />
  }
}
