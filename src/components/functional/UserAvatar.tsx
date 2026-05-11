/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * UserAvatar.tsx
 *
 * Styled-components implementation of the avatar component.
 * Drop-in for both PublicMUIDPanel and UniversalIdPanel.
 *
 * Props:
 *   src              — current avatar URL (optional)
 *   alt              — accessible label (default: "User avatar")
 *   editable         — enables upload/delete interactions (default: false)
 *   onUpload         — called with the selected File
 *   onDelete         — called when the user removes the avatar
 *   maxSizeMB        — file size ceiling in MB (default: 5)
 *   maxResolutionPx  — max width/height in px (default: 2000)
 *   shape            — "circle" | "square" | "free" (default: "circle")
 *   borderRadius     — overrides shape preset e.g. "14px"
 *   borderWidth      — ring thickness in px (default: 3)
 *   tierColor        — CSS gradient string for the ring (falls back to neutral)
 *   size             — rendered size in px (default: 72)
 *   isLoading        — show spinner overlay
 *   fallback         — ReactNode shown when no src (e.g. a phosphor icon)
 *   className        — forwarded to root element
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  type DragEvent,
  type ChangeEvent,
} from "react";
import styled, { keyframes, css } from "styled-components";
import { toast } from "sonner";
import { Tooltip } from "react-tooltip";
import theme from "@/globals/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
];

const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_MAX_RESOLUTION = 2000;
const DEFAULT_BORDER_WIDTH = 3;
const DEFAULT_SIZE = 72;
const NEUTRAL_RING = "linear-gradient(135deg, #4b5563, #374151)";

// ─── Keyframes ────────────────────────────────────────────────────────────────

const spinKf = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const fadeKf = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popKf = keyframes`
  0%   { transform: scale(0.5); opacity: 0; }
  70%  { transform: scale(1.12); }
  100% { transform: scale(1);   opacity: 1; }
`;

// ─── Styled components ────────────────────────────────────────────────────────

const Root = styled.div`
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  user-select: none;
  position: relative;
`;

const Ring = styled.div<{
  $size: number;
  $bw: number;
  $tc: string;
  $r: string;
  $editable: boolean;
  $hovered: boolean;
  $dragging: boolean;
  $loading: boolean;
}>`
  position: relative;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $r }) => $r};
  padding: ${({ $bw }) => $bw}px;
  background: ${({ $dragging, $tc }) =>
    $dragging ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : $tc};
  box-sizing: border-box;
  cursor: ${({ $editable, $loading }) =>
    $loading ? "wait" : $editable ? "pointer" : "default"};
  transition:
    background 0.25s ease,
    box-shadow 0.25s ease,
    transform 0.15s ease;
  transform: ${({ $hovered, $editable, $loading }) =>
    $hovered && $editable && !$loading ? "scale(1.04)" : "scale(1)"};
  box-shadow: ${({ $dragging, $hovered, $editable }) =>
    $dragging
      ? "0 0 0 3px rgba(99,102,241,0.35), 0 8px 28px rgba(99,102,241,0.25)"
      : $hovered && $editable
        ? "0 0 0 2px rgba(99,102,241,0.18), 0 6px 18px rgba(0,0,0,0.18)"
        : "0 2px 8px rgba(0,0,0,0.12)"};
  outline: none;
  &:focus-visible {
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5);
  }
`;

const Inner = styled.div<{ $r: string; $bw: number }>`
  width: 100%;
  height: 100%;
  border-radius: calc(${({ $r }) => $r} - ${({ $bw }) => $bw}px);
  overflow: hidden;
  background: ${({ theme }) => theme?.colors?.secondaryBackground ?? "#1f2937"};
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
`;

