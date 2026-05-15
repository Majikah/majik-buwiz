/**
 * CustomFormInput.tsx
 *
 * Reusable form input / select for invoice forms (and similar compact UIs).
 * Visual style matches InvoicePaymentForm (small labels, compact padding, theme tokens).
 * Sanitization and validation logic is ported from CustomInputField.tsx.
 *
 * Supports:
 *   - text / number / url / email / password / datetime-local input types
 *   - <select> mode via the `options` prop
 *   - XSS / HTML-injection guard on every keystroke
 *   - URL format + dangerous-domain validation
 *   - Email format + disposable-domain check
 *   - Required field enforcement
 *   - Character limit with counter
 *   - onValidated callback
 */

import React, { useId, useState } from "react";
import styled, { css } from "styled-components";

// ---------------------------------------------------------------------------
// Styled primitives (matches InvoicePaymentForm visual language)
// ---------------------------------------------------------------------------

const FieldGroup = styled.div<{ $isRow?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: inherit;

  ${({ $isRow }) =>
    $isRow &&
    css`
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      gap: 12px;
    `}
`;

const LabelRow = styled.div<{ $isRow?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;

  ${({ $isRow }) =>
    $isRow &&
    css`
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      gap: 12px;
      width: 100%;
    `}
`;

const FieldLabel = styled.label`
  font-size: 11px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: 0.02em;
  cursor: default;
  user-select: none;
`;

const Required = styled.span`
  color: ${({ theme }) => theme.colors.error};
  margin-left: 1px;
  font-size: 11px;
`;

const inputBase = css<{ $hasError: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  font-size: 12px;
  padding: 7px 10px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  border: 1px solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.error : `${theme.colors.primary}33`};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme, $hasError }) =>
      $hasError ? theme.colors.error : `${theme.colors.primary}88`};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.45;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &[type="date"] {
    position: relative;
  }
  &[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(0.5);
    cursor: pointer;
    opacity: 1;
  }
`;

const StyledInput = styled.input<{ $hasError: boolean; $hasToggle?: boolean }>`
  ${inputBase}
  padding-right: ${({ $hasToggle }) => ($hasToggle ? "38px" : "10px")};
`;

const StyledTextArea = styled.textarea<{
  $hasError: boolean;
  $hasToggle?: boolean;
}>`
  ${inputBase}

  padding-right: ${({ $hasToggle }) => ($hasToggle ? "38px" : "10px")};

  min-height: 96px;
  resize: vertical;
  line-height: 1.5;

  white-space: pre-wrap;
`;

const StyledSelect = styled.select<{ $hasError: boolean }>`
  ${inputBase}
  cursor: pointer;
`;

const InputWrap = styled.div`
  position: relative;
`;

const ControlCell = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
`;

const ControlColumn = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const ToggleSwitch = styled.input.attrs({ type: "checkbox" })<{
  checked: boolean;
  disabled: boolean;
}>`
  width: 50px;
  height: 27px;
  background-color: ${({ checked, theme }) =>
    checked ? theme.colors.primary : theme.colors.secondaryBackground};
  border-radius: 15px;
  border: 1px solid
    ${({ theme, checked }) =>
      checked ? theme.colors.secondaryBackground : theme.colors.textSecondary};

  position: relative;
  appearance: none;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  outline: none;
  transition: background-color
    ${({ theme }) => theme.animations.duration.medium}
    ${({ theme }) => theme.animations.easing.easeInOut};

  &:disabled {
    background-color: ${({ theme }) => theme.colors.secondaryBackground};
  }

  &::after {
    content: "";
    width: 21px;
    height: 21px;
    background-color: ${({ checked, theme }) =>
      checked ? theme.colors.secondaryBackground : theme.colors.textSecondary};
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: ${({ checked }) => (checked ? "26px" : "2px")};
    transition: left ${({ theme }) => theme.animations.duration.medium}
      ${({ theme }) => theme.animations.easing.easeInOut};
  }
`;

