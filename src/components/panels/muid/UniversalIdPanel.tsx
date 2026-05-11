"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { toast } from "sonner";
import {
  FilePlusIcon,
  UploadSimpleIcon,
  XCircleIcon,
  CheckCircleIcon,
  ArrowsClockwiseIcon,
  CalendarIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  EnvelopeIcon,
  GlobeIcon,
  IdentificationCardIcon,
  LockKeyIcon,
  LockOpenIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
  TrashIcon,
  UserIcon,
  ArrowSquareOutIcon,
  SpinnerIcon,
  WarningCircleIcon,
  PencilSimpleIcon,
  ShareIcon,
} from "@phosphor-icons/react";

import DynamicPlaceholder from "@/components/foundations/DynamicPlaceholder";
import {
  DiditStage,
  IDTier,
  MajikUniversalID,
  MajikUniversalIDJSON,
  type PrivatePersonalInfo,
} from "@majikah/majik-universal-id";

import type { MajikahSession } from "@/components/majikah-session-wrapper/majikah-session";

import { MajikKey, MnemonicJSON } from "@majikah/majik-key";

import DynamicPopUp from "@/components/functional/DynamicPopUp";

import GuideHelper from "@/components/functional/GuideHelper";

import { useValidatedImage } from "@/utils/use-validated-image";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import UserAvatar from "@/components/functional/UserAvatar";
import MajikUniversalIDSetup from "./MajikUniversalIDSetup";
import { SupabaseRealtime } from "@/lib/supabase/supabase-realtime";
import { open } from "@tauri-apps/plugin-shell";

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const glowPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
`;

const shakeAnim = keyframes`
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-4px); }
  40%       { transform: translateX(4px); }
  60%       { transform: translateX(-3px); }
  80%       { transform: translateX(3px); }
`;

// ─── Layout ───────────────────────────────────────────────────────────────────

const PanelRoot = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.primaryBackground};
  animation: ${fadeIn} 0.2s ease;
`;

const ScrollBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 24px;
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 4px;
  }
`;

// ─── Toolbar ──────────────────────────────────────────────────────────────────

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
`;

const ToolbarTitle = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
  letter-spacing: -0.015em;
`;

const IconBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const DangerIconBtn = styled(IconBtn)`
  border-color: rgba(239, 68, 68, 0.25);
  color: #ef4444;
  &:hover {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.4);
  }
`;

const SpinIcon = styled.span`
  display: inline-flex;
  animation: ${spin} 0.9s linear infinite;
`;

// ─── Hero Card ────────────────────────────────────────────────────────────────

const HeroCard = styled.div`
  margin: 16px 0 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  overflow: hidden;
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 80% -10%,
      ${({ theme }) => `${theme.colors.primary || "#E05C1A"}18`} 0%,
      transparent 65%
    );
    pointer-events: none;
  }
`;

const HeroTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const HeroLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
`;

const HeroMeta = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const HeroName = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const HeroID = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

const TierBadge = styled.div<{ $tier: string }>`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 5px 10px;
  border-radius: 20px;
  flex-shrink: 0;
  background: ${({ $tier, theme }) =>
    $tier === "trusted"
      ? "rgba(34,197,94,0.12)"
      : $tier === "enhanced"
        ? theme.colors.primarySoft
        : $tier === "verified"
          ? "rgba(59,130,246,0.12)"
          : $tier === "basic"
            ? "rgba(245,158,11,0.12)"
            : "rgba(156,163,175,0.1)"};
  color: ${({ $tier, theme }) =>
    $tier === "trusted"
      ? "#22c55e"
      : $tier === "enhanced"
        ? theme.colors.primary
        : $tier === "verified"
          ? "#3b82f6"
          : $tier === "basic"
            ? "#f59e0b"
            : "#9ca3af"};
  border: 1px solid
    ${({ $tier, theme }) =>
      $tier === "trusted"
        ? "rgba(34,197,94,0.15)"
        : $tier === "enhanced"
          ? theme.colors.primary
          : $tier === "verified"
            ? "rgba(59,130,246,0.15)"
            : $tier === "basic"
              ? "rgba(245,158,11,0.15)"
              : "rgba(156,163,175,0.08)"};
`;

const HeroStats = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

const StatChip = styled.div`
  background: ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const StatLabel = styled.span`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
`;

const StatValue = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

// ─── Verification CTA ─────────────────────────────────────────────────────────

const VerifyCTA = styled.div<{ $status?: string }>`
  background: ${({ $status, theme }) =>
    $status === "Approved"
      ? "rgba(34,197,94,0.06)"
      : $status === "Declined"
        ? "rgba(239,68,68,0.06)"
        : $status === "In Review"
          ? "rgba(59,130,246,0.06)"
          : `${theme.colors.primary || "#E05C1A"}08`};
  border: 1px solid
    ${({ $status, theme }) =>
      $status === "Approved"
        ? "rgba(34,197,94,0.2)"
        : $status === "Declined"
          ? "rgba(239,68,68,0.2)"
          : $status === "In Review"
            ? "rgba(59,130,246,0.2)"
            : `${theme.colors.primary || "#E05C1A"}25`};
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
`;

const VerifyCTATop = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const VerifyCTAIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}15`};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
  flex-shrink: 0;
`;

const VerifyCTAText = styled.div`
  flex: 1;
  min-width: 0;
`;

const VerifyCTATitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const VerifyCTAHint = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  margin-top: 2px;
  line-height: 1.4;
`;

const VerifyBtnRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const VerifyBtn = styled.button<{ $variant?: "primary" | "cancel" | "ghost" }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  border: 1px solid
    ${({ $variant, theme }) =>
      $variant === "cancel"
        ? "rgba(239,68,68,0.3)"
        : $variant === "ghost"
          ? theme.colors.secondaryBackground
          : `${theme.colors.primary || "#E05C1A"}50`};
  background: ${({ $variant, theme }) =>
    $variant === "cancel"
      ? "rgba(239,68,68,0.08)"
      : $variant === "ghost"
        ? "transparent"
        : `${theme.colors.primary || "#E05C1A"}15`};
  color: ${({ $variant, theme }) =>
    $variant === "cancel"
      ? "#ef4444"
      : $variant === "ghost"
        ? theme.colors.textSecondary
        : theme.colors.primary || "#E05C1A"};
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    opacity: 0.8;
  }
`;

const SessionStatusBadge = styled.div<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 20px;
  background: ${({ $status }) =>
    $status === "Approved"
      ? "rgba(34,197,94,0.12)"
      : $status === "Declined"
        ? "rgba(239,68,68,0.12)"
        : $status === "In Review"
          ? "rgba(59,130,246,0.12)"
          : $status === "In Progress"
            ? "rgba(245,158,11,0.12)"
            : "rgba(156,163,175,0.1)"};
  color: ${({ $status }) =>
    $status === "Approved"
      ? "#22c55e"
      : $status === "Declined"
        ? "#ef4444"
        : $status === "In Review"
          ? "#3b82f6"
          : $status === "In Progress"
            ? "#f59e0b"
            : "#9ca3af"};
`;

