const COURSE_CHILD_SEPARATORS = [" · ", " — ", " – ", ": ", " / ", " → "]

export function compactCourseChildTitle(contentTitle: string, childTitle: string) {
  const course = contentTitle.trim()
  const child = childTitle.trim()
  const courseLower = course.toLocaleLowerCase()
  const childLower = child.toLocaleLowerCase()

  for (const separator of COURSE_CHILD_SEPARATORS) {
    const prefix = `${courseLower}${separator}`
    if (childLower.startsWith(prefix)) return child.slice(prefix.length).trim() || child
  }

  return child
}
