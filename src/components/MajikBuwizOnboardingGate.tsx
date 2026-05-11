import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { keyframes } from "styled-components";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DownloadSimpleIcon,
  FilePlusIcon,
  IdentificationBadgeIcon,
  KeyboardIcon,
  MagicWandIcon,
  ShieldCheckIcon,
  ShieldPlusIcon,
  UploadSimpleIcon,
  UserCircleIcon,
  WifiHighIcon,
  WifiSlashIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/globals/styled-dialogs";
import CustomInputField from "@/components/foundations/CustomInputField";
import { SeedKeyInput } from "@/components/foundations/SeedKeyInput";
import {
  InvoiceDefaults,
  jsonToSeed,
  seedStringToArray,
  type MnemonicJSON,
} from "@/SDK/majik-buwiz-client/src/index";
import { downloadBlob, prepareDownloadAnchor } from "@/utils/utils";
import type { MajikahSession } from "./majikah-session-wrapper/majikah-session";
import DropImportAccount from "./foundations/DropImportAccount";
import { useMajikTutorials } from "@/hooks/use-majik-tutorials";
import { useMajikPreferences } from "@/hooks/use-majik-preferences";
import DynamicAlertBanner from "./foundations/DynamicAlertBanner";
import { MajikBuwizDatabase } from "./majik-context-wrapper/majik-buwiz-database";
import { MajikInvoiceContactMeta } from "@/SDK/majik-buwiz-client/src/core/party/types";
import { useMajikah } from "./majikah-session-wrapper/use-majikah";
import { MajikKey } from "@majikah/majik-key";
import {
  MajikUniversalID,
  type MajikUniversalIDJSON,
} from "@majikah/majik-universal-id";
import UserAuth from "@/components/foundations/UserAuth";
import { MajikBytes } from "@majikah/majik-bytes";
import JSZip from "jszip";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

const checkPop = keyframes`
  0%   { transform: scale(0.4); opacity: 0; }
  70%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

const dropPulse = keyframes`
  0%, 100% { border-color: ${({ theme }: { theme: any }) => theme?.colors?.primary || "#E05C1A"}; }
  50%       { border-color: transparent; }
`;

// ─── Dialog overrides ─────────────────────────────────────────────────────────

const GateContent = styled(DialogContent)`
  max-width: 500px;
  width: 100%;
`;

// ─── Step container ───────────────────────────────────────────────────────────

const StepWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 20px 8px;
  animation: ${fadeIn} 0.22s ease both;
`;

// ─── Step progress ─────────────────────────────────────────────────────────────

const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0 2px;
`;

const ProgressStep = styled.div<{ $state: "done" | "active" | "pending" }>`
  flex: 1;
  height: 3px;
  border-radius: 100px;
  transition: all 0.35s ease;
  background: ${({ $state, theme }) =>
    $state === "done"
      ? theme.colors.primary || "#E05C1A"
      : $state === "active"
        ? theme.colors.textPrimary
        : theme.colors.secondaryBackground};
  opacity: ${({ $state }) => ($state === "pending" ? 0.3 : 1)};
`;

const StepLabelRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 4px 0 0;
`;

const StepLabelItem = styled.span<{ $active: boolean }>`
  font-size: 9px;
  font-weight: ${({ $active }) => ($active ? "700" : "400")};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.textPrimary : theme.colors.textSecondary};
  opacity: ${({ $active }) => ($active ? 1 : 0.45)};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: all 0.2s;
  flex: 1;
  text-align: center;

  &:first-child {
    text-align: left;
  }
  &:last-child {
    text-align: right;
  }
`;

// ─── Icon badge ───────────────────────────────────────────────────────────────

const IconBadge = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  flex-shrink: 0;
`;

const StepHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const StepTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  letter-spacing: -0.01em;
`;

const StepHint = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: 1.6;
  opacity: 0.7;
`;

// ─── Choice cards ─────────────────────────────────────────────────────────────

const ChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const ChoiceCard = styled.button<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 14px 12px;
  border-radius: 10px;
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected
        ? theme.colors.accent || "#E05C1A"
        : theme.colors.secondaryBackground};
  background: ${({ $selected, theme }) =>
    $selected
      ? `${theme.colors.accent || "#E05C1A"}12`
      : theme.colors.secondaryBackground};
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.18s,
    background 0.18s;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const ChoiceIcon = styled.span<{ $selected: boolean }>`
  color: ${({ $selected, theme }) =>
    $selected ? theme.colors.accent || "#E05C1A" : theme.colors.textSecondary};
  transition: color 0.18s;
`;

const ChoiceLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const ChoiceDesc = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.65;
  line-height: 1.5;
`;

// ─── Import mode toggle ───────────────────────────────────────────────────────

const ImportModeToggle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
`;

const ModeToggleButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary : theme.colors.secondaryBackground};
  background: ${({ theme, $active }) =>
    $active ? `${theme.colors.primary}18` : theme.colors.secondaryBackground};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  letter-spacing: 0.02em;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// ─── Invoice form ─────────────────────────────────────────────────────────────

const FormGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const FormLabel = styled.label`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
`;

const FormInput = styled.input`
  width: 100%;
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  transition: all 0.15s;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
    background: ${({ theme }) => theme.colors.primaryBackground};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.35;
  }
`;

const FormTextarea = styled.textarea`
  width: 100%;
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  transition: all 0.15s;
  box-sizing: border-box;
  resize: vertical;
  min-height: 60px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
    background: ${({ theme }) => theme.colors.primaryBackground};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.35;
  }
`;

const SectionSubhead = styled.div`
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  padding: 4px 0 2px;
`;

const FormDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  margin: 2px 0;
`;

// ─── Key drop zone ────────────────────────────────────────────────────────────

const DropZone = styled.div<{ $dragging: boolean; $hasFile: boolean }>`
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
  animation: ${({ $dragging }) => ($dragging ? dropPulse : "none")} 0.8s linear
    infinite;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
    background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}06`};
  }
`;

const DropZoneIcon = styled.div<{ $hasFile: boolean }>`
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

const DropZoneTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const DropZoneHint = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  line-height: 1.45;
`;

const BrowseBtn = styled.span`
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
  cursor: pointer;
  &:hover {
    opacity: 0.8;
  }
`;

const LoadedKeyCard = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const LoadedKeyIcon = styled.div`
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

const LoadedKeyMeta = styled.div`
  flex: 1;
  min-width: 0;
`;