// ─── Delete / Revoke Action Card ──────────────────────────────────────────────

const ActionCard = styled.div<{ $danger?: boolean }>`
  background: ${({ $danger }) =>
    $danger ? "rgba(239,68,68,0.05)" : "rgba(245,158,11,0.05)"};
  border: 1px solid
    ${({ $danger }) =>
      $danger ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.18)"};
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
`;

const ActionCardTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const ActionCardIcon = styled.div<{ $danger?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $danger }) =>
    $danger ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)"};
  color: ${({ $danger }) => ($danger ? "#ef4444" : "#f59e0b")};
`;

const ActionCardText = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActionCardTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const ActionCardHint = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  margin-top: 3px;
  line-height: 1.5;
`;

const ActionCardBtnRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const DangerBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.14);
    border-color: rgba(239, 68, 68, 0.45);
  }
`;

const EditBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: ${fadeIn} 0.15s ease;
  backdrop-filter: blur(3px);
`;

const ModalCard = styled.div`
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 18px;
  padding: 24px;
  max-width: 380px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
`;

const ModalIconWrap = styled.div<{ $shake?: boolean }>`
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(239, 68, 68, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  animation: ${({ $shake }) => ($shake ? shakeAnim : "none")} 0.4s ease;
`;

const ModalTitle = styled.h3`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  letter-spacing: -0.02em;
`;

const ModalBody = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: 1.65;
  opacity: 0.75;
`;

const ModalWarningBox = styled.div`
  background: rgba(239, 68, 68, 0.07);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 11px;
  color: #ef4444;
  line-height: 1.55;
  display: flex;
  gap: 8px;
  align-items: flex-start;
`;

const ModalBtnRow = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const ModalCancelBtn = styled.button`
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

const ModalConfirmBtn = styled.button`
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.5);
  }
`;

const LockoutBanner = styled.div`
  background: rgba(245, 158, 11, 0.07);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 11px;
  color: #f59e0b;
  line-height: 1.55;
  display: flex;
  gap: 8px;
  align-items: flex-start;
`;

// ─── Section ──────────────────────────────────────────────────────────────────

const Section = styled.div`
  margin-bottom: 12px;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 6px;
`;

const SectionTitle = styled.h4`
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 5px;
`;

const SectionAction = styled.button`
  font-size: 10px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.8;
  &:hover {
    opacity: 1;
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  overflow: hidden;
`;

const FieldRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  &:last-child {
    border-bottom: none;
  }
`;

const FieldIcon = styled.div`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  padding-top: 1px;
`;

const FieldContent = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const FieldLabel = styled.span`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

const FieldValue = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  word-break: break-all;
  line-height: 1.4;
`;

const FieldMono = styled(FieldValue)`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  opacity: 0.7;
`;

const FieldCopyBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.3;
  flex-shrink: 0;
  &:hover {
    opacity: 0.8;
  }
`;

const EmptyField = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.25;
  font-style: italic;
`;

const LockedBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  padding: 14px;
`;

const LockedText = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const LockedTitle = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const LockedHint = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  line-height: 1.5;
`;

const DecryptBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => `${theme.colors.primary || "#E05C1A"}40`};
  background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}10`};
  color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
  &:hover {
    opacity: 0.8;
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

// ─── Decrypt Dialog internals ─────────────────────────────────────────────────

const DecryptDropZone = styled.div<{ $dragging: boolean; $hasFile: boolean }>`
  border: 2px dashed
    ${({ $dragging, $hasFile, theme }) =>
      $dragging
        ? theme.colors.primary || "#E05C1A"
        : $hasFile
          ? "rgba(34,197,94,0.4)"
          : theme.colors.secondaryBackground};
  border-radius: 14px;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${({ $dragging, $hasFile, theme }) =>
    $dragging
      ? `${theme.colors.primary || "#E05C1A"}08`
      : $hasFile
        ? "rgba(34,197,94,0.05)"
        : theme.colors.secondaryBackground};
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
    background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}06`};
  }
`;

const DecryptDropIcon = styled.div<{ $hasFile: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $hasFile, theme }) =>
    $hasFile ? "rgba(34,197,94,0.12)" : theme.colors.primaryBackground};
  color: ${({ $hasFile }) => ($hasFile ? "#22c55e" : "#9ca3af")};
`;

const DecryptDropTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const DecryptDropHint = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  line-height: 1.45;
`;

const DecryptBrowseBtn = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid ${({ theme }) => `${theme.colors.primary || "#E05C1A"}40`};
  background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}10`};
  color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
`;

const DecryptLoadedCard = styled.div`
  margin-top: 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const DecryptLoadedIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(34, 197, 94, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #22c55e;
  flex-shrink: 0;
`;

const DecryptLoadedMeta = styled.div`
  flex: 1;
  min-width: 0;
`;

const DecryptLoadedName = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DecryptLoadedSub = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const DecryptClearBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.35;
  flex-shrink: 0;
  &:hover {
    opacity: 0.8;
  }
`;

const DecryptReadyBox = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(34, 197, 94, 0.07);
  border: 1px solid rgba(34, 197, 94, 0.18);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 11px;
  color: #22c55e;
  line-height: 1.5;
`;

const DecryptErrorBox = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(239, 68, 68, 0.07);
  border: 1px solid rgba(239, 68, 68, 0.18);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 11px;
  color: #ef4444;
  line-height: 1.5;
`;

const StagesGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StageRow = styled.div<{ $passed: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid
    ${({ $passed, theme }) =>
      $passed ? "rgba(34,197,94,0.15)" : theme.colors.secondaryBackground};
`;

const StageDot = styled.div<{ $passed: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $passed }) =>
    $passed ? "#22c55e" : "rgba(156,163,175,0.25)"};
  animation: ${({ $passed }) => ($passed ? "none" : glowPulse)} 2s ease-in-out
    infinite;
`;

const StageName = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
  text-transform: capitalize;
`;

const StageStatus = styled.span<{ $passed: boolean }>`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ $passed }) => ($passed ? "#22c55e" : "#9ca3af")};
`;

const KeyCard = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const KeyIconBox = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  flex-shrink: 0;
`;

const KeyMeta = styled.div`
  flex: 1;
  min-width: 0;
`;

const KeyFingerprint = styled.div`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const KeySub = styled.div`
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
  margin-top: 2px;
`;

const UsernameEditRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
`;

const UsernameInput = styled.input`
  flex: 1;
  min-width: 0;
  background: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 7px;
  padding: 5px 9px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
  &:focus {
    border-color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
  }
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.35;
  }
`;

