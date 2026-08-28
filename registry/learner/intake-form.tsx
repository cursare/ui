"use client"

import { themeVars } from "@/components/cursare/foundation/model/learner-runtime"
import { ContentCoverMedia, LearnerRoot } from "@/components/cursare/foundation/runtime"
import { DatePicker } from "@/components/cursare/ui/date-picker"
import { Field, FieldLabel } from "@/components/cursare/ui/field"
import { Input } from "@/components/cursare/ui/input"
import { PhoneInput, phoneCountryFromLocale } from "@/components/cursare/ui/phone-input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/cursare/ui/select"
import { Textarea } from "@/components/cursare/ui/textarea"
import { Check } from "lucide-react"
import { useState } from "react"

export type IntakeQuestionType =
  | "text"
  | "textarea"
  | "select"
  | "file"
  | "date"
  | "number"
  | "email"
  | "phone"

// Structurally matches the API type.
export interface IntakeQuestion {
  id: string
  label: string
  description?: string
  type: IntakeQuestionType
  options?: string[]
  required: boolean
}

export interface IntakeUploadResult {
  url: string
  name?: string
}

export type IntakeUpload = (file: File, questionId: string) => Promise<IntakeUploadResult>

export interface IntakeFormMessages {
  optional: string
  choose: string
  uploading: string
  uploadFailed: string
  uploadUnavailable: string
  datePlaceholder: string
  dateClear: string
  dateToday: string
  phoneCountryLabel: string
  phoneCountrySearch: string
  phoneCountryNoResults: string
}

const DEFAULT_MESSAGES: IntakeFormMessages = {
  optional: "(optional)",
  choose: "Choose…",
  uploading: "Uploading…",
  uploadFailed: "Upload failed — try again.",
  uploadUnavailable: "File upload is not configured.",
  datePlaceholder: "Select date",
  dateClear: "Clear",
  dateToday: "Today",
  phoneCountryLabel: "Country calling code",
  phoneCountrySearch: "Search countries…",
  phoneCountryNoResults: "No country found.",
}

export function IntakeFormHeader({
  coverImage,
  title,
  subtitle,
  theme,
}: {
  coverImage?: string | null
  title: string
  subtitle: string
  theme?: string | null
}) {
  return (
    <LearnerRoot
      contractKey="blocks.intake-form-header"
      className="w-full text-left"
      style={theme !== undefined ? themeVars(theme) : undefined}
    >
      <ContentCoverMedia src={coverImage} className="h-16 w-full rounded-t-2xl" />
      <div className="px-6 pt-4">
        <p className="intake-form-title truncate font-heading font-semibold">{title}</p>
        <p className="intake-form-description text-muted-foreground">{subtitle}</p>
      </div>
    </LearnerRoot>
  )
}

function inputType(type: IntakeQuestionType): string {
  return type === "number" ? "number" : type === "email" ? "email" : "text"
}

export interface IntakeFieldsProps {
  questions: IntakeQuestion[]
  answers: Record<string, string>
  onChange?: (id: string, value: string) => void
  disabled?: boolean
  uploadFile?: IntakeUpload
  allowFileUploads?: boolean
  locale?: string
  messages?: Partial<IntakeFormMessages>
}

// All persistence and uploads are injected by the host.
export function IntakeFields({
  questions,
  answers,
  onChange,
  disabled = false,
  uploadFile,
  allowFileUploads = true,
  locale = "en-US",
  messages,
}: IntakeFieldsProps) {
  const copy = { ...DEFAULT_MESSAGES, ...messages }

  return (
    <LearnerRoot contractKey="blocks.intake-fields">
      {questions
        .filter((question) => allowFileUploads || question.type !== "file")
        .map((question) => (
          <Field
            key={question.id}
            data-intake-question-required={question.required}
            data-intake-question-type={question.type}
          >
            <FieldLabel>
              {question.label}
              {question.required ? null : (
                <span className="ml-1 font-normal text-muted-foreground">{copy.optional}</span>
              )}
            </FieldLabel>
            {question.description ? (
              <p className="text-muted-foreground text-xs">{question.description}</p>
            ) : null}
            {question.type === "select" ? (
              <Select
                value={answers[question.id] ?? ""}
                onValueChange={(value) => onChange?.(question.id, (value as string) ?? "")}
                disabled={disabled}
              >
                <SelectTrigger className="w-full" data-testid="intake-select">
                  <SelectValue>{(value) => (value ? (value as string) : copy.choose)}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {(question.options ?? []).map((option) => (
                    <SelectItem key={option} value={option} data-testid="intake-select-option">
                      {option}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            ) : question.type === "file" ? (
              <IntakeFileInput
                value={answers[question.id] ?? ""}
                onUploaded={(url) => onChange?.(question.id, url)}
                disabled={disabled}
                uploadFile={uploadFile ? (file) => uploadFile(file, question.id) : undefined}
                messages={copy}
              />
            ) : question.type === "textarea" ? (
              <Textarea
                data-testid="intake-textarea"
                rows={3}
                disabled={disabled}
                value={answers[question.id] ?? ""}
                onChange={(event) => onChange?.(question.id, event.target.value)}
              />
            ) : question.type === "date" ? (
              <DatePicker
                data-testid="intake-input"
                className="w-full"
                disabled={disabled}
                value={answers[question.id] ?? ""}
                onValueChange={(value) => onChange?.(question.id, value)}
                locale={locale}
                placeholder={copy.datePlaceholder}
                clearLabel={copy.dateClear}
                todayLabel={copy.dateToday}
              />
            ) : question.type === "phone" ? (
              <PhoneInput
                className="h-11 sm:h-11"
                data-testid="intake-input"
                disabled={disabled}
                value={answers[question.id] ?? ""}
                onValueChange={(value) => onChange?.(question.id, value)}
                defaultCountry={phoneCountryFromLocale(locale) ?? "BR"}
                locale={locale}
                countryLabel={copy.phoneCountryLabel}
                countrySearchPlaceholder={copy.phoneCountrySearch}
                countryNoResults={copy.phoneCountryNoResults}
              />
            ) : (
              <Input
                data-testid="intake-input"
                type={inputType(question.type)}
                disabled={disabled}
                value={answers[question.id] ?? ""}
                onChange={(event) => onChange?.(question.id, event.target.value)}
              />
            )}
          </Field>
        ))}
    </LearnerRoot>
  )
}

function IntakeFileInput({
  value,
  onUploaded,
  disabled,
  uploadFile,
  messages,
}: {
  value: string
  onUploaded: (url: string) => void
  disabled: boolean
  uploadFile?: (file: File) => Promise<IntakeUploadResult>
  messages: IntakeFormMessages
}) {
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    if (!uploadFile) {
      setError(messages.uploadUnavailable)
      return
    }
    setError(null)
    setUploading(true)
    try {
      const uploaded = await uploadFile(file)
      setName(uploaded.name ?? file.name)
      onUploaded(uploaded.url)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : messages.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        nativeInput
        data-testid="intake-file-input"
        type="file"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />
      {uploading ? (
        <span className="text-muted-foreground text-xs">{messages.uploading}</span>
      ) : value && name ? (
        <span className="flex items-center gap-1 text-success text-xs">
          <Check data-learner-icon="inline" aria-hidden />
          {name}
        </span>
      ) : null}
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  )
}