const LoadedKeyName = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LoadedKeySub = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const ClearBtn = styled.button`
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

const KeyUnlockedBox = styled.div`
  padding: 12px 14px;
  background: rgba(34, 197, 94, 0.07);
  border: 1px solid rgba(34, 197, 94, 0.18);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const KeyUnlockedRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const KeyFingerprintText = styled.div`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  opacity: 0.55;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// ─── Online / MUID step ───────────────────────────────────────────────────────

const OnlineChoiceWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const OnlineOptionCard = styled.button<{
  $selected: boolean;
  $offline?: boolean;
}>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s,
    background 0.18s;
  border: 1px solid
    ${({ $selected, $offline, theme }) =>
      $selected
        ? $offline
          ? "rgba(156,163,175,0.4)"
          : theme.colors.primary || "#E05C1A"
        : theme.colors.secondaryBackground};
  background: ${({ $selected, $offline, theme }) =>
    $selected
      ? $offline
        ? "rgba(156,163,175,0.07)"
        : `${theme.colors.primary || "#E05C1A"}10`
      : theme.colors.secondaryBackground};

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const OnlineOptionIcon = styled.div<{ $offline?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${({ $offline }) =>
    $offline ? "rgba(156,163,175,0.1)" : "rgba(224,92,26,0.1)"};
  color: ${({ $offline }) => ($offline ? "#9ca3af" : "#E05C1A")};
`;

const OnlineOptionMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const OnlineOptionTitle = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const OnlineOptionDesc = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  line-height: 1.5;
`;

// ─── MUID creation inline ─────────────────────────────────────────────────────

const MUIDCreationWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const MUIDInfoCard = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const MUIDInfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
`;

const MUIDInfoLabel = styled.span`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  flex-shrink: 0;
`;

const MUIDInfoValue = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
`;

const MUIDTierBadge = styled.span`
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: 20px;
  background: rgba(156, 163, 175, 0.12);
  color: #9ca3af;
`;

const ErrorBanner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 11px;
  color: #ef4444;
  line-height: 1.5;
`;

// ─── Success ──────────────────────────────────────────────────────────────────

const SuccessWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  animation: ${fadeIn} 0.3s ease both;
`;

const SuccessIconWrap = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: ${({ theme }) => `${theme.colors.primary || "#E05C1A"}15`};
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${checkPop} 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
`;

const SuccessTitle = styled.h3`
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  text-align: center;
  letter-spacing: -0.025em;
`;

const SuccessDesc = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  text-align: center;
  line-height: 1.6;
  opacity: 0.65;
  max-width: 320px;
`;

// ─── Account list (register step remnant — reused for display) ────────────────

const AccountList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
  scrollbar-width: thin;
`;

const AccountRow = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected
        ? theme.colors.accent || "#E05C1A"
        : theme.colors.secondaryBackground};
  background: ${({ $selected, theme }) =>
    $selected ? `${theme.colors.accent || "#E05C1A"}12` : "transparent"};
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s,
    background 0.15s;
  width: 100%;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`;

const AccountMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`;

const AccountName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AccountID = styled.span`
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ─── Loading shimmer ──────────────────────────────────────────────────────────

const ShimmerText = styled.span`
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.5) 0%,
    rgba(255, 255, 255, 1) 50%,
    rgba(255, 255, 255, 0.5) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${shimmer} 1.6s linear infinite;
`;

// ─── Action footer ────────────────────────────────────────────────────────────

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 18px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  gap: 10px;
`;

const SkipLink = styled.button`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;

  &:hover {
    opacity: 0.9;
  }
`;

const NavButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const NavButton = styled.button<{ $primary?: boolean; $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity 0.15s,
    background 0.15s;
  white-space: nowrap;
  border: 1px solid
    ${({ $primary, $danger, theme }) =>
      $danger
        ? "rgba(239,68,68,0.3)"
        : $primary
          ? theme.colors.primary
          : theme.colors.secondaryBackground};
  background: ${({ $primary, $danger, theme }) =>
    $danger
      ? "rgba(239,68,68,0.08)"
      : $primary
        ? theme.colors.primary
        : "transparent"};
  color: ${({ $primary, $danger, theme }) =>
    $danger ? "#ef4444" : $primary ? "#fff" : theme.colors.textSecondary};

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    opacity: 0.85;
  }
`;

const ScrollContainer = styled.div`
  width: inherit;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0.5rem 20px;
  max-height: calc(85vh - 220px);
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) =>
      theme.gradients?.primary || theme.colors.primary};
    border-radius: 8px;
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountMode = "create" | "import" | null;

/**
 * Gate phases in order:
 *   account  → no local accounts at all
 *   invoice  → fill out invoice / business meta
 *   online   → choose: stay offline OR create a Universal ID online
 *   muid     → authenticate + create MUID (sub-flow of "online" choice)
 *   tour     → first-time tour
 *   done     → gate complete, render children normally
 */
type GatePhase = "account" | "invoice" | "online" | "muid" | "tour" | "done";

/**
 * Online sub-steps when the user chooses "Go Online":
 *   auth    → sign in / sign up
 *   key     → drop seed-key backup to bind to MUID
 *   success → MUID created
 */
type OnlineStep = "auth" | "key" | "success";

type BypassOption = "invoice" | "online" | "muid" | "tour";

interface MajikBuwizOnboardingGateProps {
  children: React.ReactNode;
  majikah: MajikahSession;
  majik: MajikBuwizDatabase;
  onUpdate?: (updated: MajikBuwizDatabase) => void;
  onLaunchTour?: () => Promise<void> | void;
  /** Pass phase names to skip them, e.g. ["invoice", "online"]. Default: []. */
  bypass?: BypassOption[];
}

// ─── Step config ──────────────────────────────────────────────────────────────

const GATE_STEPS: { id: GatePhase; label: string }[] = [
  { id: "account", label: "Key" },
  { id: "invoice", label: "Business" },
  { id: "online", label: "Network" },
  { id: "done", label: "Done" },
];

// ─── Component ────────────────────────────────────────────────────────────────