const UsernameActionBtn = styled.button<{ $variant?: "confirm" | "cancel" }>`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid
    ${({ $variant, theme }) =>
      $variant === "confirm"
        ? `${theme.colors.primary || "#E05C1A"}50`
        : "rgba(239,68,68,0.3)"};
  background: ${({ $variant, theme }) =>
    $variant === "confirm"
      ? `${theme.colors.primary || "#E05C1A"}12`
      : "rgba(239,68,68,0.08)"};
  color: ${({ $variant, theme }) =>
    $variant === "confirm" ? theme.colors.primary || "#E05C1A" : "#ef4444"};
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    opacity: 0.75;
  }
`;

const UsernameHint = styled.div<{ $error?: boolean }>`
  font-size: 9px;
  margin-top: 3px;
  line-height: 1.4;
  color: ${({ $error }) => ($error ? "#ef4444" : "inherit")};
  opacity: ${({ $error }) => ($error ? 1 : 0.4)};
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface UniversalIdPanelProps {
  client: MajikBuwizDatabase;
  majikah: MajikahSession;
  editUserUrl?: string;
}

const STAGE_LABELS: Record<string, string> = {
  id_verification: "ID Verification",
  liveness: "Liveness Check",
  face_match: "Face Match",
  // phone_verification: "Phone Verification",
  ip_analysis: "IP Analysis",
};

const ALL_STAGES = [
  "id_verification",
  "liveness",
  "face_match",
  // "phone_verification",
  "ip_analysis",
];

const ACTIVE_SESSION_STATUSES = new Set([
  "Not Started",
  "In Progress",
  "In Review",
  "Resubmitted",
]);

/** 30 days in milliseconds */
const REVOKE_LOCKOUT_MS = 30 * 24 * 60 * 60 * 1000;

const copyToClipboard = (text: string, label = "Copied") => {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(label, { duration: 1500 }));
};

/**
 * Returns how many days remain in the 30-day post-verification lockout.
 * Returns 0 if the lockout has elapsed or if lastUpdate is unavailable.
 */
function getRevokeLockedDaysRemaining(uid: MajikUniversalID): number {
  const verifiedAt = uid.lastUpdate ? new Date(uid.lastUpdate).getTime() : null;
  if (!verifiedAt) return 0;
  const elapsed = Date.now() - verifiedAt;
  const remaining = REVOKE_LOCKOUT_MS - elapsed;
  return remaining > 0 ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const UniversalIdPanel: React.FC<UniversalIdPanelProps> = ({
  client,
  majikah,
  editUserUrl = "/majikah",
}) => {
  const [loading, setLoading] = useState(true);
  const [uid, setUID] = useState<MajikUniversalID | null>(null);
  const [privateInfo, setPrivateInfo] = useState<PrivatePersonalInfo | null>(
    null,
  );

  // const [isEmbedDrawerOpen, setIsEmbedDrawerOpen] = useState<boolean>(false);

  const [refreshTick, setRefreshTick] = useState(0);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Verification session state
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [isStartingVerification, setIsStartingVerification] = useState(false);
  const [isCancellingVerification, setIsCancellingVerification] =
    useState(false);
  // const [isPollingStatus, setIsPollingStatus] = useState(false);

  // Delete / revoke state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingUID, setIsDeletingUID] = useState(false);
  const [deleteShake, setDeleteShake] = useState(false);

  // Whether to surface the setup wizard after a successful delete
  const [showSetupAfterDelete, setShowSetupAfterDelete] = useState(false);

  // ── Replace / extend existing state block ──────────────────────────────────

  const [isDecrypting, setIsDecrypting] = useState(false);

  // NEW: decrypt dialog state
  const [showDecryptDialog, setShowDecryptDialog] = useState(false);
  const [decryptIsDragging, setDecryptIsDragging] = useState(false);
  const [decryptKey, setDecryptKey] = useState<MajikKey | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const decryptFileRef = useRef<HTMLInputElement>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);

  const [cacheBuster] = useState(Date.now());

  const userImage = useValidatedImage(
    majikah.user?.metadata?.picture ||
      `https://pimg.majikah.solutions/${uid?.userId}/profile.webp?v=${cacheBuster}`,
  );

  useEffect(() => {
    if (!uid) return;

    const rt = new SupabaseRealtime<MajikUniversalIDJSON>(
      "majik_universal_id",
      "majikah",
    );
    rt.subscribeToTable("user_id", uid.userId);

    const detach = rt.onListenUpdate(async (payload) => {
      if (payload.type === "UPDATE" && payload.new) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = payload.new as any;
        if (raw.didit_session_id) {
          setSessionStatus(raw.didit_session_status);
          setVerificationUrl(raw.didit_verification_url ?? null);
        }
      }

      if (payload.type === "DELETE" && payload.old?.id === uid.id) {
        setUID(null);
      }

      setRefreshTick((prev) => prev + 1);
    });

    return () => {
      detach();
      rt.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid?.userId]); // re-subscribe only if the user changes, not on every uid update

  useEffect(() => {
    let cancelled = false;
    const fetchUID = async () => {
      setLoading(true);
      try {
        const fetchedMUID = await client.getMUID();
        if (cancelled || !fetchedMUID) return;

        setUID(fetchedMUID);

        if (fetchedMUID.isPrivateDecrypted) {
          try {
            setPrivateInfo(fetchedMUID.privateInfo as PrivatePersonalInfo);
          } catch {
            /* */
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = fetchedMUID as any;
        if (raw.didit_session_id && raw.didit_verification_url) {
          setSessionStatus(raw.didit_session_status);
          setVerificationUrl(raw.didit_verification_url ?? null);
        }
      } catch (err) {
        console.error("[UniversalIdPanel] Failed to fetch MUID:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchUID();
    return () => {
      cancelled = true;
    };
  }, [client, majikah?.user?.id, refreshTick]);

  const handleSetupComplete = useCallback((created: MajikUniversalID) => {
    setUID(created);
    setShowSetupAfterDelete(false);
    if (created.isPrivateDecrypted) {
      try {
        setPrivateInfo(created.privateInfo as PrivatePersonalInfo);
      } catch {
        /* */
      }
    }
  }, []);

  // ── Replace handleDecrypt entirely ─────────────────────────────────────────

  /** Opens the decrypt dialog instead of touching the keystore. */
  const handleDecrypt = useCallback(() => {
    setDecryptKey(null);
    setDecryptError(null);
    setShowDecryptDialog(true);
  }, []);

  /** Parse a dropped / browsed JSON seed file into a MajikKey. */
  const handleDecryptFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      toast.error("Invalid file type", {
        description: "Please select a .json seed key backup file.",
      });
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as MnemonicJSON;
      const key = await MajikKey.fromMnemonicJSON(
        parsed,
        "majikah-imported-account",
      );
      // key.lock();
      // key.unlock("majikah-imported-account");
      setDecryptKey(key);
      setDecryptError(null);
      toast.success("Key loaded", {
        description: `Fingerprint: ${key.fingerprint.slice(0, 18)}…`,
      });
    } catch (err) {
      setDecryptError(
        err instanceof Error ? err.message : "Could not parse the key file.",
      );
    }
  }, []);

  /** Called when the user confirms inside the DynamicPopUp. */
  const handleDecryptConfirm = useCallback(async () => {
    if (!uid || !decryptKey) return;
    setIsDecrypting(true);
    try {
      const result = await uid.decryptPrivate(decryptKey);
      if (result.success && result.data) {
        setPrivateInfo(result.data);
        toast.success("Private info decrypted");
        setShowDecryptDialog(false);
      } else {
        setDecryptError(result.reason ?? "Decryption failed.");
        toast.error("Decryption failed", { description: result.reason });
      }
    } finally {
      setIsDecrypting(false);
    }
  }, [uid, decryptKey]);

  const handleStartVerification = useCallback(async () => {
    if (!uid) return;

    // If a session already exists with a URL, just re-open it — never create a new one
    if (verificationUrl) {
      open(verificationUrl);
      return;
    }

    // Only create a new session when there is genuinely no active session
    if (sessionStatus && ACTIVE_SESSION_STATUSES.has(sessionStatus)) return;

    setIsStartingVerification(true);
    try {
      const session = await client.startVerification(uid.id, {
        callbackUrl: `${window.location.origin}/id`,
      });
      setSessionStatus(session.data.status);
      setVerificationUrl(session.data.verification_url);
   open(
        session.data.verification_url
      );
      toast.success("Verification session started", {
        description: "Complete your identity verification in the new tab.",
      });
    } catch (err) {
      toast.error("Failed to start verification", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsStartingVerification(false);
    }
  }, [uid, client, verificationUrl, sessionStatus]);

  const handleCancelVerification = useCallback(async () => {
    if (!uid) return;
    setIsCancellingVerification(true);
    try {
      await client.cancelVerification(uid.id);
      setSessionStatus(null);
      setVerificationUrl(null);
      toast.success("Verification session cancelled");
    } catch (err) {
      toast.error("Failed to cancel verification", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsCancellingVerification(false);
    }
  }, [uid, client]);

  /**
   * Deletes (unverified) or revokes (verified) the Universal ID.
   * On success, surfaces the setup wizard so the user can recreate with updated info.
   */
  const handleDeleteUID = useCallback(async () => {
    if (!uid) return;
    setIsDeletingUID(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any).deleteMUID(uid.id);

      toast.success(
        uid.isVerified ? "Universal ID revoked" : "Universal ID deleted",
        {
          description: "You can now create a new one with updated information.",
        },
      );
      setUID(null);
      setPrivateInfo(null);
      setSessionStatus(null);
      setVerificationUrl(null);
      setShowDeleteModal(false);
      setShowSetupAfterDelete(true);
    } catch (err) {
      toast.error("Failed to delete Universal ID", {
        description: err instanceof Error ? err.message : "Please try again",
      });
      // Shake the modal icon on failure
      setDeleteShake(true);
      setTimeout(() => setDeleteShake(false), 500);
    } finally {
      setIsDeletingUID(false);
    }
  }, [uid, client]);

  const handleSaveUsername = useCallback(async () => {
    if (!uid) return;

    const trimmed = usernameInput.trim();

    // Client-side validation mirrors server rules
    if (!trimmed) {
      setUsernameError("Username cannot be empty");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
      setUsernameError(
        "Letters and numbers only — no spaces or special characters",
      );
      return;
    }

    setIsSavingUsername(true);
    setUsernameError(null);
    try {
      const updated = await client.updateMuidUsername(uid.id, trimmed);
      // Rehydrate local uid instance with the updated JSON
      const fresh = await MajikUniversalID.fromJSON(updated);
      setUID(fresh);
      setIsEditingUsername(false);
      setUsernameInput("");
      toast.success("Username updated");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.log("Raw Error: ", err);
      const msg = err?.message ?? "Failed to update username";
      // Surface "already taken" cleanly
      setUsernameError(
        msg.toLowerCase().includes("taken")
          ? "That username is already taken"
          : msg,
      );
    } finally {
      setIsSavingUsername(false);
    }
  }, [uid, client, usernameInput]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PanelRoot>
        <DynamicPlaceholder loading>Loading Universal ID…</DynamicPlaceholder>
      </PanelRoot>
    );
  }

  // ── No ID or just deleted — show setup wizard ──────────────────────────────

  if (!uid || showSetupAfterDelete) {
    return (
      <PanelRoot>
        <MajikUniversalIDSetup
          majik={client}
          majikah={majikah}
          editUserUrl={editUserUrl}
          onComplete={handleSetupComplete}
        />
      </PanelRoot>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const pub = uid.toPublicView();
  const summary = uid.verificationSummary;
  const signingKey = uid.signingKey;

  const isUnverified = uid.tier === IDTier.UNVERIFIED;
  const hasActiveSession =
    !!sessionStatus && ACTIVE_SESSION_STATUSES.has(sessionStatus);

  // 30-day revoke lockout for verified IDs only
  const revokeLockedDays = uid.isVerified
    ? getRevokeLockedDaysRemaining(uid)
    : 0;
  const isRevokeLocked = revokeLockedDays > 0;

  // ── Verification CTA ───────────────────────────────────────────────────────

  const renderVerificationCTA = () => {
    if (!isUnverified) return null;

    if (hasActiveSession) {
      return (
        <VerifyCTA $status={sessionStatus!}>
          <VerifyCTATop>
            <VerifyCTAIcon>
              <ShieldWarningIcon size={18} weight="duotone" />
            </VerifyCTAIcon>
            <VerifyCTAText>
              <VerifyCTATitle>
                Verification in progress
                <SessionStatusBadge
                  $status={sessionStatus!}
                  style={{ marginLeft: 8 }}
                >
                  {sessionStatus}
                </SessionStatusBadge>
              </VerifyCTATitle>
              <VerifyCTAHint>
                {sessionStatus === "In Review"
                  ? "Your submission is under manual review. Check back later."
                  : sessionStatus === "Resubmitted"
                    ? "Some documents were flagged. Open the session to resubmit."
                    : "Complete your identity verification in the Didit session."}
              </VerifyCTAHint>
            </VerifyCTAText>
          </VerifyCTATop>
          <VerifyBtnRow>
            {verificationUrl && (
              <VerifyBtn
                $variant="primary"
                onClick={() =>
                 open(verificationUrl)
                }
              >
                <ArrowSquareOutIcon size={11} /> Continue in Didit
              </VerifyBtn>
            )}
            {/* <VerifyBtn
              $variant="ghost"
              onClick={handleCheckStatus}
              disabled={isPollingStatus}
            >
              {isPollingStatus ? (
                <SpinIcon>
                  <ArrowsClockwiseIcon size={11} />
                </SpinIcon>
              ) : (
                <ArrowsClockwiseIcon size={11} />
              )}
              Check Status
            </VerifyBtn> */}
            {sessionStatus !== "In Review" && (
              <VerifyBtn
                $variant="cancel"
                onClick={handleCancelVerification}
                disabled={isCancellingVerification}
              >
                {isCancellingVerification ? (
                  <SpinIcon>
                    <SpinnerIcon size={11} />
                  </SpinIcon>
                ) : (
                  <XCircleIcon size={11} />
                )}
                Cancel
              </VerifyBtn>
            )}
          </VerifyBtnRow>
        </VerifyCTA>
      );
    }
    const isDeclined =
      sessionStatus === "Declined" ||
      sessionStatus === "Expired" ||
      sessionStatus === "Kyc Expired" ||
      sessionStatus === "Abandoned";

    // A URL present with no active session means the session exists but hasn't
    // been opened yet (e.g. "Not Started" loaded from the JSON)
    const hasExistingUrl = !!verificationUrl;

    return (
      <VerifyCTA>
        <VerifyCTATop>
          <VerifyCTAIcon>
            <ShieldCheckIcon size={18} weight="duotone" />
          </VerifyCTAIcon>
          <VerifyCTAText>
            <VerifyCTATitle>
              {isDeclined
                ? "Restart verification"
                : hasExistingUrl
                  ? "Continue verification"
                  : "Verify your identity"}
            </VerifyCTATitle>
            <VerifyCTAHint>
              {isDeclined
                ? "Your previous session ended. Start a new verification to continue."
                : hasExistingUrl
                  ? "Your session is ready. Open it to complete your identity verification."
                  : "Complete Didit's KYC flow to unlock your full identity tier."}
            </VerifyCTAHint>
          </VerifyCTAText>
        </VerifyCTATop>
        <VerifyBtnRow>
          <VerifyBtn
            $variant="primary"
            onClick={handleStartVerification}
            disabled={isStartingVerification}
          >
            {isStartingVerification ? (
              <SpinIcon>
                <SpinnerIcon size={11} />
              </SpinIcon>
            ) : (
              <ShieldCheckIcon size={11} />
            )}
            {isStartingVerification
              ? "Starting…"
              : hasExistingUrl
                ? "Open Verification"
                : isDeclined
                  ? "Start Again"
                  : "Start Verification"}
          </VerifyBtn>
        </VerifyBtnRow>
      </VerifyCTA>
    );
  };

  // ── Delete / Revoke Action Card ────────────────────────────────────────────

  const renderDeleteCard = () => {
    if (uid.isVerified) {
      // Verified — show revoke with optional 30-day lockout
      return (
        <ActionCard $danger={!isRevokeLocked}>
          <ActionCardTop>
            <ActionCardIcon $danger={!isRevokeLocked}>
              {isRevokeLocked ? (
                <WarningCircleIcon size={18} weight="duotone" />
              ) : (
                <TrashIcon size={18} weight="duotone" />
              )}
            </ActionCardIcon>
            <ActionCardText>
              <ActionCardTitle>
                {isRevokeLocked ? "Revocation Locked" : "Revoke & Re-create ID"}
              </ActionCardTitle>
              <ActionCardHint>
                {isRevokeLocked
                  ? `Your ID was verified recently. Revocation is locked for ${revokeLockedDays} more day${revokeLockedDays !== 1 ? "s" : ""} to protect against abuse.`
                  : "Revoking your verified ID will nullify it permanently. You will need to create and re-verify a new one with updated information."}
              </ActionCardHint>
            </ActionCardText>
          </ActionCardTop>
          {!isRevokeLocked && (
            <ActionCardBtnRow>
              <DangerBtn onClick={() => setShowDeleteModal(true)}>
                <TrashIcon size={11} /> Revoke ID
              </DangerBtn>
            </ActionCardBtnRow>
          )}
        </ActionCard>
      );
    }

    // Unverified — show delete + edit profile shortcut
    return (
      <ActionCard>
        <ActionCardTop>
          <ActionCardIcon>
            <PencilSimpleIcon size={18} weight="duotone" />
          </ActionCardIcon>
          <ActionCardText>
            <ActionCardTitle>Need to update your info?</ActionCardTitle>
            <ActionCardHint>
              Delete this unverified ID and recreate it with your corrected
              personal information. The setup wizard will open automatically
              after deletion.
            </ActionCardHint>
          </ActionCardText>
        </ActionCardTop>
        <ActionCardBtnRow>
          <DangerBtn onClick={() => setShowDeleteModal(true)}>
            <TrashIcon size={11} /> Delete &amp; Re-create
          </DangerBtn>
          <EditBtn onClick={() => open(editUserUrl)}>
            <PencilSimpleIcon size={11} /> Edit Profile First
          </EditBtn>
        </ActionCardBtnRow>
      </ActionCard>
    );
  };

  // ── Delete Confirm Modal ───────────────────────────────────────────────────

  const renderDeleteModal = () => {
    if (!showDeleteModal) return null;
    const isVerified = uid.isVerified;
    return (
      <ModalOverlay
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowDeleteModal(false);
        }}
      >
        <ModalCard>
          <ModalIconWrap $shake={deleteShake}>
            <TrashIcon size={26} weight="duotone" />
          </ModalIconWrap>
          <ModalTitle>
            {isVerified ? "Revoke Universal ID?" : "Delete Universal ID?"}
          </ModalTitle>
          <ModalBody>
            {isVerified
              ? "This will permanently revoke and nullify your verified Universal ID. Your tier, verification history, and bound key association will be lost. This action cannot be undone."
              : "This will permanently delete your Universal ID. The setup wizard will open automatically so you can recreate it with your updated personal information."}
          </ModalBody>
          {isVerified ? (
            <ModalWarningBox>
              <WarningCircleIcon
                size={14}
                weight="fill"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <span>
                <strong>This is irreversible.</strong> Your verified identity
                and all associated trust signals will be permanently destroyed.
                You will need to complete the full KYC process again.
              </span>
            </ModalWarningBox>
          ) : (
            <LockoutBanner>
              <WarningCircleIcon
                size={14}
                weight="fill"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <span>
                After deletion, the setup wizard will open automatically so you
                can recreate your ID with updated information.
              </span>
            </LockoutBanner>
          )}
          <ModalBtnRow>
            <ModalCancelBtn
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeletingUID}
            >
              Cancel
            </ModalCancelBtn>
            <ModalConfirmBtn onClick={handleDeleteUID} disabled={isDeletingUID}>
              {isDeletingUID ? (
                <SpinIcon>
                  <ArrowsClockwiseIcon size={12} />
                </SpinIcon>
              ) : (
                <TrashIcon size={12} />
              )}
              {isDeletingUID
                ? isVerified
                  ? "Revoking…"
                  : "Deleting…"
                : isVerified
                  ? "Yes, Revoke"
                  : "Yes, Delete"}
            </ModalConfirmBtn>
          </ModalBtnRow>
        </ModalCard>
      </ModalOverlay>
    );
  };

  // ── Decrypt dialog ─────────────────────────────────────────────────────────

  const renderDecryptDialog = () => (
    <>
      {/* Hidden file input */}
      <input
        ref={decryptFileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleDecryptFile(file);
          if (decryptFileRef.current) decryptFileRef.current.value = "";
        }}
      />

      <DynamicPopUp
        isOpen={showDecryptDialog}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDecryptKey(null);
            setDecryptError(null);
          }
          setShowDecryptDialog(open);
        }}
        modal={{
          title: "Decrypt Private Info",
          description:
            "Load your Majik Key seed backup (.json) to temporarily decrypt your private identity fields.",
        }}
        buttons={{
          cancel: {
            text: "Cancel",
            onClick: () => {
              setDecryptKey(null);
              setDecryptError(null);
            },
          },
          confirm: {
            text: isDecrypting ? "Decrypting…" : "Decrypt",
            onClick: handleDecryptConfirm,
            isDisabled: !decryptKey || isDecrypting,
          },
        }}
      >
        {/* Drop zone — visible until a key is loaded */}
        {!decryptKey ? (
          <DecryptDropZone
            $dragging={decryptIsDragging}
            $hasFile={false}
            onDragOver={(e) => {
              e.preventDefault();
              setDecryptIsDragging(true);
            }}
            onDragLeave={() => setDecryptIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDecryptIsDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleDecryptFile(file);
            }}
            onClick={() => decryptFileRef.current?.click()}
          >
            <DecryptDropIcon $hasFile={false}>
              <UploadSimpleIcon size={22} />
            </DecryptDropIcon>
            <DecryptDropTitle>
              {decryptIsDragging
                ? "Release to load"
                : "Drop your seed key file here"}
            </DecryptDropTitle>
            <DecryptDropHint>
              Accepts the .json backup exported when you created your account.
              <br />
              Loaded into memory only — never re-uploaded.
            </DecryptDropHint>
            <DecryptBrowseBtn>
              <FilePlusIcon size={12} /> Browse files
            </DecryptBrowseBtn>
          </DecryptDropZone>
        ) : (
          /* Key loaded */
          <DecryptLoadedCard>
            <DecryptLoadedIcon>
              <FilePlusIcon size={16} />
            </DecryptLoadedIcon>
            <DecryptLoadedMeta>
              <DecryptLoadedName>
                {decryptKey.publicKeyBase64}
              </DecryptLoadedName>
              <DecryptLoadedSub>
                {decryptKey.fingerprint.slice(0, 28)}…
              </DecryptLoadedSub>
            </DecryptLoadedMeta>
            <DecryptClearBtn
              onClick={() => {
                setDecryptKey(null);
                setDecryptError(null);
              }}
              title="Remove key"
            >
              <XCircleIcon size={15} />
            </DecryptClearBtn>
          </DecryptLoadedCard>
        )}

        {/* Ready banner */}
        {decryptKey && !decryptError && (
          <DecryptReadyBox>
            <CheckCircleIcon
              size={14}
              weight="fill"
              style={{ flexShrink: 0 }}
            />
            Key unlocked — click Decrypt to reveal your private info.
          </DecryptReadyBox>
        )}

        {/* Error banner */}
        {decryptError && (
          <DecryptErrorBox>
            <WarningCircleIcon
              size={14}
              weight="fill"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            {decryptError}
          </DecryptErrorBox>
        )}
      </DynamicPopUp>
    </>
  );

  return (
    <PanelRoot>
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-universal-id/docs"
        // startTour={() => launchTutorialAccounts(tour)}
        id="guide-muid-panel"
      />
      {renderDeleteModal()}
      {renderDecryptDialog()}
      <Toolbar>
        <IdentificationCardIcon size={16} weight="duotone" />
        <ToolbarTitle>Universal ID</ToolbarTitle>
        <IconBtn
          onClick={() => setRefreshTick((t) => t + 1)}
          title="Refresh"
          disabled={loading}
        >
          {loading ? (
            <SpinIcon>
              <ArrowsClockwiseIcon size={13} />
            </SpinIcon>
          ) : (
            <ArrowsClockwiseIcon size={13} />
          )}
        </IconBtn>
        <IconBtn
          onClick={() => copyToClipboard(uid.toBase64(), "ID copied")}
          title="Export ID"
        >
          <DownloadIcon size={13} />
        </IconBtn>
        <IconBtn
          onClick={() =>
            copyToClipboard(
              `https://id.majikah.solutions/id/${uid.username ?? uid.id}`,
              "Public profile URL copied",
            )
          }
          title="Share"
        >
          <ShareIcon size={13} />
        </IconBtn>
        {/* <IconBtn
          onClick={(e) => {
            e.stopPropagation();
            setIsEmbedDrawerOpen(true);
          }}
          title="Embed"
        >
          <CodeIcon size={13} />
        </IconBtn> */}
        {/* Toolbar-level delete / revoke shortcut — hidden during lockout */}
        {!isRevokeLocked && (
          <DangerIconBtn
            onClick={() => setShowDeleteModal(true)}
            title={uid.isVerified ? "Revoke ID" : "Delete & Re-create ID"}
          >
            <TrashIcon size={13} />
          </DangerIconBtn>
        )}
      </Toolbar>

      <ScrollBody>
        {/* ── Hero Card ──────────────────────────────────────────────── */}
        <HeroCard>
          <HeroTop>
            <HeroLeft>
              <UserAvatar // ← replaces AvatarCircle
                src={userImage}
                alt={pub.display_name || uid.userRef.display_name}
                editable
                shape="circle"
                size={80}
                borderWidth={3}
                borderRadius="14px" // keeps the rounded-square feel of the original
                tierColor={tierGradient(uid.tier)}
                isLoading={avatarUploading}
                fallback={
                  uid.isVerified ? (
                    <ShieldCheckIcon size={22} weight="duotone" />
                  ) : (
                    <ShieldWarningIcon size={22} weight="duotone" />
                  )
                }
                onUpload={async (file) => {
                  setAvatarUploading(true);
                  try {
                    await majikah.uploadAvatar(file);
                    toast.success("New avatar uploaded successfully");

                    setRefreshTick((t) => t + 1);
                  } catch (e) {
                    toast.error("Upload Failed", {
                      description: `There seems to be a problem while uploading. ${e}`,
                    });
                  } finally {
                    setAvatarUploading(false);
                  }
                }}
                onDelete={async () => {
                  await majikah.deleteAvatar();
                }}
              />
              <HeroMeta>
                <HeroName>
                  {pub.display_name || uid.userRef.display_name}
                </HeroName>
                <HeroID>{uid.id}</HeroID>
              </HeroMeta>
            </HeroLeft>
            <TierBadge $tier={uid.tier.toLowerCase()}>
              <span>{uid.tier}</span>
            </TierBadge>
          </HeroTop>

          <HeroStats>
            <StatChip>
              <StatLabel>Status</StatLabel>
              <StatValue style={{ textTransform: "capitalize" }}>
                {uid.status.replace(/_/g, " ")}
              </StatValue>
            </StatChip>
            <StatChip>
              <StatLabel>Mutable</StatLabel>
              <StatValue>{uid.isMutable ? "Yes" : "No"}</StatValue>
            </StatChip>
            <StatChip>
              <StatLabel>Created</StatLabel>
              <StatValue>
                {new Date(uid.timestamp).toLocaleDateString()}
              </StatValue>
            </StatChip>
            <StatChip>
              <StatLabel>Updated</StatLabel>
              <StatValue>
                {new Date(uid.lastUpdate).toLocaleDateString()}
              </StatValue>
            </StatChip>
          </HeroStats>
        </HeroCard>

        {/* ── Verification CTA ───────────────────────────────────────── */}
        {renderVerificationCTA()}

        {/* ── Delete / Revoke Action Card ─────────────────────────────── */}
        {renderDeleteCard()}

        {/* ── Public Profile ─────────────────────────────────────────── */}
        <Section>
          <SectionHead>
            <SectionTitle>
              <UserIcon size={11} /> Public Profile
            </SectionTitle>
          </SectionHead>
          <Card>
            {/* Username row — always shown, editable inline */}
            <FieldRow>
              <FieldIcon>
                <IdentificationCardIcon size={14} />
              </FieldIcon>
              <FieldContent>
                <FieldLabel>Username</FieldLabel>
                {isEditingUsername ? (
                  <>
                    <UsernameEditRow>
                      <UsernameInput
                        autoFocus
                        value={usernameInput}
                        placeholder={uid.username ?? "yourhandle"}
                        maxLength={32}
                        onChange={(e) => {
                          setUsernameInput(e.target.value);
                          setUsernameError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveUsername();
                          if (e.key === "Escape") {
                            setIsEditingUsername(false);
                            setUsernameInput("");
                            setUsernameError(null);
                          }
                        }}
                      />
                      <UsernameActionBtn
                        $variant="confirm"
                        onClick={handleSaveUsername}
                        disabled={isSavingUsername || !usernameInput.trim()}
                        title="Save"
                      >
                        {isSavingUsername ? (
                          <SpinIcon>
                            <ArrowsClockwiseIcon size={11} />
                          </SpinIcon>
                        ) : (
                          <CheckCircleIcon size={11} />
                        )}
                      </UsernameActionBtn>
                      <UsernameActionBtn
                        $variant="cancel"
                        onClick={() => {
                          setIsEditingUsername(false);
                          setUsernameInput("");
                          setUsernameError(null);
                        }}
                        disabled={isSavingUsername}
                        title="Cancel"
                      >
                        <XCircleIcon size={11} />
                      </UsernameActionBtn>
                    </UsernameEditRow>
                    {usernameError ? (
                      <UsernameHint $error>{usernameError}</UsernameHint>
                    ) : (
                      <UsernameHint>
                        Letters and numbers only, no spaces
                      </UsernameHint>
                    )}
                  </>
                ) : (
                  <UsernameEditRow>
                    <FieldValue style={{ flex: 1 }}>
                      {uid.username ? (
                        <>@{uid.username}</>
                      ) : (
                        <EmptyField>Not set</EmptyField>
                      )}
                    </FieldValue>
                    <UsernameActionBtn
                      $variant="confirm"
                      onClick={() => {
                        setUsernameInput(uid.username ?? "");
                        setUsernameError(null);
                        setIsEditingUsername(true);
                      }}
                      title="Edit username"
                    >
                      <PencilSimpleIcon size={11} />
                    </UsernameActionBtn>
                  </UsernameEditRow>
                )}
              </FieldContent>
            </FieldRow>
            <FieldRow>
              <FieldIcon>
                <UserIcon size={14} />
              </FieldIcon>
              <FieldContent>
                <FieldLabel>Display Name</FieldLabel>
                <FieldValue data-private>
                  {pub.display_name ||
                    (pub.public_profile?.display_name as string) || (
                      <EmptyField>Not set</EmptyField>
                    )}
                </FieldValue>
              </FieldContent>
            </FieldRow>
            {(pub.public_profile?.bio as string) && (
              <FieldRow>
                <FieldIcon>
                  <UserIcon size={14} />
                </FieldIcon>
                <FieldContent>
                  <FieldLabel>Bio</FieldLabel>
                  <FieldValue data-private>
                    {pub.public_profile.bio as string}
                  </FieldValue>
                </FieldContent>
              </FieldRow>
            )}
            {(pub.public_profile?.location_label as string) && (
              <FieldRow>
                <FieldIcon>
                  <MapPinIcon size={14} />
                </FieldIcon>
                <FieldContent>
                  <FieldLabel>Location</FieldLabel>
                  <FieldValue data-private>
                    {pub.public_profile.location_label as string}
                  </FieldValue>
                </FieldContent>
              </FieldRow>
            )}
            <FieldRow>
              <FieldIcon>
                <ClockIcon size={14} />
              </FieldIcon>
              <FieldContent>
                <FieldLabel>Member Since</FieldLabel>
                <FieldValue data-private>
                  {new Date(uid.timestamp).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </FieldValue>
              </FieldContent>
            </FieldRow>
          </Card>
        </Section>

        {/* ── Private Info ───────────────────────────────────────────── */}
        <Section>
          <SectionHead>
            <SectionTitle>
              <LockKeyIcon size={11} weight="fill" /> Private Info
            </SectionTitle>
            {!privateInfo && (
              <SectionAction onClick={handleDecrypt} disabled={isDecrypting}>
                {isDecrypting ? (
                  <SpinIcon>
                    <ArrowsClockwiseIcon size={11} />
                  </SpinIcon>
                ) : (
                  <LockOpenIcon size={11} />
                )}
                Decrypt
              </SectionAction>
            )}
          </SectionHead>

          {!privateInfo ? (
            <LockedBanner>
              <LockKeyIcon
                size={20}
                weight="duotone"
                style={{
                  color: "var(--text-secondary)",
                  opacity: 0.4,
                  flexShrink: 0,
                }}
              />
              <LockedText>
                <LockedTitle>Private info is encrypted</LockedTitle>
                <LockedHint>
                  Decrypt using your unlocked Majik Key to view personal
                  details.
                </LockedHint>
              </LockedText>
              <DecryptBtn onClick={handleDecrypt} disabled={isDecrypting}>
                {isDecrypting ? (
                  <SpinIcon>
                    <ArrowsClockwiseIcon size={11} />
                  </SpinIcon>
                ) : (
                  <LockOpenIcon size={11} weight="fill" />
                )}
                {isDecrypting ? "Decrypting…" : "Decrypt"}
              </DecryptBtn>
            </LockedBanner>
          ) : (
            <Card>
              {privateInfo.legal_first_name && (
                <FieldRow>
                  <FieldIcon>
                    <UserIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Legal Name</FieldLabel>
                    <FieldValue data-private>
                      {[
                        privateInfo.legal_first_name,
                        privateInfo.legal_middle_name,
                        privateInfo.legal_last_name,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      {privateInfo.legal_name_suffix
                        ? `, ${privateInfo.legal_name_suffix}`
                        : ""}
                    </FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
              {privateInfo.primary_email && (
                <FieldRow>
                  <FieldIcon>
                    <EnvelopeIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Email</FieldLabel>
                    <FieldValue data-private>
                      {privateInfo.primary_email}
                    </FieldValue>
                  </FieldContent>
                  <FieldCopyBtn
                    onClick={() =>
                      copyToClipboard(
                        privateInfo.primary_email!,
                        "Email copied",
                      )
                    }
                  >
                    <CopyIcon size={12} />
                  </FieldCopyBtn>
                </FieldRow>
              )}
              {privateInfo.primary_phone && (
                <FieldRow>
                  <FieldIcon>
                    <PhoneIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Phone</FieldLabel>
                    <FieldValue data-private>
                      {privateInfo.primary_phone}
                    </FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
              {privateInfo.date_of_birth && (
                <FieldRow>
                  <FieldIcon>
                    <CalendarIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Date of Birth</FieldLabel>
                    <FieldValue data-private>
                      {privateInfo.date_of_birth}
                    </FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
              {privateInfo.gender && (
                <FieldRow>
                  <FieldIcon>
                    <UserIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Gender</FieldLabel>
                    <FieldValue data-private>{privateInfo.gender}</FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
              {privateInfo.nationality && (
                <FieldRow>
                  <FieldIcon>
                    <GlobeIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Nationality</FieldLabel>
                    <FieldValue data-private>
                      {privateInfo.nationality || (
                        <EmptyField>Filled after ID verification</EmptyField>
                      )}
                    </FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
              {privateInfo.home_address && (
                <FieldRow>
                  <FieldIcon>
                    <MapPinIcon size={14} />
                  </FieldIcon>
                  <FieldContent>
                    <FieldLabel>Home Address</FieldLabel>
                    <FieldValue data-private>
                      {[
                        privateInfo.home_address.line1,
                        privateInfo.home_address.line2,
                        privateInfo.home_address.barangay,
                        privateInfo.home_address.city,
                        privateInfo.home_address.state_province,
                        privateInfo.home_address.postal_code,
                        privateInfo.home_address.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </FieldValue>
                  </FieldContent>
                </FieldRow>
              )}
            </Card>
          )}
        </Section>

        {/* ── Verification Progress ──────────────────────────────────── */}
        <Section>
          <SectionHead>
            <SectionTitle>
              <ShieldCheckIcon size={11} weight="fill" /> Verification
            </SectionTitle>
          </SectionHead>
          <StagesGrid>
            {ALL_STAGES.map((stage) => {
              const passed = summary.completed_stages.includes(
                stage as DiditStage,
              );
              return (
                <StageRow key={stage} $passed={passed}>
                  <StageDot $passed={passed} />
                  <StageName>
                    {STAGE_LABELS[stage] || stage.replace(/_/g, " ")}
                  </StageName>
                  <StageStatus $passed={passed}>
                    {passed ? "Passed" : "Pending"}
                  </StageStatus>
                </StageRow>
              );
            })}
          </StagesGrid>
        </Section>

        {/* ── Signing Key ────────────────────────────────────────────── */}
        <Section>
          <SectionHead>
            <SectionTitle>
              <LockKeyIcon size={11} weight="fill" /> Bound Key
            </SectionTitle>
          </SectionHead>
          <KeyCard>
            <KeyIconBox>
              <LockKeyIcon size={16} weight="duotone" />
            </KeyIconBox>
            <KeyMeta>
              <KeyFingerprint data-private>
                {signingKey.fingerprint.slice(0, 28)}…
              </KeyFingerprint>
              <KeySub data-private>
                KDF v{signingKey.kdf_version} · Registered{" "}
                {new Date(signingKey.registered_at).toLocaleDateString()}
              </KeySub>
            </KeyMeta>
            <FieldCopyBtn
              onClick={() =>
                copyToClipboard(signingKey.fingerprint, "Fingerprint copied")
              }
              title="Copy fingerprint"
            >
              <CopyIcon size={13} />
            </FieldCopyBtn>
          </KeyCard>
        </Section>

        {/* ── Identity Hash ──────────────────────────────────────────── */}
        <Section>
          <SectionHead>
            <SectionTitle>
              <IdentificationCardIcon size={11} weight="fill" /> Identity Hash
            </SectionTitle>
          </SectionHead>
          <Card>
            <FieldRow>
              <FieldContent>
                <FieldLabel>SHA3-512</FieldLabel>
                <FieldMono data-private>{uid.hash.slice(0, 48)}…</FieldMono>
              </FieldContent>
              <FieldCopyBtn
                onClick={() => copyToClipboard(uid.hash, "Hash copied")}
              >
                <CopyIcon size={12} />
              </FieldCopyBtn>
            </FieldRow>
          </Card>
        </Section>
      </ScrollBody>
      {/* <DynamicSlidingDialogue
        isOpen={isEmbedDrawerOpen}
        onOpenChange={(e) => {
          setIsEmbedDrawerOpen(e);
        }}
        scrollable={true}
        buttons={{
          cancel: { text: "Close", hide: false },
          confirm: { text: "Save Changes", hide: true },
        }}
        modal={{
          title: `Embed Majik Universal ID`,
          description: "",
        }}
        width={1200}
        preventDragClose
      >
        <MUIDEmbedGenerator muidKey={uid?.username || uid.id} />
      </DynamicSlidingDialogue> */}
    </PanelRoot>
  );
};

export default UniversalIdPanel;

function tierGradient(tier: string): string {
  switch (tier.toLowerCase()) {
    case "trusted":
      return "linear-gradient(135deg,#34d399,#10b981)";
    case "enhanced":
      return "linear-gradient(135deg,#f97316,#ea580c)";
    case "verified":
      return "linear-gradient(135deg,#60a5fa,#3b82f6)";
    case "basic":
      return "linear-gradient(135deg,#fbbf24,#d97706)";
    default:
      return "linear-gradient(135deg,#4b5563,#374151)";
  }
}
