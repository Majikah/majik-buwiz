import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { css } from "styled-components";

import { extractEmailDomain, isDevEnvironment } from "@/utils/utils";
import {
  dangerousSites,
  disposableEmailDomains,
} from "@/utils/globalDropdownOptions";

// ---------------------------------------------------------------------------
// Styled primitives (Unchanged)
// ---------------------------------------------------------------------------

const clampStyles = (maxLines: number) => {
  if (maxLines === 1) {
    return css`
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
  }
  if (maxLines === 0) {
    return css`
      white-space: normal;
      overflow: visible;
    `;
  }
  return css`
    display: -webkit-box;
    -webkit-line-clamp: ${maxLines};
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: normal;
  `;
};

const Wrapper = styled.span<{ $readonly: boolean; $block: boolean }>`
  position: relative;
  display: ${({ $block }) => ($block ? "block" : "inline-block")};
  border-radius: ${({ theme }) => theme.borders.radius.small};
  transition: background ${({ theme }) => theme.animations.duration.short}
    ${({ theme }) => theme.animations.easing.easeOut};

  ${({ $readonly, theme }) =>
    !$readonly &&
    css`
      cursor: text;
      &:hover {
        background: ${theme.colors.primarySoft};
        outline: 1px dashed ${theme.colors.primary}44;
      }
      &:focus-within {
        background: ${theme.colors.primarySoft};
        outline: 1.5px solid ${theme.colors.primary}66;
      }
    `}
`;

const Hint = styled.span`
  display: none;
  position: absolute;
  top: -25px;
  left: 0;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  white-space: nowrap;
  pointer-events: none;
  z-index: ${({ theme }) => theme.zIndex.tooltip};
  padding: 6px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.primarySoft};

  ${Wrapper}:hover & {
    display: block;
  }
`;

const baseInputStyles = css`
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  width: 100%;
  padding: 0;
  resize: none;
  cursor: inherit;
  transition: opacity 0.15s ease;

  &::placeholder {
    opacity: 0.4;
  }

  &:disabled {
    pointer-events: none;
    opacity: 1;
  }
`;

const StyledInput = styled.input<{ $maxLines: number }>`
  ${baseInputStyles}

  &:not(:focus) {
    ${({ $maxLines }) => clampStyles($maxLines)}
  }

  &:focus {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
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

const StyledTextarea = styled.textarea<{ $maxLines: number }>`
  ${baseInputStyles}
  line-height: ${({ theme }) => theme.typography.lineHeights.body};

  &:not(:focus) {
    ${({ $maxLines }) => clampStyles($maxLines)}
  }

  &:focus {
    white-space: normal;
    overflow: visible;
  }
`;

const StyledSelect = styled.select`
  ${baseInputStyles}
  appearance: none;
  -webkit-appearance: none;

  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.sizes.subject};

  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &::-webkit-scrollbar {
    width: 1px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0);
    border-radius: 24px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0);
    border-radius: 24px;
    border: 1px solid transparent;
  }
  &::-webkit-scrollbar-thumb:hover {
    background-color: rgba(0, 0, 0, 0);
  }

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => theme.colors.secondaryBackground}
    rgba(0, 0, 0, 0);
`;

// ---------------------------------------------------------------------------
// Security & Validation Utilities
// ---------------------------------------------------------------------------

function checkForHTMLTags(input: string): boolean {
  if (!input) return false;
  const normalized = input.toLowerCase();
  const dangerousPatterns = [
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
  return dangerousPatterns.some((pattern) => normalized.includes(pattern));
}

function autocapitalize(
  text: string,
  mode: "word" | "character" | "sentence" | "first" = "first",
): string {
  if (!text) return "";
  switch (mode) {
    case "word":
      return text
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    case "character":
      return text.toUpperCase();
    case "sentence":
      return text
        .split(/(?<=\.)\s+/)
        .map((sentence) => sentence.charAt(0).toUpperCase() + sentence.slice(1))
        .join(" ");
    case "first":
    default:
      return text.charAt(0).toUpperCase() + text.slice(1);
  }
}

function isDisposableEmail(email: string): boolean {
  if (!email) return false;
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return disposableEmailDomains.some(
    (blocked: string) => domain === blocked || domain.endsWith(`.${blocked}`),
  );
}

const sanitizeURL = (url: string): boolean => {
  if (!url) return true;
  try {
    const urlObject = new URL(url);
    return dangerousSites.every(
      (site: string) => !urlObject.hostname.includes(site),
    );
  } catch (error) {
    if (isDevEnvironment()) console.warn(error);
    return true;
  }
};

const checkSourceURL = (url: string, whitelist: string[]): boolean => {
  if (!url) return true;
  try {
    const urlObject = new URL(url);
    return whitelist.some(
      (site) =>
        urlObject.hostname === site || urlObject.hostname.endsWith(`.${site}`),
    );
  } catch (error) {
    if (isDevEnvironment()) console.warn(error);
    return false;
  }
};

const validateURL = (url: string): boolean => {
  const urlPattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i;
  return urlPattern.test(url) && sanitizeURL(url);
};

const validateRegexPattern = (value: string, regexType: string): boolean => {
  let regexPattern: RegExp;
  switch (regexType) {
    case "alphanumeric":
      regexPattern = /^[a-zA-Z0-9]*$/;
      break;
    case "alphanumeric-code":
      regexPattern = /^[a-zA-Z0-9-_]*$/;
      break;
    case "numbers":
      regexPattern = /^\d*\.?\d{0,2}$/;
      break;
    case "letters":
      regexPattern = /^[a-zA-Z\s]*$/;
      break;
    case "all":
      return true;
    default:
      regexPattern = /.*/;
      break;
  }
  return regexPattern.test(value) && (value.match(/\s/g) || []).length <= 3;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BaseEditableFieldProps = {
  label?: string;
  readonly?: boolean;
  block?: boolean;
  maxLines?: number;
  style?: React.CSSProperties;
  className?: string;
  regex?: "alphanumeric" | "alphanumeric-code" | "numbers" | "letters" | "all";
  maxChar?: number;
  allcaps?: boolean;
  capitalize?: "word" | "character" | "sentence" | "first" | null;
  onBlur?: () => void;
  onValidated?: (valid: boolean) => void;
  whitelist?: string[];
  placeholder?: string;
};

type EditableFieldProps = BaseEditableFieldProps &
  (
    | {
        as?: "input";
        type?: React.HTMLInputTypeAttribute;
        value: string | null | undefined;
        onChange: (value: string) => void;
        inputStyle?: React.CSSProperties;
        min?: string;
        max?: string;
      }
    | {
        as: "textarea";
        value: string | null | undefined;
        onChange: (value: string) => void;
        inputStyle?: React.CSSProperties;
        rows?: number;
      }
    | {
        as: "select";
        value: string | null | undefined;
        onChange: (value: string) => void;
        options: { value: string; label: string }[];
        inputStyle?: React.CSSProperties;
      }
  );

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EditableFieldComponent: React.FC<EditableFieldProps> = (props) => {
  const {
    label,
    readonly = false,
    block = false,
    style,
    className,
    maxLines = 1,
    regex = "all",
    maxChar = 0,
    allcaps = false,
    capitalize = null,
    onValidated,
    onBlur,
    whitelist,
    placeholder,
  } = props;

  const rawValue = props.value;
  const normalizedValue = rawValue ?? "";
  const isEmpty = normalizedValue.trim() === "";

  // Local input state — decoupled from parent to keep typing responsive.
  const [localValue, setLocalValue] = useState<string>(normalizedValue);

  // Track whether the field is currently focused. When focused, we own the
  // value and must NOT let parent prop changes overwrite what the user is
  // actively typing.
  const isFocusedRef = useRef(false);

  const latestParentOnChange = useRef(props.onChange);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the onChange ref current so scheduleSync closure stays stable.
  useEffect(() => {
    latestParentOnChange.current = props.onChange;
  }, [props.onChange]);

  // Sync local state from parent ONLY when the field is not focused.
  // This prevents the parent's debounced re-render from clobbering
  // mid-keystroke input.
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(normalizedValue);
    }
  }, [normalizedValue]);

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, []);

  const scheduleSync = useCallback((val: string, delay = 300) => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      try {
        latestParentOnChange.current?.(val);
      } finally {
        pendingTimer.current = null;
      }
    }, delay);
  }, []);

  // ---------------------------------------------------------------------------
  // FIX: Single, flat handleInternalChange — no nested re-declaration.
  // The original code accidentally defined a second handleInternalChange
  // inside the XSS-guard branch, so the outer function's body was never
  // executed beyond the guard check. Typed characters never reached
  // setLocalValue or scheduleSync.
  // ---------------------------------------------------------------------------
  const handleInternalChange = useCallback(
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const { value } = event.target;
      let processedValue = allcaps ? value.toUpperCase() : value;

      // 🔐 XSS / HTML guard
      if (checkForHTMLTags(processedValue)) {
        onValidated?.(false);
        return;
      }

      // Character limit
      if (maxChar > 0 && processedValue.length > maxChar) {
        return;
      }

      let isValid = true;

      // Email / URL validation
      if (props.as === "input" || props.as === undefined) {
        if (props.type === "email") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (
            !emailRegex.test(processedValue) ||
            isDisposableEmail(processedValue)
          ) {
            isValid = false;
          }
        } else if (props.type === "url" && processedValue.trim() !== "") {
          const urlIsValidFormat = validateURL(processedValue);
          const urlIsSafe = sanitizeURL(processedValue);
          const urlIsInWhitelist =
            whitelist && whitelist.length > 0
              ? checkSourceURL(processedValue, whitelist)
              : true;

          if (!urlIsValidFormat || !urlIsSafe || !urlIsInWhitelist) {
            isValid = false;
          }
        }
      }

      // Regex validation
      if (!validateRegexPattern(processedValue, regex)) {
        isValid = false;
      }

      onValidated?.(isValid);

      if (capitalize) {
        processedValue = autocapitalize(processedValue, capitalize);
      }

      // Update local immediately for responsive rendering, then debounce
      // the parent notification to avoid triggering expensive re-renders
      // (GeneralInvoice.create etc.) on every keystroke.
      setLocalValue(processedValue);
      scheduleSync(processedValue);
    },
    // Props that affect processing logic must be in deps. onChange is handled
    // via latestParentOnChange ref so it does NOT need to be here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allcaps, maxChar, regex, capitalize, whitelist, onValidated, scheduleSync],
  );

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  const handleBlurSafe = useCallback(() => {
    isFocusedRef.current = false;

    if (checkForHTMLTags(localValue)) {
      onValidated?.(false);
      return;
    }

    // Flush any pending debounced update immediately on blur so the parent
    // always has the final value when the user leaves the field.
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    latestParentOnChange.current?.(localValue);
    onBlur?.();
  }, [localValue, onValidated, onBlur]);

  // Prevent invalid characters from being typed at the key level.
  const handleKeyDown = useCallback(
    (
      event: React.KeyboardEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const char = event.key;
      if (
        regex !== "all" &&
        char.length === 1 &&
        !validateRegexPattern(char, regex)
      ) {
        event.preventDefault();
      }
    },
    [regex],
  );

  const renderControl = () => {
    if (props.as === "textarea") {
      return (
        <StyledTextarea
          $maxLines={maxLines}
          value={localValue}
          onChange={handleInternalChange}
          onFocus={handleFocus}
          onBlur={handleBlurSafe}
          onKeyDown={handleKeyDown}
          disabled={readonly}
          rows={props.rows ?? 3}
          style={props.inputStyle}
          placeholder={isEmpty ? placeholder || label : undefined}
          data-private
        />
      );
    }

    if (props.as === "select") {
      return (
        <StyledSelect
          value={localValue}
          onChange={handleInternalChange}
          onFocus={handleFocus}
          onBlur={handleBlurSafe}
          disabled={readonly}
          style={props.inputStyle}
        >
          {label && (
            <option value="" disabled hidden>
              {label.toUpperCase()}
            </option>
          )}
          {props.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label.toUpperCase()}
            </option>
          ))}
        </StyledSelect>
      );
    }

    if (maxLines !== 1) {
      return (
        <StyledTextarea
          $maxLines={maxLines}
          value={localValue}
          onChange={handleInternalChange}
          onFocus={handleFocus}
          onBlur={handleBlurSafe}
          onKeyDown={handleKeyDown}
          disabled={readonly}
          rows={maxLines === 0 ? 3 : maxLines}
          style={(props as any).inputStyle}
          placeholder={isEmpty ? placeholder || label : undefined}
          data-private
        />
      );
    }

    return (
      <StyledInput
        $maxLines={maxLines}
        type={props.type ?? "text"}
        value={localValue}
        onChange={handleInternalChange}
        onFocus={handleFocus}
        onBlur={handleBlurSafe}
        onKeyDown={handleKeyDown}
        disabled={readonly}
        style={props.inputStyle}
        min={(props as any).min}
        max={(props as any).max}
        placeholder={isEmpty ? placeholder || label : undefined}
        data-private
      />
    );
  };

  return (
    <Wrapper
      $readonly={readonly}
      $block={block}
      style={style}
      className={className}
    >
      {label && !readonly && <Hint>{label}</Hint>}
      {renderControl()}
    </Wrapper>
  );
};

export const EditableField = React.memo(EditableFieldComponent);
