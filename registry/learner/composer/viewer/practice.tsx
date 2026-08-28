"use client"

import { Button } from "@/components/cursare/ui/button"
import {
  ChartNoAxesColumn,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  PartyPopper,
  X,
} from "lucide-react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { ReaderBlock } from "./blocks"
import type {
  PollLoad,
  PollOption,
  PollResults,
  PollVote,
  PoolQuestion,
  PracticeFraming,
  QuizGrade,
  QuizResult,
  SavedQuiz,
} from "./contracts"
import { isUsableQuizResult } from "./contracts"
import type { EditorMessages } from "./messages"
import { editorMessage } from "./messages"

type Translate = (key: string, params?: Record<string, string | number>) => string
const pendingPollLoads = new Map<string, Promise<PollResults | null>>()

function loadPollResults(pollId: string, load: PollLoad): Promise<PollResults | null> {
  const pending = pendingPollLoads.get(pollId)
  if (pending) return pending

  const request = Promise.resolve().then(() => load(pollId))
  pendingPollLoads.set(pollId, request)
  void request.then(
    () => pendingPollLoads.delete(pollId),
    () => pendingPollLoads.delete(pollId),
  )
  return request
}

function translator(messages?: EditorMessages): Translate {
  return (key, params) => editorMessage(messages, key, params)
}

function questionSeed(question: PoolQuestion): number {
  const source = `${question.id}:${question.options.map((option) => option.id).join(":")}`
  let hash = 2_166_136_261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

export function shuffledQuizOptions(question: PoolQuestion): PoolQuestion["options"] {
  const options = [...question.options]
  let seed = questionSeed(question)
  for (let index = options.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
    const target = seed % (index + 1)
    const current = options[index]
    const replacement = options[target]
    if (!current || !replacement) continue
    options[index] = replacement
    options[target] = current
  }

  const unchanged = options.every((option, index) => option.id === question.options[index]?.id)
  if (unchanged && options.length > 1) {
    const first = options.shift()
    if (first) options.push(first)
  }
  return options
}

export function PollView({
  framing,
  pollId,
  question,
  options,
  vote,
  load,
  messages,
}: {
  framing: PracticeFraming
  pollId: string | null
  question: string
  options: PollOption[]
  vote: PollVote | null
  load: PollLoad | null
  messages?: EditorMessages
}) {
  const t = translator(messages)
  const [results, setResults] = useState<PollResults | null>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    if (!pollId || !load) return
    loadPollResults(pollId, load).then(
      (value) => {
        if (alive && value) setResults(value)
      },
      () => {},
    )
    return () => {
      alive = false
    }
  }, [load, pollId])

  const voted = results?.mine != null
  const canVote = Boolean(pollId && vote) && !voted
  const cast = async (optionId: string) => {
    if (!pollId || !vote || pending) return
    setPending(true)
    setFailed(false)
    try {
      const fresh = await vote(pollId, optionId)
      if (fresh) setResults(fresh)
      else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <ReaderBlock
      name="poll"
      icon={ChartNoAxesColumn}
      label={framing.title}
      description={framing.description}
      actions={
        results ? (
          <span className="content-poll-total">
            {t(results.total === 1 ? "pollVoteCount" : "pollVoteCountPlural", {
              count: results.total,
            })}
          </span>
        ) : null
      }
      bodyClassName="content-poll-card"
      learnerContract="runtime.practice.poll"
    >
      {question && framing.title !== question.trim() ? (
        <p className="content-poll-question-read">{question}</p>
      ) : null}
      <div className="content-poll-options">
        {options.map((option) => {
          const count = results?.counts[option.id] ?? 0
          const maxCount = results ? Math.max(0, ...Object.values(results.counts)) : 0
          const winner = voted && count > 0 && count === maxCount
          const percent =
            voted && results && results.total > 0 ? Math.round((count / results.total) * 100) : 0
          const mine = results?.mine === option.id
          return (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              aria-pressed={mine}
              className="content-poll-choice"
              data-voted={voted || undefined}
              data-mine={mine || undefined}
              data-winner={winner || undefined}
              disabled={!canVote || pending}
              onClick={() => void cast(option.id)}
            >
              {voted ? (
                <span
                  className="content-poll-fill"
                  style={{ "--learner-poll-fill": `${percent}%` } as CSSProperties}
                  aria-hidden
                />
              ) : null}
              <span className="content-poll-choice-text">{option.text}</span>
              {voted ? <span className="content-poll-pct">{percent}%</span> : null}
            </Button>
          )
        })}
      </div>
      {(!vote || failed) && !voted ? (
        <p className="content-poll-hint">{t("pollSignInToVote")}</p>
      ) : null}
    </ReaderBlock>
  )
}