const AvatarImg = styled.img<{ $dimmed: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
  transition: filter 0.2s ease;
  filter: ${({ $dimmed }) => ($dimmed ? "brightness(0.45)" : "brightness(1)")};
`;

const FallbackWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: ${({ theme }) => theme?.colors?.textSecondary ?? "#9ca3af"};
  opacity: 0.35;
`;

// ── Upload hover overlay ───────────────────────────────────────────────────────

const HoverOverlay = styled.div<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: white;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: ${({ $visible }) => ($visible ? "auto" : "none")};
  transition: opacity 0.18s ease;
  ${({ $visible }) =>
    $visible &&
    css`
      animation: ${fadeKf} 0.18s ease;
    `}
`;

const OverlayLabel = styled.span<{ $fs: number }>`
  font-size: ${({ $fs }) => $fs}px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
  text-align: center;
`;

// ── Drag overlay ───────────────────────────────────────────────────────────────

const DragOverlay = styled.div<{ $visible: boolean; $r: string; $bw: number }>`
  position: absolute;
  inset: 0;
  border-radius: calc(${({ $r }) => $r} - ${({ $bw }) => $bw}px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: rgba(99, 102, 241, 0.16);
  border: 2px dashed rgba(99, 102, 241, 0.65);
  color: #818cf8;
  font-size: 10px;
  font-weight: 700;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: none;
  transition: opacity 0.14s ease;
  z-index: 10;
`;

// ── Loading overlay ────────────────────────────────────────────────────────────

const LoadingOverlay = styled.div<{
  $visible: boolean;
  $r: string;
  $bw: number;
}>`
  position: absolute;
  inset: 0;
  border-radius: calc(${({ $r }) => $r} - ${({ $bw }) => $bw}px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.48);
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: ${({ $visible }) => ($visible ? "auto" : "none")};
  transition: opacity 0.18s ease;
  z-index: 20;
`;

const SpinCircle = styled.div<{ $s: number }>`
  width: ${({ $s }) => $s}px;
  height: ${({ $s }) => $s}px;
  border: 2.5px solid rgba(255, 255, 255, 0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: ${spinKf} 0.75s linear infinite;
`;

// ── Delete badge ───────────────────────────────────────────────────────────────

const DeleteBadge = styled.button<{ $show: boolean; $bw: number; $bs: number }>`
  position: absolute;
  top: ${({ $bw }) => -$bw - 2}px;
  right: ${({ $bw }) => -$bw - 2}px;
  width: ${({ $bs }) => $bs}px;
  height: ${({ $bs }) => $bs}px;
  border-radius: 50%;
  background: #ef4444;
  border: 2px solid ${({ theme }) => theme.colors.primaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  z-index: 30;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  transform: ${({ $show }) => ($show ? "scale(1)" : "scale(0.5)")};
  pointer-events: ${({ $show }) => ($show ? "auto" : "none")};
  transition:
    opacity 0.18s ease,
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  ${({ $show }) =>
    $show &&
    css`
      animation: ${popKf} 0.22s ease;
    `}
  &:hover {
    filter: brightness(1.15);
  }
`;

// ── Hint block ─────────────────────────────────────────────────────────────────

// ─── Inline SVG icons (no extra deps) ────────────────────────────────────────

function CameraIcon({ size }: { size: number }) {
  const s = Math.max(size * 0.22, 14);
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function TrashMiniIcon({ size }: { size: number }) {
  const s = Math.max(size * 0.4, 10);
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function DropArrow({ size }: { size: number }) {
  const s = Math.max(size * 0.18, 12);
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRadius(shape: AvatarShape, override?: string): string {
  if (override) return override;
  return shape === "circle" ? "50%" : "0px";
}

function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read dimensions."));
    };
    img.src = url;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AvatarShape = "circle" | "square" | "free";

export interface UserAvatarProps {
  src?: string | null;
  alt?: string;
  editable?: boolean;
  onUpload?: (file: File) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  maxSizeMB?: number;
  maxResolutionPx?: number;
  shape?: AvatarShape;
  borderRadius?: string;
  borderWidth?: number;
  tierColor?: string;
  size?: number;
  isLoading?: boolean;
  fallback?: React.ReactNode;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserAvatar({
  src,
  alt = "User avatar",
  editable = false,
  onUpload,
  onDelete,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  maxResolutionPx = DEFAULT_MAX_RESOLUTION,
  shape = "circle",
  borderRadius: radiusOverride,
  borderWidth = DEFAULT_BORDER_WIDTH,
  tierColor = NEUTRAL_RING,
  size = DEFAULT_SIZE,
  isLoading = false,
  fallback,
  className,
}: UserAvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);

  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [localSrc, setLocalSrc] = useState<string | null>(src ?? null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    setLocalSrc(src ?? null);
  }, [src]);

  const radius = computeRadius(shape, radiusOverride);
  const showLoading = isLoading || processing;
  const showOverlay = editable && hovered && !showLoading;
  const badgeSize = Math.max(size * 0.28, 20);
  const spinnerSize = Math.max(size * 0.3, 18);
  const fontSize = Math.max(size * 0.1, 9);

  // ── Validation ────────────────────────────────────────────────────────────

  const validateFile = useCallback(
    async (file: File): Promise<boolean> => {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast.error(`Unsupported type: ${file.type || "unknown"}`, {
          description: "Use JPEG, PNG, WebP, GIF, AVIF, or HEIC.",
        });
        return false;
      }
      if (file.size === 0) {
        toast.error("File is empty.");
        return false;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(
          `Image too large (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
          {
            description: `Max allowed is ${maxSizeMB} MB.`,
          },
        );
        return false;
      }
      try {
        const { width, height } = await getImageDimensions(file);
        if (width <= 0 || height <= 0) {
          toast.error("Could not read image dimensions. File may be corrupt.");
          return false;
        }
        if (shape !== "free" && width !== height) {
          toast.error(
            `Must be a square image (${width}×${height}px detected).`,
            { description: "Crop to a square before uploading." },
          );
          return false;
        }
        if (width > maxResolutionPx || height > maxResolutionPx) {
          toast.error(`Image too large (${width}×${height}px)`, {
            description: `Max is ${maxResolutionPx}×${maxResolutionPx}px.`,
          });
          return false;
        }
      } catch {
        toast.error(
          "Failed to read image. The file may be corrupt or unsupported.",
        );
        return false;
      }
      return true;
    },
    [maxSizeMB, maxResolutionPx, shape],
  );

  // ── Process ───────────────────────────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      setProcessing(true);
      try {
        if (!(await validateFile(file))) return;
        const preview = URL.createObjectURL(file);
        setLocalSrc(preview);
        try {
          await onUpload?.(file);
        } catch (err: any) {
          setLocalSrc(src ?? null);
          URL.revokeObjectURL(preview);
          toast.error(err?.message || "Upload failed. Please try again.");
        }
      } finally {
        setProcessing(false);
      }
    },
    [validateFile, onUpload, src],
  );

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleInputChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      await processFile(file);
    },
    [processFile],
  );

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      if (++dragCount.current === 1) setIsDragging(true);
    },
    [editable],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      if (--dragCount.current === 0) setIsDragging(false);
    },
    [editable],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [editable],
  );

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      dragCount.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Only image files can be dropped here.");
        return;
      }
      await processFile(file);
    },
    [editable, processFile],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!localSrc) return;
      setProcessing(true);
      try {
        await onDelete?.();
        setLocalSrc(null);
        toast.success("Avatar removed.");
      } catch (err: any) {
        toast.error(
          err?.message || "Failed to remove avatar. Please try again.",
        );
      } finally {
        setProcessing(false);
      }
    },
    [localSrc, onDelete],
  );

  const handleClick = useCallback(() => {
    if (!editable || showLoading) return;
    inputRef.current?.click();
  }, [editable, showLoading]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Root className={className}>
      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          style={{ display: "none" }}
          onChange={handleInputChange}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      <Ring
        role={editable ? "button" : "img"}
        aria-label={editable ? `${alt} — click or drag to upload` : alt}
        tabIndex={editable ? 0 : -1}
        $size={size}
        $bw={borderWidth}
        $tc={tierColor}
        $r={radius}
        $editable={editable}
        $hovered={hovered}
        $dragging={isDragging}
        $loading={showLoading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (editable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-tooltip-id={`avatar-upload-tooltip`}
        data-tooltip-content={`${shape !== "free" ? "Square image required" : "Any aspect ratio"} ·  Max ${maxSizeMB} MB · ${maxResolutionPx}×${maxResolutionPx}px`}
      >
        <Inner $r={radius} $bw={borderWidth}>
          {localSrc ? (
            <AvatarImg
              src={localSrc}
              alt={alt}
              $dimmed={showOverlay}
              draggable={false}
            />
          ) : (
            <FallbackWrap>{fallback}</FallbackWrap>
          )}

          {editable && (
            <HoverOverlay $visible={showOverlay}>
              <CameraIcon size={size} />
              <OverlayLabel $fs={fontSize}>
                {localSrc ? "Change" : "Upload"}
              </OverlayLabel>
            </HoverOverlay>
          )}

          {editable && (
            <DragOverlay $visible={isDragging} $r={radius} $bw={borderWidth}>
              <DropArrow size={size} />
              Drop to upload
            </DragOverlay>
          )}

          <LoadingOverlay $visible={showLoading} $r={radius} $bw={borderWidth}>
            <SpinCircle $s={spinnerSize} />
          </LoadingOverlay>
        </Inner>

        {editable && onDelete && (
          <DeleteBadge
            type="button"
            $show={hovered && !!localSrc && !showLoading}
            $bw={borderWidth}
            $bs={badgeSize}
            onClick={handleDelete}
            aria-label="Remove avatar"
            tabIndex={hovered && !!localSrc && !showLoading ? 0 : -1}
          >
            <TrashMiniIcon size={badgeSize} />
          </DeleteBadge>
        )}
        {editable && (
          <Tooltip
            id={`avatar-upload-tooltip`}
            style={{
              fontSize: 12,
              fontWeight: 400,
              backgroundColor: theme.colors.primaryBackground,
              color: theme.colors.textPrimary,
            }}
          />
        )}
      </Ring>
    </Root>
  );
}