const MajikBuwizOnboardingGate: React.FC<MajikBuwizOnboardingGateProps> = ({
  children,
  bypass = [],
  majik,
  onUpdate,
  onLaunchTour,
}) => {
  const { hasPreference, add: addPreference } = useMajikPreferences();
  const { hasTutorial } = useMajikTutorials();
  const { majikah } = useMajikah();

  const [phase, setPhase] = useState<GatePhase | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Account step ───────────────────────────────────────────────────────────
  const [accountMode, setAccountMode] = useState<AccountMode>(null);
  const [label, setLabel] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [mnemonicJSON, setMnemonicJSON] = useState<MnemonicJSON>({
    id: "",
    seed: Array(12).fill(""),
    phrase: "",
  });
  const [mnemonic, setMnemonic] = useState("");
  const [importMode, setImportMode] = useState<"drop" | "manual">("drop");

  // ── Invoice step ───────────────────────────────────────────────────────────
  const [invoiceMeta, setInvoiceMeta] = useState<
    Partial<MajikInvoiceContactMeta>
  >({});
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);

  // ── Online step ────────────────────────────────────────────────────────────
  const [onlineChoice, setOnlineChoice] = useState<"online" | "offline" | null>(
    null,
  );
  const [onlineStep, setOnlineStep] = useState<OnlineStep>("auth");

  // ── MUID key-loading (online/muid sub-step) ────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [loadedKey, setLoadedKey] = useState<MajikKey | null>(null);
  const [muidKeyError, setMuidKeyError] = useState<string | null>(null);
  const [isCreatingMUID, setIsCreatingMUID] = useState(false);
  const [createdMUID, setCreatedMUID] = useState<MajikUniversalID | null>(null);
  const muidFileRef = useRef<HTMLInputElement>(null);

  // ─── Phase initialisation ──────────────────────────────────────────────────

  useEffect(() => {
    const accounts = majik.listOwnAccounts();
    const hasAccounts = accounts.length > 0;

    if (!hasAccounts) {
      setPhase("account");
      return;
    }

    // Accounts exist — check whether invoice phase should be shown
    if (!bypass.includes("invoice")) {
      // We use a preference flag to know if the user already completed invoice
      const invoiceDone = hasPreference("majik_invoice_meta_complete");
      if (!invoiceDone) {
        setPhase("invoice");
        return;
      }
    }

    // Invoice done (or bypassed) — check online phase
    if (!bypass.includes("online")) {
      const unregistered = accounts.filter((a) => !a.isMajikahRegistered());
      const allSkipped = unregistered.every((a) =>
        hasPreference(`majik_skip_register_${a.id}`),
      );
      if (!allSkipped && unregistered.length > 0) {
        setPhase("online");
        return;
      }
    }

    setPhase("tour");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey]);

  // ── Pre-fill invoice defaults ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "invoice") return;
    let mounted = true;

    (async () => {
      try {
        const defaults = await majik.getInvoiceDefaults();
        if (!mounted) return;

        // Priority: invoice defaults → majikah user metadata
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = majikah?.user;
        const userFullName = user?.fullName;
        const userMeta = user?.metadata;

        setInvoiceMeta({
          // Start from existing defaults if any
          legalName: defaults?.issuer?.legalName ?? userFullName ?? "",
          tradeName: defaults?.issuer?.tradeName ?? "",
          tin: defaults?.issuer?.tin ?? "",
          email: defaults?.issuer?.email ?? user?.email ?? "",
          phone: defaults?.issuer?.phone ?? userMeta?.phone ?? "",
          website: defaults?.issuer?.website ?? "",
          address: defaults?.issuer?.address ?? undefined,
          taxIdType: defaults?.issuer?.taxIdType ?? undefined,
          taxExempt: defaults?.issuer?.taxExempt ?? false,
          taxExemptRef: defaults?.issuer?.taxExemptRef ?? "",
          natureOfBusiness: defaults?.issuer?.natureOfBusiness ?? "",
          notes: defaults?.notes ?? "",
          label: defaults?.issuer?.tradeName ?? user?.displayName ?? "",
        });
      } catch (err) {
        console.error(
          "[MajikBuwizOnboardingGate] Failed to load invoice defaults",
          err,
        );
      }
    })();

    return () => {
      mounted = false;
    };
  }, [phase, majik, majikah?.user]);

  // ── Tour trigger ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "tour") return;

    if (hasTutorial("tutorial-majik-buwiz-onboarding:v:0.0.1")) {
      setPhase("done");
      return;
    }

    const runTour = async (): Promise<void> => {
      try {
        await onLaunchTour?.();
      } catch {
        /* non-fatal */
      } finally {
        setPhase("done");
      }
    };

    runTour();
  }, [phase, onLaunchTour, hasTutorial]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const refresh = (): void => setRefreshKey((k) => k + 1);

  const resetAccountForm = useCallback((): void => {
    setLabel("");
    setPassphrase("");
    setMnemonic("");
    setMnemonicJSON({ id: "", seed: Array(12).fill(""), phrase: "" });
  }, []);

  const handleSeedKeyChange = (input: MnemonicJSON): void => {
    if (!input) return;
    setMnemonicJSON(input);
    setMnemonic(jsonToSeed(input));
  };

  const handleUpdatePassphrase = (value: string): void => {
    setPassphrase(value?.trim() ? value : "");
  };

  const setInvoiceMetaField = <K extends keyof MajikInvoiceContactMeta>(
    key: K,
    value: MajikInvoiceContactMeta[K],
  ): void => {
    setInvoiceMeta((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Account: Create ───────────────────────────────────────────────────────

  const handleCreateAccount = async (): Promise<void> => {
    if (!mnemonic?.trim() || !passphrase?.trim() || !label?.trim()) return;

    const download = prepareDownloadAnchor("json", `${label} | SEED KEY`);

    const created = await majik.createAccount(
      mnemonic.trim(),
      passphrase,
      label,
      invoiceMeta,
    );

    const jsonData: MnemonicJSON = {
      id: created.backup,
      seed: seedStringToArray(mnemonic.trim()),
      phrase: passphrase?.trim() ? passphrase.trim() : undefined,
    };

    const base64String = btoa(JSON.stringify(jsonData));

    const seedJSONBlob = new Blob([JSON.stringify(jsonData)], {
      type: "application/json;charset=utf-8",
    });

    setMnemonicJSON(jsonData);

    const majikByte = await MajikBytes.create(base64String);

    const mbyteFile = await majikByte.toPNG();

    const pngBuffer = await mbyteFile.arrayBuffer();

    const readmeContent = `
Majik Key Backup\n
IMPORTANT: Keep this file secure and private at all times. If lost or compromised, your account access may be permanently at risk.\n\n

Overview\n
This backup ZIP file contains your raw JSON data and a Backup PNG. These files are essential for recovering your account.\n\n

Usage Instructions\n
• Storage: You may delete the JSON file and keep only the PNG file if preferred.\n
• Customization: You can rename the PNG file for added discretion.\n
• Recovery: This PNG allows you to securely re-import your account without exposing raw JSON data.\n\n

Critical Handling Requirements\n
To prevent data corruption and ensure the backup remains functional, please follow these rules:\n

• No Modifications: Do not edit, crop, or apply filters to the PNG image.\n
• No Processing: Avoid running the image through compression tools or "optimization" software.\n
• Storage Only: Store the image as is. Do not upload it to social media, messaging apps, or cloud platforms that automatically compress or manipulate images, as this will destroy the embedded data.\n\n

Backup created on: ${new Date().toLocaleString()}\n
IMPORTANT: Keep this file secure and private at all times. If lost or compromised, your account access may be permanently at risk.\n\n
    `;

    // 2. Initialize JSZip and add all 3 items
    const zip = new JSZip();

    const defaultFileName = `${label} - ${created.id} - SEED KEY`;

    // Item 1: The JSON (from a string)
    zip.file("backup.json", seedJSONBlob);

    // Item 2: The second Blob
    // JSZip handles Blobs directly
    zip.file("backup.png", pngBuffer, { binary: true });

    // Item 3: The README (from a string)
    zip.file("IMPORTANT README.txt", readmeContent);

    // 3. Generate the final ZIP blob
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    // Open the native save dialog
    const filePath = await save({
      defaultPath: defaultFileName,
      filters: [
        {
          name: "Backup ZIP",
          extensions: ["zip"],
        },
      ],
    });

    // User cancelled the dialog
    if (!filePath) {
      downloadBlob(zipBlob, "zip", defaultFileName);
    } else {
      // Convert blob → Uint8Array and write to the chosen path
      const arrayBuffer = await zipBlob.arrayBuffer();
      await writeFile(filePath, new Uint8Array(arrayBuffer));
    }

    const blob = new Blob([JSON.stringify(jsonData)], {
      type: "application/json;charset=utf-8",
    });
    download.trigger(blob);
  };

  // ─── Account: Import ───────────────────────────────────────────────────────

  const handleImportAccount = async (): Promise<void> => {
    if (!mnemonicJSON?.id?.trim() || !passphrase?.trim()) return;

    await majik.importAccountFromMnemonicBackup(
      mnemonicJSON.id,
      mnemonic.trim(),
      passphrase.trim(),
      label,
      invoiceMeta,
    );
  };

  // ─── Invoice: Save ─────────────────────────────────────────────────────────

  const handleSaveInvoiceMeta = async (): Promise<void> => {
    setIsSavingInvoice(true);

    const run = async (): Promise<string> => {
      const successMessage =
        accountMode === "create"
          ? `Account "${label}" created.`
          : `Account "${label}" imported.`;

      accountMode === "create"
        ? await handleCreateAccount()
        : await handleImportAccount();

      // Bind to the active account if available
      const activeAccount = majik.getActiveAccount();
      if (activeAccount && invoiceMeta) {
        await majik.updateContactMeta(activeAccount.id, invoiceMeta);
      }

      // Persist as invoice defaults — always called so everything is bound
      const existingDefaults = await majik.getInvoiceDefaults();
      const updatedDefaults: InvoiceDefaults = {
        ...(existingDefaults ?? {}),
        currency: existingDefaults?.currency ?? "PHP",
        issuer: {
          ...existingDefaults?.issuer,
          legalName: invoiceMeta.legalName,
          tradeName: invoiceMeta.tradeName,
          tin: invoiceMeta.tin,
          email: invoiceMeta.email,
          phone: invoiceMeta.phone,
          website: invoiceMeta.website,
          address: invoiceMeta.address,
          taxIdType: invoiceMeta.taxIdType,
          taxExempt: invoiceMeta.taxExempt,
          taxExemptRef: invoiceMeta.taxExemptRef,
          natureOfBusiness: invoiceMeta.natureOfBusiness,
        },
        notes: invoiceMeta.notes,
      };

      await majik.setInvoiceDefaults(updatedDefaults);
      addPreference("majik_invoice_meta_complete");

      return successMessage;
    };

    toast.promise(run(), {
      loading:
        accountMode === "create" ? `Creating account….` : `Importing account…`,
      success: (m) => {
        resetAccountForm();
        onUpdate?.(majik);
        refresh();
        if (bypass.includes("online")) {
          setPhase("tour");
        } else {
          setPhase("online");
        }
        return m;
      },
      error: (e) => e?.message || "Failed to process account.",
      finally: () => setIsSavingInvoice(false),
    });
  };

  // ─── Online: Stay offline ──────────────────────────────────────────────────

  const handleStayOffline = (): void => {
    const accounts = majik.listOwnAccounts();
    accounts
      .filter((a) => !a.isMajikahRegistered())
      .forEach((a) => addPreference(`majik_skip_register_${a.id}`));

    toast.info("Staying offline", {
      description:
        "You can register and create your Universal ID anytime from the Identity panel.",
    });
    setPhase("tour");
  };

  // ─── Online: Proceed to MUID ───────────────────────────────────────────────

  const handleGoOnline = (): void => {
    setOnlineChoice("online");
    setOnlineStep(majikah?.isAuthenticated ? "key" : "auth");
    setPhase("muid");
  };

  // ─── MUID: Key file parsing ────────────────────────────────────────────────

  const parseMuidKeyFile = useCallback(async (file: File): Promise<void> => {
    const isJSON =
      file.type === "application/json" || file.name.endsWith(".json");
    const isPNG = file.type === "image/png" || file.name.endsWith(".png");

    if (!isJSON && !isPNG) {
      toast.error("Invalid file — expected .json or .png backup");
      return;
    }

    try {
      let parsedJSON: MnemonicJSON;

      if (isPNG) {
        // Lazy import to avoid hard dep if not needed
        const { MajikBytes } = await import("@majikah/majik-bytes");
        const loaded = await MajikBytes.fromPNG(file);
        const decoded = atob(loaded.toStringValue());
        parsedJSON = JSON.parse(decoded) as MnemonicJSON;
      } else {
        parsedJSON = JSON.parse(await file.text()) as MnemonicJSON;
      }

      const key = await MajikKey.fromMnemonicJSON(
        parsedJSON,
        "majikah-imported-account",
      );
      setLoadedKey(key);
      setMuidKeyError(null);
      toast.success("Key loaded", {});
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not parse key file.";
      setMuidKeyError(msg);
      toast.error("Failed to load key", { description: msg });
    }
  }, []);

  const handleMuidDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseMuidKeyFile(file);
    },
    [parseMuidKeyFile],
  );

  const handleMuidFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseMuidKeyFile(file);
      if (muidFileRef.current) muidFileRef.current.value = "";
    },
    [parseMuidKeyFile],
  );

  // ─── MUID: Create ──────────────────────────────────────────────────────────

  const handleCreateMUID = useCallback(async (): Promise<void> => {
    if (!loadedKey || !majikah?.user) return;

    setIsCreatingMUID(true);
    setMuidKeyError(null);

    try {
      const muidJSON: MajikUniversalIDJSON = await majik.createMUID(loadedKey);
      const uid = await MajikUniversalID.fromJSON(muidJSON);
      setCreatedMUID(uid);
      setOnlineStep("success");

      // Mark account as registered
      const activeAccount = majik.getActiveAccount();
      if (activeAccount) {
        addPreference(`majik_registered_${activeAccount.id}`);
      }

      onUpdate?.(majik);
      toast.success("Universal ID created successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMuidKeyError(msg);
      console.error("[MajikBuwizOnboardingGate] Failed to create MUID:", err);
      if ((err as any)?.code === "ALREADY_EXISTS") {
        setOnlineStep("success");
        const activeAccount = majik.getActiveAccount();
        if (activeAccount) {
          addPreference(`majik_registered_${activeAccount.id}`);
        }

        toast.info("MUID already created", { description: msg });
      } else {
        toast.error("MUID creation failed", { description: msg });
      }
    } finally {
      setIsCreatingMUID(false);
    }
  }, [loadedKey, majikah, majik, onUpdate, addPreference]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const localAccounts = useMemo(
    () => majik.listOwnAccounts(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik, refreshKey],
  );

  const unregisteredAccounts = useMemo(
    () => localAccounts.filter((a) => !a.isMajikahRegistered()),
    [localAccounts],
  );

  // ── Progress helpers ───────────────────────────────────────────────────────

  const gateStepIndex = GATE_STEPS.findIndex((s) =>
    phase === "muid" ? s.id === "online" : s.id === phase,
  );

  const renderProgress = () => (
    <>
      <ProgressRow>
        {GATE_STEPS.map((s, i) => (
          <ProgressStep
            key={s.id}
            $state={
              i < gateStepIndex
                ? "done"
                : i === gateStepIndex
                  ? "active"
                  : "pending"
            }
          />
        ))}
      </ProgressRow>
      <StepLabelRow>
        {GATE_STEPS.map((s, i) => (
          <StepLabelItem key={s.id} $active={i === gateStepIndex}>
            {s.label}
          </StepLabelItem>
        ))}
      </StepLabelRow>
    </>
  );

  // ─── Render guard ──────────────────────────────────────────────────────────

  if (phase === null || phase === "tour" || phase === "done") {
    return <>{children}</>;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: account
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === "account") {
    const canProceed =
      accountMode === "create"
        ? !!label?.trim() && !!mnemonicJSON && !!passphrase?.trim()
        : accountMode === "import"
          ? !!mnemonicJSON?.id?.trim() &&
            mnemonicJSON.seed.length > 0 &&
            !!passphrase?.trim()
          : false;

    return (
      <>
        {children}
        <AlertDialog.Root open>
          <AlertDialog.Portal>
            <DialogOverlay />
            <GateContent>
              <DialogHeader>
                <DialogTitle>Welcome to Majik Buwiz</DialogTitle>
                <DialogDescription>
                  Set up your signing key to get started.
                </DialogDescription>
              </DialogHeader>

              <ScrollContainer>
                <StepWrapper>
                  {renderProgress()}

                  {/* ── Choose mode ── */}
                  {!accountMode && (
                    <>
                      <StepHeader>
                        <IconBadge>
                          <ShieldCheckIcon size={22} />
                        </IconBadge>
                        <StepTitle>Create or Import a Key Account</StepTitle>
                        <StepHint>
                          Your account is stored locally and protected by a seed
                          phrase. No server ever sees your keys.
                        </StepHint>
                      </StepHeader>

                      <ChoiceGrid>
                        <ChoiceCard
                          $selected={false}
                          onClick={() => setAccountMode("create")}
                          type="button"
                        >
                          <ChoiceIcon $selected={false}>
                            <MagicWandIcon size={20} />
                          </ChoiceIcon>
                          <ChoiceLabel>Create New</ChoiceLabel>
                          <ChoiceDesc>
                            Generate a fresh seed phrase and set a password.
                          </ChoiceDesc>
                        </ChoiceCard>
                        <ChoiceCard
                          $selected={false}
                          onClick={() => setAccountMode("import")}
                          type="button"
                        >
                          <ChoiceIcon $selected={false}>
                            <DownloadSimpleIcon size={20} />
                          </ChoiceIcon>
                          <ChoiceLabel>Import Existing</ChoiceLabel>
                          <ChoiceDesc>
                            Restore from a backup JSON file or seed phrase.
                          </ChoiceDesc>
                        </ChoiceCard>
                      </ChoiceGrid>
                    </>
                  )}

                  {/* ── Create form ── */}
                  {accountMode === "create" && (
                    <>
                      <StepHeader>
                        <IconBadge>
                          <MagicWandIcon size={22} />
                        </IconBadge>
                        <StepTitle>Create a New Key Account</StepTitle>
                        <StepHint>
                          A seed key backup file will be downloaded
                          automatically. Keep it safe — it's the only way to
                          recover your account.
                        </StepHint>
                      </StepHeader>

                      <DynamicAlertBanner
                        title="Keep this private"
                        description="Never share your seed phrase or backup JSON with anyone. Store your backup in a safe, offline location."
                        level="danger"
                      />
                      <CustomInputField
                        onChange={setLabel}
                        maxChar={100}
                        regex="letters"
                        label="Display Name"
                        currentValue={label}
                        required
                        sensitive
                      />
                      <SeedKeyInput
                        allowGenerate
                        importProp={{ type: "json" }}
                        onUpdatePassphrase={handleUpdatePassphrase}
                        onChange={handleSeedKeyChange}
                        readonly
                        currentValue={{ ...mnemonicJSON, phrase: passphrase }}
                      />
                    </>
                  )}

                  {/* ── Import form ── */}
                  {accountMode === "import" && (
                    <>
                      <StepHeader>
                        <IconBadge>
                          <DownloadSimpleIcon size={22} />
                        </IconBadge>
                        <StepTitle>Import an Existing Account</StepTitle>
                        <StepHint>
                          Load your backup file and enter the password you used
                          when creating the account.
                        </StepHint>
                      </StepHeader>

                      <CustomInputField
                        onChange={setLabel}
                        maxChar={100}
                        regex="letters"
                        label="Display Name (optional)"
                        currentValue={label}
                        sensitive
                      />

                      <ImportModeToggle>
                        <ModeToggleButton
                          $active={importMode === "drop"}
                          onClick={() => {
                            setImportMode("drop");
                          }}
                          type="button"
                        >
                          <UploadSimpleIcon size={12} /> Backup file
                        </ModeToggleButton>
                        <ModeToggleButton
                          $active={importMode === "manual"}
                          onClick={() => {
                            setImportMode("manual");
                          }}
                          type="button"
                        >
                          <KeyboardIcon size={12} /> Enter manually
                        </ModeToggleButton>
                      </ImportModeToggle>

                      {importMode === "drop" ? (
                        <DropImportAccount
                          passphrase={passphrase}
                          onPassphraseChange={handleUpdatePassphrase}
                          mnemonicJSON={mnemonicJSON}
                          onFileLoaded={(json) => {
                            setMnemonicJSON(json);
                            setMnemonic(jsonToSeed(json));
                          }}
                          onClear={() => {
                            setMnemonicJSON({
                              id: "",
                              seed: Array(12).fill(""),
                              phrase: "",
                            });
                            setMnemonic("");
                            setPassphrase("");
                          }}
                        />
                      ) : (
                        <SeedKeyInput
                          requireBackupKey
                          importProp={{ type: "json" }}
                          onUpdatePassphrase={handleUpdatePassphrase}
                          onChange={handleSeedKeyChange}
                          readonly={false}
                          currentValue={{ ...mnemonicJSON, phrase: passphrase }}
                        />
                      )}
                    </>
                  )}
                </StepWrapper>
              </ScrollContainer>

              <Footer>
                <div>
                  {accountMode && (
                    <NavButton
                      type="button"
                      onClick={() => {
                        setAccountMode(null);
                        resetAccountForm();
                      }}
                    >
                      <ArrowLeftIcon size={13} /> Back
                    </NavButton>
                  )}
                </div>
                <NavButtons>
                  {accountMode && (
                    <NavButton
                      $primary
                      type="button"
                      disabled={!canProceed}
                      onClick={() => {
                        if (bypass.includes("invoice")) {
                          setPhase(
                            bypass.includes("online") ? "tour" : "online",
                          );
                        } else {
                          setPhase("invoice");
                        }
                      }}
                    >
                      Proceed
                      <ArrowRightIcon size={13} />
                    </NavButton>
                  )}
                </NavButtons>
              </Footer>
            </GateContent>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: invoice
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === "invoice") {
    const canSave = !!(
      invoiceMeta?.legalName?.trim() &&
      invoiceMeta?.tradeName?.trim() &&
      invoiceMeta?.tin?.trim() &&
      invoiceMeta?.natureOfBusiness
    );

    return (
      <>
        {children}
        <AlertDialog.Root open>
          <AlertDialog.Portal>
            <DialogOverlay />
            <GateContent>
              <DialogHeader>
                <DialogTitle>Business Information</DialogTitle>
                <DialogDescription>
                  This information is used on your invoices and documents. You
                  can update it anytime in Settings.
                </DialogDescription>
              </DialogHeader>

              <ScrollContainer>
                <StepWrapper>
                  {renderProgress()}

                  <StepHeader>
                    <IconBadge>
                      <IdentificationBadgeIcon size={22} />
                    </IconBadge>
                    <StepTitle>Set Up Your Business Profile</StepTitle>
                    <StepHint>
                      Fill in your business or personal details. These are
                      stored locally and used to pre-fill invoices.
                    </StepHint>
                  </StepHeader>

                  <FormGrid>
                    <SectionSubhead>Identity</SectionSubhead>

                    <CustomInputField
                      label="Legal Name"
                      required
                      currentValue={invoiceMeta.legalName ?? ""}
                      onChange={(v) => setInvoiceMetaField("legalName", v)}
                      placeholder="Full legal name or business name"
                      maxChar={200}
                      sensitive
                    />

                    <CustomInputField
                      label="Trade / Brand Name"
                      currentValue={invoiceMeta.tradeName ?? ""}
                      onChange={(v) => setInvoiceMetaField("tradeName", v)}
                      placeholder="How your business is known publicly"
                      maxChar={200}
                      sensitive
                    />

                    <FormRow>
                      <FormGroup>
                        <FormLabel>Tax ID (TIN)</FormLabel>
                        <FormInput
                          value={invoiceMeta.tin ?? ""}
                          onChange={(e) =>
                            setInvoiceMetaField("tin", e.target.value)
                          }
                          placeholder="000-000-000-000"
                        />
                      </FormGroup>
                      <FormGroup>
                        <FormLabel>Nature of Business</FormLabel>
                        <FormInput
                          value={invoiceMeta.natureOfBusiness ?? ""}
                          onChange={(e) =>
                            setInvoiceMetaField(
                              "natureOfBusiness",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. Freelance Services"
                        />
                      </FormGroup>
                    </FormRow>

                    <FormDivider />
                    <SectionSubhead>Contact</SectionSubhead>

                    <FormRow>
                      <FormGroup>
                        <FormLabel>Email</FormLabel>
                        <FormInput
                          type="email"
                          value={invoiceMeta.email ?? ""}
                          onChange={(e) =>
                            setInvoiceMetaField("email", e.target.value)
                          }
                          placeholder="billing@example.com"
                        />
                      </FormGroup>
                      <FormGroup>
                        <FormLabel>Phone</FormLabel>
                        <FormInput
                          type="tel"
                          value={invoiceMeta.phone ?? ""}
                          onChange={(e) =>
                            setInvoiceMetaField("phone", e.target.value)
                          }
                          placeholder="+63 9XX XXX XXXX"
                        />
                      </FormGroup>
                    </FormRow>

                    <FormGroup>
                      <FormLabel>Website (optional)</FormLabel>
                      <FormInput
                        type="url"
                        value={invoiceMeta.website ?? ""}
                        onChange={(e) =>
                          setInvoiceMetaField("website", e.target.value)
                        }
                        placeholder="https://yoursite.com"
                      />
                    </FormGroup>

                    <FormDivider />
                    <SectionSubhead>Invoice Notes (optional)</SectionSubhead>

                    <FormGroup>
                      <FormLabel>Default Notes</FormLabel>
                      <FormTextarea
                        value={invoiceMeta.notes ?? ""}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setInvoiceMetaField("notes", e.target.value)
                        }
                        placeholder="Payment terms, bank details, thank-you note…"
                        style={{ resize: "vertical", minHeight: 60 }}
                      />
                    </FormGroup>
                  </FormGrid>
                </StepWrapper>
              </ScrollContainer>

              <Footer>
                {/* <SkipLink
                  type="button"
                  onClick={() => {
                    addPreference("majik_invoice_meta_complete");
                    setPhase(bypass.includes("online") ? "tour" : "online");
                  }}
                >
                  Skip for now
                </SkipLink> */}
                <NavButton
                  type="button"
                  onClick={() => {
                    setPhase("account");
                    // setAccountMode(null);
                    // resetAccountForm();
                  }}
                >
                  <ArrowLeftIcon size={13} /> Back
                </NavButton>
                <NavButtons>
                  <NavButton
                    $primary
                    type="button"
                    disabled={!canSave || isSavingInvoice}
                    onClick={handleSaveInvoiceMeta}
                  >
                    {isSavingInvoice ? (
                      <ShimmerText>Saving…</ShimmerText>
                    ) : accountMode === "create" ? (
                      "Create Account"
                    ) : (
                      "Import Account"
                    )}
                  </NavButton>
                </NavButtons>
              </Footer>
            </GateContent>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: online  (choose: go online or stay offline)
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === "online") {
    return (
      <>
        {children}
        <AlertDialog.Root open>
          <AlertDialog.Portal>
            <DialogOverlay />
            <GateContent>
              <DialogHeader>
                <DialogTitle>Join the Majikah Network</DialogTitle>
                <DialogDescription>
                  Register online to send messages, create a Universal ID, and
                  be discoverable on the network.
                </DialogDescription>
              </DialogHeader>

              <ScrollContainer>
                <StepWrapper>
                  {renderProgress()}

                  <StepHeader>
                    <IconBadge>
                      <CloudArrowUpIcon size={22} />
                    </IconBadge>
                    <StepTitle>How would you like to proceed?</StepTitle>
                    <StepHint>
                      Going online creates a verified Universal ID linked to
                      your local key. You can always do this later from the
                      Identity panel.
                    </StepHint>
                  </StepHeader>

                  <OnlineChoiceWrap>
                    <OnlineOptionCard
                      $selected={onlineChoice === "online"}
                      onClick={() => setOnlineChoice("online")}
                      type="button"
                    >
                      <OnlineOptionIcon>
                        <WifiHighIcon size={20} />
                      </OnlineOptionIcon>
                      <OnlineOptionMeta>
                        <OnlineOptionTitle>Go Online</OnlineOptionTitle>
                        <OnlineOptionDesc>
                          Sign in or create a Majikah account, then link your
                          key to a Universal ID. Unlocks messaging, exchange,
                          and verification features.
                        </OnlineOptionDesc>
                      </OnlineOptionMeta>
                    </OnlineOptionCard>

                    <OnlineOptionCard
                      $selected={onlineChoice === "offline"}
                      $offline
                      onClick={() => setOnlineChoice("offline")}
                      type="button"
                    >
                      <OnlineOptionIcon $offline>
                        <WifiSlashIcon size={20} />
                      </OnlineOptionIcon>
                      <OnlineOptionMeta>
                        <OnlineOptionTitle>Stay Offline</OnlineOptionTitle>
                        <OnlineOptionDesc>
                          Use Majik Buwiz offline — sign documents and manage
                          invoices locally. You can register online anytime.
                        </OnlineOptionDesc>
                      </OnlineOptionMeta>
                    </OnlineOptionCard>
                  </OnlineChoiceWrap>

                  {unregisteredAccounts.length > 0 && (
                    <>
                      <SectionSubhead>Your local accounts</SectionSubhead>
                      <AccountList>
                        {unregisteredAccounts.map((account) => (
                          <AccountRow
                            key={account.id}
                            $selected={false}
                            type="button"
                            disabled
                          >
                            <IdentificationBadgeIcon
                              size={16}
                              style={{ flexShrink: 0 }}
                            />
                            <AccountMeta>
                              <AccountName>
                                {account.meta?.label || "Unnamed Account"}
                              </AccountName>
                              <AccountID>{account.id}</AccountID>
                            </AccountMeta>
                          </AccountRow>
                        ))}
                      </AccountList>
                    </>
                  )}
                </StepWrapper>
              </ScrollContainer>

              <Footer>
                <SkipLink type="button" onClick={handleStayOffline}>
                  <WifiSlashIcon
                    size={11}
                    style={{ marginRight: 4, verticalAlign: "middle" }}
                  />
                  Stay offline for now
                </SkipLink>
                <NavButtons>
                  <NavButton
                    $primary
                    type="button"
                    disabled={!onlineChoice}
                    onClick={() => {
                      if (onlineChoice === "offline") {
                        handleStayOffline();
                      } else {
                        handleGoOnline();
                      }
                    }}
                  >
                    Continue <ArrowRightIcon size={13} />
                  </NavButton>
                </NavButtons>
              </Footer>
            </GateContent>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: muid  (auth → key load → create MUID)
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === "muid") {
    const MUID_STEPS: { id: OnlineStep; label: string }[] = [
      { id: "auth", label: "Account" },
      { id: "key", label: "Key" },
      { id: "success", label: "Done" },
    ];
    const muidStepIndex = MUID_STEPS.findIndex((s) => s.id === onlineStep);

    const renderMUIDProgress = () => (
      <>
        <ProgressRow>
          {MUID_STEPS.map((s, i) => (
            <ProgressStep
              key={s.id}
              $state={
                i < muidStepIndex
                  ? "done"
                  : i === muidStepIndex
                    ? "active"
                    : "pending"
              }
            />
          ))}
        </ProgressRow>
        <StepLabelRow>
          {MUID_STEPS.map((s, i) => (
            <StepLabelItem key={s.id} $active={i === muidStepIndex}>
              {s.label}
            </StepLabelItem>
          ))}
        </StepLabelRow>
      </>
    );

    // ── Sub-step: auth ──────────────────────────────────────────────────────
    if (onlineStep === "auth") {
      return (
        <>
          {children}
          <AlertDialog.Root open>
            <AlertDialog.Portal>
              <DialogOverlay />
              <GateContent>
                <DialogHeader>
                  <DialogTitle>Sign in to Majikah</DialogTitle>
                  <DialogDescription>
                    A Majikah account is required to create your Universal ID.
                  </DialogDescription>
                </DialogHeader>

                <ScrollContainer>
                  <StepWrapper>
                    {renderMUIDProgress()}

                    <StepHeader>
                      <IconBadge>
                        <UserCircleIcon size={22} />
                      </IconBadge>
                      <StepTitle>Majikah Account</StepTitle>
                      <StepHint>
                        Sign in or create a free Majikah account. Your
                        cryptographic key stays local — only your public key and
                        profile are shared.
                      </StepHint>
                    </StepHeader>

                    {/* Inline auth — no extra dialog */}
                    <UserAuth
                      showLogo={false}
                      expand
                      onSignIn={() => {
                        // Give session a tick to propagate then advance
                        setTimeout(() => setOnlineStep("key"), 400);
                      }}
                      onSignUp={() => {
                        setTimeout(() => setOnlineStep("key"), 400);
                      }}
                    />
                  </StepWrapper>
                </ScrollContainer>

                <Footer>
                  <NavButton
                    type="button"
                    onClick={() => {
                      setPhase("online");
                      setOnlineChoice(null);
                    }}
                  >
                    <ArrowLeftIcon size={13} /> Back
                  </NavButton>
                  <SkipLink type="button" onClick={handleStayOffline}>
                    Skip — stay offline
                  </SkipLink>
                </Footer>
              </GateContent>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </>
      );
    }

    // ── Sub-step: key ───────────────────────────────────────────────────────
    if (onlineStep === "key") {
      return (
        <>
          {children}
          <AlertDialog.Root open>
            <AlertDialog.Portal>
              <DialogOverlay />
              <GateContent>
                <DialogHeader>
                  <DialogTitle>Bind Your Signing Key</DialogTitle>
                  <DialogDescription>
                    Load your seed key backup to link it to your Universal ID.
                  </DialogDescription>
                </DialogHeader>

                <ScrollContainer>
                  <StepWrapper>
                    {renderMUIDProgress()}

                    <StepHeader>
                      <IconBadge>
                        <ShieldPlusIcon size={22} />
                      </IconBadge>
                      <StepTitle>Load Your Majik Key</StepTitle>
                      <StepHint>
                        Drop your .json or .png seed key backup file. It is
                        loaded into memory only and never re-uploaded.
                      </StepHint>
                    </StepHeader>

                    {/* Hidden native input */}
                    <input
                      ref={muidFileRef}
                      type="file"
                      accept=".json,application/json,.png,image/png"
                      style={{ display: "none" }}
                      onChange={handleMuidFileInput}
                    />

                    {!loadedKey ? (
                      <DropZone
                        $dragging={isDragging}
                        $hasFile={false}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleMuidDrop}
                        onClick={() => muidFileRef.current?.click()}
                      >
                        <DropZoneIcon $hasFile={false}>
                          <UploadSimpleIcon size={22} />
                        </DropZoneIcon>
                        <DropZoneTitle>
                          {isDragging
                            ? "Release to load"
                            : "Drop your seed key backup here"}
                        </DropZoneTitle>
                        <DropZoneHint>
                          Accepts .json or .png backup files.
                          <br />
                          Loaded into memory only — never re-uploaded.
                        </DropZoneHint>
                        <BrowseBtn>
                          <FilePlusIcon size={12} /> Browse files
                        </BrowseBtn>
                      </DropZone>
                    ) : (
                      <>
                        <LoadedKeyCard>
                          <LoadedKeyIcon>
                            <FilePlusIcon size={16} />
                          </LoadedKeyIcon>
                          <LoadedKeyMeta>
                            <LoadedKeyName>
                              {loadedKey.publicKeyBase64?.slice(0, 32)}…
                            </LoadedKeyName>
                            <LoadedKeySub>
                              {loadedKey.fingerprint?.slice(0, 24)}…
                            </LoadedKeySub>
                          </LoadedKeyMeta>
                          <ClearBtn
                            onClick={() => {
                              setLoadedKey(null);
                              setMuidKeyError(null);
                            }}
                            title="Remove key"
                          >
                            <XCircleIcon size={15} />
                          </ClearBtn>
                        </LoadedKeyCard>

                        <KeyUnlockedBox>
                          <KeyUnlockedRow>
                            <CheckCircleIcon
                              size={15}
                              color="#22c55e"
                              weight="fill"
                            />
                            <span
                              style={{
                                fontSize: 12,
                                color: "#22c55e",
                                fontWeight: 600,
                              }}
                            >
                              Key unlocked — ready to bind
                            </span>
                          </KeyUnlockedRow>
                          <KeyFingerprintText>
                            {loadedKey.fingerprint}
                          </KeyFingerprintText>
                        </KeyUnlockedBox>
                      </>
                    )}

                    {muidKeyError && (
                      <ErrorBanner>
                        <WarningCircleIcon
                          size={14}
                          weight="fill"
                          style={{ flexShrink: 0, marginTop: 1 }}
                        />
                        <span>{muidKeyError}</span>
                      </ErrorBanner>
                    )}

                    {/* Summary of what will be created */}
                    {loadedKey && majikah?.user && (
                      <MUIDCreationWrap>
                        <SectionSubhead>
                          Will create Universal ID for
                        </SectionSubhead>
                        <MUIDInfoCard>
                          <MUIDInfoRow>
                            <MUIDInfoLabel>Account</MUIDInfoLabel>
                            <MUIDInfoValue>
                              {majikah.user.displayName}
                            </MUIDInfoValue>
                          </MUIDInfoRow>
                          <MUIDInfoRow>
                            <MUIDInfoLabel>Email</MUIDInfoLabel>
                            <MUIDInfoValue>{majikah.user.email}</MUIDInfoValue>
                          </MUIDInfoRow>
                          <MUIDInfoRow>
                            <MUIDInfoLabel>Key</MUIDInfoLabel>
                            <MUIDInfoValue>
                              {loadedKey.fingerprint.slice(0, 20)}…
                            </MUIDInfoValue>
                          </MUIDInfoRow>
                          <MUIDInfoRow>
                            <MUIDInfoLabel>Initial Tier</MUIDInfoLabel>
                            <MUIDTierBadge>Unverified</MUIDTierBadge>
                          </MUIDInfoRow>
                        </MUIDInfoCard>
                      </MUIDCreationWrap>
                    )}
                  </StepWrapper>
                </ScrollContainer>

                <Footer>
                  <NavButton
                    type="button"
                    onClick={() => {
                      // Go back to auth if not authenticated, otherwise online choice
                      if (!majikah?.isAuthenticated) {
                        setOnlineStep("auth");
                      } else {
                        setPhase("online");
                        setOnlineChoice(null);
                      }
                    }}
                  >
                    <ArrowLeftIcon size={13} /> Back
                  </NavButton>
                  <NavButtons>
                    <SkipLink type="button" onClick={handleStayOffline}>
                      Skip
                    </SkipLink>
                    <NavButton
                      $primary
                      type="button"
                      disabled={!loadedKey || isCreatingMUID}
                      onClick={handleCreateMUID}
                    >
                      {isCreatingMUID ? (
                        <ShimmerText>Creating…</ShimmerText>
                      ) : (
                        <>
                          <ShieldPlusIcon size={13} /> Create Universal ID
                        </>
                      )}
                    </NavButton>
                  </NavButtons>
                </Footer>
              </GateContent>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </>
      );
    }

    // ── Sub-step: success ───────────────────────────────────────────────────
    if (onlineStep === "success" && createdMUID) {
      return (
        <>
          {children}
          <AlertDialog.Root open>
            <AlertDialog.Portal>
              <DialogOverlay />
              <GateContent>
                <DialogHeader>
                  <DialogTitle>You're all set!</DialogTitle>
                  <DialogDescription>
                    Your Universal ID has been created and linked to your key.
                  </DialogDescription>
                </DialogHeader>

                <ScrollContainer>
                  <StepWrapper>
                    {renderMUIDProgress()}

                    <SuccessWrap>
                      <SuccessIconWrap>
                        <ShieldCheckIcon
                          size={32}
                          color="#E05C1A"
                          weight="duotone"
                        />
                      </SuccessIconWrap>
                      <SuccessTitle>Universal ID Created</SuccessTitle>
                      <SuccessDesc>
                        Your identity is anchored to your Majik Key. You can
                        start the verification process anytime from the Identity
                        panel.
                      </SuccessDesc>

                      <MUIDInfoCard style={{ width: "100%" }}>
                        <MUIDInfoRow>
                          <MUIDInfoLabel>ID</MUIDInfoLabel>
                          <MUIDInfoValue>
                            {createdMUID.id.slice(0, 20)}…
                          </MUIDInfoValue>
                        </MUIDInfoRow>
                        <MUIDInfoRow>
                          <MUIDInfoLabel>Owner</MUIDInfoLabel>
                          <MUIDInfoValue>
                            {createdMUID.toPublicView().display_name}
                          </MUIDInfoValue>
                        </MUIDInfoRow>
                        <MUIDInfoRow>
                          <MUIDInfoLabel>Tier</MUIDInfoLabel>
                          <MUIDTierBadge>{createdMUID.tier}</MUIDTierBadge>
                        </MUIDInfoRow>
                        <MUIDInfoRow>
                          <MUIDInfoLabel>Key</MUIDInfoLabel>
                          <MUIDInfoValue>
                            {createdMUID.signingKey.fingerprint.slice(0, 20)}…
                          </MUIDInfoValue>
                        </MUIDInfoRow>
                        <MUIDInfoRow>
                          <MUIDInfoLabel>Created</MUIDInfoLabel>
                          <MUIDInfoValue>
                            {new Date(
                              createdMUID.timestamp,
                            ).toLocaleDateString()}
                          </MUIDInfoValue>
                        </MUIDInfoRow>
                      </MUIDInfoCard>
                    </SuccessWrap>
                  </StepWrapper>
                </ScrollContainer>

                <Footer>
                  <div />
                  <NavButton
                    $primary
                    type="button"
                    onClick={() => setPhase("tour")}
                  >
                    Get Started <ArrowRightIcon size={13} />
                  </NavButton>
                </Footer>
              </GateContent>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </>
      );
    }
  }

  // Fallback — should not reach here
  return <>{children}</>;
};

export default MajikBuwizOnboardingGate;