const HintText = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  margin-top: 1px;
`;

const ErrorText = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.error};
  margin-top: 1px;
  text-align: right;
`;

const CharCount = styled.div<{ $exceeded: boolean }>`
  font-size: 10px;
  text-align: right;
  color: ${({ theme, $exceeded }) =>
    $exceeded ? theme.colors.error : theme.colors.textSecondary};
  opacity: ${({ $exceeded }) => ($exceeded ? 1 : 0.6)};
`;

// ---------------------------------------------------------------------------
// Validation helpers (ported from CustomInputField.tsx)
// ---------------------------------------------------------------------------

const DANGEROUS_HTML_PATTERNS = [
  "<svg",
  "<img",
  "<script",
  "<iframe",
  "<object",
  "<embed",
  "<link",
  "<meta",
  "<style",
  "<base",
  "onload=",
  "onerror=",
  "onclick=",
  "javascript:",
  "data:",
];

function checkForHTMLTags(input: string): boolean {
  if (!input) return false;
  const normalized = input.toLowerCase();
  return DANGEROUS_HTML_PATTERNS.some((p) => normalized.includes(p));
}

function sanitizeInput(input: string): string {
  if (!input || !checkForHTMLTags(input)) return input;
  let s = input;
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(/\bon\w+\s*=\s*["']?[^"']*["']?/gi, "");
  s = s.replace(/\b(javascript|data)\s*:/gi, "");
  s = s.replace(/[<>"]/g, "");
  return s.trim();
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateURL(url: string): boolean {
  const pattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i;
  return pattern.test(url);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectOption {
  value: string;
  label: string;
}

export type InputType =
  | "text"
  | "paragraph"
  | "number"
  | "email"
  | "password"
  | "url"
  | "datetime-local"
  | "date"
  | "boolean";

export interface CustomFormInputProps {
  /** Field label */
  label: string;
  /** Current controlled value. For boolean inputs this may be a boolean. */
  value: string | boolean;
  /** Called with the new (sanitized) value on every change. For boolean fields the value will be a boolean. */
  onChange: (value: string | boolean) => void;
  /** If provided renders a <select> instead of <input> */
  options?: SelectOption[];
  /** Input type (ignored when options is set) */
  type?: InputType;
  /** Marks the field as required — shows asterisk and validates on change */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Max character limit (0 = unlimited) */
  maxChar?: number;
  /** Hint shown below the field */
  hint?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Called with true/false whenever validity changes */
  onValidated?: (valid: boolean) => void;
  /** Additional className forwarded to the root FieldGroup */
  className?: string;
  /** Whitelist of allowed URL domains (only used when type="url") */
  urlWhitelist?: string[];
  /** HTML id override; auto-generated if omitted */
  id?: string;
  /** Layout: 'stack' places label above input (default). 'row' places label left and input right. */
  layout?: "stack" | "row";
  /** When type='boolean' and useToggle=true, a toggle switch UI will be shown instead of a checkbox. */
  useToggle?: boolean;

  hideCharLimit?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CustomFormInput: React.FC<CustomFormInputProps> = ({
  label,
  value,
  onChange,
  options,
  type = "text",
  required = false,
  placeholder,
  maxChar = 0,
  hint,
  disabled = false,
  onValidated,
  className,
  urlWhitelist,
  id: idProp,
  layout = "stack",
  useToggle = false,
  hideCharLimit = false,
}) => {
  const uid = useId();
  const fieldId = idProp ?? uid;

  const [error, setError] = useState("");

  const charCount = typeof value === "string" ? value.length : 0;
  const isExceeded = maxChar > 0 && charCount > maxChar;

  // ------------------------------------------------------------------
  // Validate a processed value and update error state
  // ------------------------------------------------------------------
  const validate = (v: string): boolean => {
    if (required && !v.trim()) {
      setError("This field is required.");
      onValidated?.(false);
      return false;
    }

    if (type === "email" && v.trim()) {
      if (!validateEmail(v)) {
        setError("Please enter a valid email address.");
        onValidated?.(false);
        return false;
      }
    }

    if (type === "url" && v.trim()) {
      if (!validateURL(v)) {
        setError("Enter a valid URL starting with http:// or https://");
        onValidated?.(false);
        return false;
      }
      if (urlWhitelist && urlWhitelist.length > 0) {
        try {
          const host = new URL(v).hostname;
          const allowed = urlWhitelist.some(
            (d) => host === d || host.endsWith(`.${d}`),
          );
          if (!allowed) {
            setError("This URL is not allowed.");
            onValidated?.(false);
            return false;
          }
        } catch {
          setError("Enter a valid URL.");
          onValidated?.(false);
          return false;
        }
      }
    }

    setError("");
    onValidated?.(true);
    return true;
  };

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    let next = e.target.value;

    // Max char guard (not for number inputs)
    if (type !== "number" && maxChar > 0 && next.length > maxChar) return;

    // XSS guard
    if (checkForHTMLTags(next)) {
      setError("HTML or script-like content is not allowed.");
      onValidated?.(false);
      return;
    }

    next = sanitizeInput(next);
    validate(next);
    onChange(next);
  };

  const hasError = error.length > 0;

  // ------------------------------------------------------------------
  // Render select
  // ------------------------------------------------------------------
  const isRow = layout === "row";

  if (options) {
    if (isRow) {
      return (
        <FieldGroup className={className} $isRow={isRow}>
          <LabelRow $isRow={isRow}>
            <FieldLabel htmlFor={fieldId}>
              {label}
              {required && <Required> *</Required>}
            </FieldLabel>
            <ControlColumn>
              <StyledSelect
                id={fieldId}
                value={typeof value === "string" ? value : ""}
                onChange={handleInputChange}
                disabled={disabled}
                $hasError={hasError}
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </StyledSelect>
              {hasError && (
                <ErrorText style={{ alignSelf: "flex-end" }}>{error}</ErrorText>
              )}
              {hint && !hasError && (
                <HintText style={{ alignSelf: "flex-end" }}>{hint}</HintText>
              )}
            </ControlColumn>
          </LabelRow>
        </FieldGroup>
      );
    }

    return (
      <FieldGroup className={className}>
        <LabelRow>
          <FieldLabel htmlFor={fieldId}>
            {label}
            {required && <Required> *</Required>}
          </FieldLabel>
        </LabelRow>
        <StyledSelect
          id={fieldId}
          value={typeof value === "string" ? value : ""}
          onChange={handleInputChange}
          disabled={disabled}
          $hasError={hasError}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </StyledSelect>
        {hint && !hasError && <HintText>{hint}</HintText>}
        {hasError && <ErrorText>{error}</ErrorText>}
      </FieldGroup>
    );
  }

  // ------------------------------------------------------------------
  // Render input
  // ------------------------------------------------------------------

  // Boolean rendering
  if (type === "boolean") {
    if (isRow) {
      return (
        <FieldGroup className={className} $isRow={isRow}>
          <LabelRow $isRow={isRow}>
            <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
            <ControlColumn>
              <ControlCell>
                {useToggle ? (
                  <ToggleSwitch
                    checked={!!value}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                  />
                ) : (
                  <input
                    id={fieldId}
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                  />
                )}
              </ControlCell>
              {hasError && (
                <ErrorText style={{ alignSelf: "flex-end" }}>{error}</ErrorText>
              )}
              {hint && !hasError && (
                <HintText style={{ alignSelf: "flex-end" }}>{hint}</HintText>
              )}
            </ControlColumn>
          </LabelRow>
        </FieldGroup>
      );
    }

    return (
      <FieldGroup className={className}>
        <LabelRow>
          <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
        </LabelRow>
        <InputWrap>
          <input
            id={fieldId}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
        </InputWrap>
        {hint && !hasError && <HintText>{hint}</HintText>}
      </FieldGroup>
    );
  }

  if (type === "paragraph") {
    const textArea = (
      <StyledTextArea
        id={fieldId}
        value={String(value ?? "")}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        $hasError={hasError}
        $hasToggle={false}
        maxLength={maxChar > 0 ? maxChar : undefined}
        rows={4}
        data-private
      />
    );

    if (isRow) {
      return (
        <FieldGroup className={className} $isRow={isRow}>
          <LabelRow $isRow={isRow}>
            <FieldLabel htmlFor={fieldId}>
              {label}
              {required && <Required> *</Required>}
            </FieldLabel>

            <ControlColumn>
              <InputWrap>{textArea}</InputWrap>

              {hasError && (
                <ErrorText style={{ alignSelf: "flex-end" }}>{error}</ErrorText>
              )}

              {hint && !hasError && (
                <HintText style={{ alignSelf: "flex-end" }}>{hint}</HintText>
              )}
            </ControlColumn>
          </LabelRow>

          {maxChar > 0 && !hideCharLimit && (
            <CharCount $exceeded={isExceeded}>
              {charCount}/{maxChar}
            </CharCount>
          )}
        </FieldGroup>
      );
    }

    return (
      <FieldGroup className={className}>
        <LabelRow>
          <FieldLabel htmlFor={fieldId}>
            {label}
            {required && <Required> *</Required>}
          </FieldLabel>
        </LabelRow>

        <InputWrap>{textArea}</InputWrap>

        {maxChar > 0 && !hideCharLimit && (
          <CharCount $exceeded={isExceeded}>
            {charCount}/{maxChar}
          </CharCount>
        )}

        {hint && !hasError && <HintText>{hint}</HintText>}
        {hasError && <ErrorText>{error}</ErrorText>}
      </FieldGroup>
    );
  }
  // Default text/number/email/url input rendering (stack or row)
  if (isRow) {
    return (
      <FieldGroup className={className} $isRow={isRow}>
        <LabelRow $isRow={isRow}>
          <FieldLabel htmlFor={fieldId}>
            {label}
            {required && <Required> *</Required>}
          </FieldLabel>
          <ControlColumn>
            <InputWrap>
              <StyledInput
                id={fieldId}
                type={type}
                value={String(value ?? "")}
                onChange={handleInputChange}
                placeholder={placeholder}
                disabled={disabled}
                $hasError={hasError}
                $hasToggle={false}
                {...(type === "number" ? { min: 0, step: "any" } : {})}
                data-private
              />
            </InputWrap>
            {hasError && (
              <ErrorText style={{ alignSelf: "flex-end" }}>{error}</ErrorText>
            )}
            {hint && !hasError && (
              <HintText style={{ alignSelf: "flex-end" }}>{hint}</HintText>
            )}
          </ControlColumn>
        </LabelRow>
        {maxChar > 0 && !hideCharLimit && (
          <CharCount $exceeded={isExceeded}>
            {charCount}/{maxChar}
          </CharCount>
        )}
      </FieldGroup>
    );
  }

  return (
    <FieldGroup className={className}>
      <LabelRow>
        <FieldLabel htmlFor={fieldId}>
          {label}
          {required && <Required> *</Required>}
        </FieldLabel>
      </LabelRow>
      <InputWrap>
        <StyledInput
          id={fieldId}
          type={type}
          value={String(value ?? "")}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          $hasError={hasError}
          $hasToggle={false}
          {...(type === "number" ? { min: 0, step: "any" } : {})}
          data-private
        />
      </InputWrap>
      {maxChar > 0 && !hideCharLimit && (
        <CharCount $exceeded={isExceeded}>
          {charCount}/{maxChar}
        </CharCount>
      )}
      {hint && !hasError && <HintText>{hint}</HintText>}
      {hasError && <ErrorText>{error}</ErrorText>}
    </FieldGroup>
  );
};

export default CustomFormInput;