export function QuizView({
  framing,
  questions,
  grade,
  saved,
  onStart,
  messages,
}: {
  framing: PracticeFraming
  questions: PoolQuestion[]
  grade: QuizGrade | null
  saved: SavedQuiz | null
  onStart: () => void
  messages?: EditorMessages
}) {
  const t = translator(messages)
  const coversSample =
    Boolean(saved) && questions.every((question) => Boolean(saved?.answers?.[question.id]))
  const [retaking, setRetaking] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>(
    coversSample ? (saved?.answers ?? {}) : {},
  )
  const [result, setResult] = useState<QuizResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const started = useRef(false)
  const completed = coversSample && !retaking && !result
  const locked = !grade || result !== null || completed || submitting
  const resultByQuestion = new Map(
    (result?.results ?? []).map((value) => [value.questionId, value]),
  )
  const answeredCount = questions.filter((question) => answers[question.id]).length
  const allAnswered = questions.length > 0 && answeredCount === questions.length
  const currentIndex = Math.min(activeQuestionIndex, Math.max(questions.length - 1, 0))
  const currentQuestion = questions[currentIndex]
  const currentOptions = currentQuestion ? shuffledQuizOptions(currentQuestion) : []
  const currentResult = currentQuestion ? resultByQuestion.get(currentQuestion.id) : undefined
  const currentAnswered = currentQuestion ? Boolean(answers[currentQuestion.id]) : false
  const isLastQuestion = currentIndex === questions.length - 1
  const hasVisibleScore = Boolean(result || (completed && saved))
  const showQuestionProgress = questions.length > 0 && !(questions.length === 1 && hasVisibleScore)
  const showQuestionHeader = hasVisibleScore || showQuestionProgress
  const showNavigation =
    questions.length > 0 &&
    (currentIndex > 0 ||
      !isLastQuestion ||
      Boolean(result && result.score < result.total) ||
      Boolean(completed && grade) ||
      Boolean(grade && !result && !completed))
  const progressLabel = t("questionPoolProgress", {
    current: questions.length ? currentIndex + 1 : 0,
    total: questions.length,
  })

  const submit = async () => {
    if (!grade) return
    setError(null)
    setSubmitting(true)
    try {
      const graded = await grade(answers)
      if (!isUsableQuizResult(graded)) throw new Error("Quiz was not saved")
      setResult(graded)
      setActiveQuestionIndex(0)
    } catch {
      setError(t("activitySubmitError"))
    } finally {
      setSubmitting(false)
    }
  }

  const retake = () => {
    setAnswers({})
    setResult(null)
    setRetaking(true)
    setError(null)
    setActiveQuestionIndex(0)
  }

  return (
    <ReaderBlock
      name="questionPool"
      className="content-question"
      icon={ClipboardCheck}
      label={framing.title}
      description={framing.description}
      learnerContract="runtime.practice.quiz"
    >
      <div className="content-quiz-frame">
        <div
          className="content-question-card"
          data-reader
          data-graded={result ? "" : undefined}
          data-graded-activity
          data-completed={completed || result ? "" : undefined}
          aria-busy={submitting}
          tabIndex={-1}
        >
          {showQuestionHeader ? (
            <div className="content-question-head">
              {result ? (
                <span
                  className="content-question-score"
                  data-perfect={result.score === result.total || undefined}
                  role="status"
                  aria-live="polite"
                  aria-label={t("activityResult", { score: result.score, total: result.total })}
                >
                  {result.score === result.total ? <PartyPopper className="size-4" /> : null}
                  {result.score}/{result.total}
                </span>
              ) : completed && saved ? (
                <span className="content-question-score">
                  {t("questionPoolLastScore", { score: saved.score, total: saved.total })}
                </span>
              ) : null}
              {showQuestionProgress ? (
                <span className="content-question-status">
                  <span className="content-question-summary-inline" aria-live="polite">
                    {progressLabel}
                  </span>
                  <span
                    className="content-question-progress"
                    role="progressbar"
                    aria-label={progressLabel}
                    aria-valuemin={1}
                    aria-valuemax={questions.length}
                    aria-valuenow={currentIndex + 1}
                  >
                    <span
                      className="content-question-progress-value"
                      style={
                        {
                          "--learner-question-progress": `${((currentIndex + 1) / questions.length) * 100}%`,
                        } as CSSProperties
                      }
                    />
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="content-question-list">
            {currentQuestion ? (
              <fieldset key={currentQuestion.id} className="content-question-item">
                <legend className="sr-only">{currentQuestion.prompt}</legend>
                <div className="content-question-prompt-row" aria-hidden>
                  <span className="content-question-prompt-readonly">{currentQuestion.prompt}</span>
                </div>
                <div className="content-question-options">
                  {currentOptions.map((option) => {
                    const chosen = answers[currentQuestion.id] === option.id
                    const isAnswer = currentResult?.correctOptionId === option.id
                    const wrong = currentResult ? chosen && !currentResult.correct : false
                    return (
                      <label
                        key={option.id}
                        className="content-question-option"
                        data-correct={isAnswer || undefined}
                        data-wrong={wrong || undefined}
                      >
                        <input
                          type="radio"
                          name={`quiz-${currentQuestion.id}`}
                          checked={chosen}
                          disabled={locked}
                          onChange={() => {
                            if (!started.current) {
                              started.current = true
                              onStart()
                            }
                            setError(null)
                            setAnswers((previous) => ({
                              ...previous,
                              [currentQuestion.id]: option.id,
                            }))
                          }}
                        />
                        <span className="content-question-option-readonly">{option.text}</span>
                        {isAnswer ? (
                          <>
                            <Check className="content-question-mark size-4" aria-hidden />
                            <span className="sr-only">{t("activityCorrect")}</span>
                          </>
                        ) : wrong ? (
                          <>
                            <X className="content-question-mark size-4" aria-hidden />
                            <span className="sr-only">{t("activityIncorrect")}</span>
                          </>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ) : null}
          </div>
          {error ? (
            <p className="content-question-saved" role="alert">
              {error}
            </p>
          ) : null}
          {result && result.score < result.total && isLastQuestion ? (
            <div className="content-question-saved">
              <span>{t("questionPoolMissedHint")}</span>
            </div>
          ) : null}
          {completed && isLastQuestion ? (
            <div className="content-question-saved">
              <span>{t("questionPoolCompleted")}</span>
            </div>
          ) : null}
          {showNavigation ? (
            <div className="content-question-navigation">
              {currentIndex > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveQuestionIndex((index) => Math.max(0, index - 1))}
                  disabled={submitting}
                >
                  <ChevronLeft aria-hidden />
                  {t("questionPoolPrevious")}
                </Button>
              ) : null}
              {result && result.score < result.total && isLastQuestion ? (
                <Button type="button" variant="secondary" onClick={() => location.reload()}>
                  {t("questionPoolKeepPracticing")}
                  <ChevronRight aria-hidden />
                </Button>
              ) : completed && isLastQuestion && grade ? (
                <Button type="button" variant="secondary" onClick={retake}>
                  {t("questionPoolRetake")}
                </Button>
              ) : isLastQuestion && grade && !result && !completed ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!allAnswered || submitting}
                  onClick={() => void submit()}
                >
                  {submitting
                    ? t("questionPoolChecking")
                    : allAnswered
                      ? t("questionPoolSubmit")
                      : t("questionPoolAnswerMore", { count: questions.length - answeredCount })}
                  <ChevronRight aria-hidden />
                </Button>
              ) : !isLastQuestion ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setActiveQuestionIndex((index) => Math.min(questions.length - 1, index + 1))
                  }
                  disabled={(!locked && !currentAnswered) || submitting}
                >
                  {t("questionPoolNext")}
                  <ChevronRight aria-hidden />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </ReaderBlock>
  )
}
