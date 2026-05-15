"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { toast } from "sonner";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  KeyIcon,
  PencilSimpleIcon,
  ShieldCheckIcon,
  ShieldPlusIcon,
  UserCircleIcon,
  WarningCircleIcon,
  UploadSimpleIcon,
  FilePlusIcon,
  XCircleIcon,
} from "@phosphor-icons/react";

import CustomInputField from "@/components/foundations/CustomInputField";

import {
  MajikUniversalID,
  type MajikUniversalIDJSON,
} from "@majikah/majik-universal-id";

import type { MajikahSession } from "@/components/majikah-session-wrapper/majikah-session";

import {
  UserGenderOptions,
  type MajikUser,
  type Address,
  type FullName,
} from "@thezelijah/majik-user";

import { MajikKey, MnemonicJSON } from "@majikah/majik-key";
import GuideHelper from "@/components/functional/GuideHelper";
import { useNavigate } from "react-router-dom";
import { parseDateFromISO } from "@/utils/utils";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import UserAuth from "@/components/foundations/UserAuth";
import DynamicPopUp from "@/components/functional/DynamicPopUp";
import { ChoiceButton } from "@/globals/buttons";

// ─── Animations ──────────────────────────────────────────────────────────────

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmerAnim = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

const checkPop = keyframes`
  0%   { transform: scale(0.4); opacity: 0; }
  70%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

const dropPulse = keyframes`
  0%, 100% { border-color: ${({ theme }) => theme?.colors?.primary || "#E05C1A"}; }
  50%       { border-color: transparent; }
`;

// ─── Layout ───────────────────────────────────────────────────────────────────

const Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.primaryBackground};
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 24px;
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

const Header = styled.div`
  padding: 20px 24px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
`;

const HeaderTitle = styled.h2`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  letter-spacing: -0.02em;
`;

const HeaderSub = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.65;
  line-height: 1.5;
`;

// ─── Progress ─────────────────────────────────────────────────────────────────

const ProgressBar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 16px 24px 0;
  flex-shrink: 0;
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

const StepLabel = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 6px 24px 0;
`;

const StepLabelItem = styled.span<{ $active: boolean }>`
  font-size: 10px;
  font-weight: ${({ $active }) => ($active ? "700" : "400")};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.textPrimary : theme.colors.textSecondary};
  opacity: ${({ $active }) => ($active ? 1 : 0.45)};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: all 0.2s;
`;

// ─── Step Content ─────────────────────────────────────────────────────────────

const StepContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 20px;
  animation: ${slideUp} 0.25s ease both;
  align-items: center;
`;

const IconRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StepIconBadge = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  flex-shrink: 0;
`;

const StepMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StepTitle = styled.h3`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  letter-spacing: -0.015em;
`;

const StepHint = styled.p`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: 1.55;
  opacity: 0.6;
`;

// ─── Profile edit form ────────────────────────────────────────────────────────

const ProfileModeToggle = styled.div`
  display: flex;
  gap: 6px;
`;

const ModeBtn = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid
    ${({ $active, theme }) =>
      $active
        ? `${theme.colors.primary || "#E05C1A"}50`
        : theme.colors.secondaryBackground};
  background: ${({ $active, theme }) =>
    $active ? `${theme.colors.primary || "#E05C1A"}12` : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary || "#E05C1A" : theme.colors.textSecondary};
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  padding: 14px;
`;

const InfoLabel = styled.span`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  padding-top: 1px;
  white-space: nowrap;
`;

const InfoValue = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  word-break: break-word;
  line-height: 1.45;
`;

const Divider = styled.div`
  grid-column: 1 / -1;
  height: 1px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  opacity: 0.6;
  margin: 2px 0;
`;

const FormDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  margin: 4px 0;
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

const Required = styled.span`
  color: #ef4444;
  margin-left: 2px;
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

const FormSelect = styled.select`
  width: 100%;
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  background: ${({ theme }) => theme.colors.secondaryBackground};
  cursor: pointer;
  transition: all 0.15s;
  box-sizing: border-box;
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary || "#E05C1A"};
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

// ─── Drag-and-Drop Key Zone ───────────────────────────────────────────────────

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
  position: relative;
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

const DropZoneBrowseBtn = styled.span`
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
  transition: all 0.15s;
  &:hover {
    opacity: 0.8;
  }
`;

const LoadedFileCard = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const LoadedFileIcon = styled.div`
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

const LoadedFileMeta = styled.div`
  flex: 1;
  min-width: 0;
`;

const LoadedFileName = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LoadedFileSub = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const ClearFileBtn = styled.button`
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

const UnlockBox = styled.div`
  margin-top: 4px;
  padding: 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const UnlockHint = styled.p`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.65;
  line-height: 1.5;
`;

// ─── Success ──────────────────────────────────────────────────────────────────

const SuccessWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 0 8px;
  animation: ${slideUp} 0.3s ease both;
`;

const SuccessIcon = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 20px;
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
  max-width: 300px;
`;

const IDSummaryCard = styled.div`
  width: 100%;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const IDSummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
`;

const IDSummaryLabel = styled.span`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  flex-shrink: 0;
`;

const IDSummaryValue = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: "Fira Mono", "JetBrains Mono", monospace;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const TierBadge = styled.span<{ $tier: string }>`
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: 20px;
  background: ${({ $tier }) =>
    $tier === "trusted"
      ? "rgba(34,197,94,0.12)"
      : $tier === "enhanced" || $tier === "verified"
        ? "rgba(59,130,246,0.12)"
        : $tier === "basic"
          ? "rgba(245,158,11,0.12)"
          : "rgba(156,163,175,0.12)"};
  color: ${({ $tier }) =>
    $tier === "trusted"
      ? "#22c55e"
      : $tier === "enhanced" || $tier === "verified"
        ? "#3b82f6"
        : $tier === "basic"
          ? "#f59e0b"
          : "#9ca3af"};
`;

// ─── Error Banner ─────────────────────────────────────────────────────────────

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

// ─── Footer ───────────────────────────────────────────────────────────────────

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  flex-shrink: 0;
  gap: 10px;
  padding-bottom: 5em;
`;

const FooterLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FooterRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Btn = styled.button<{ $primary?: boolean; $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 15px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
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
    opacity: 0.82;
  }
`;

const ShimmerBtn = styled.span`
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
  animation: ${shimmerAnim} 1.6s linear infinite;
`;

const EmptyNote = styled.div`
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  line-height: 1.6;
`;

// ─── Types ────────────────────────────────────────────────────────────────────

type SetupStep = "confirm" | "key" | "success";

interface MajikUniversalIDSetupProps {
  majikah: MajikahSession;
  majik: MajikBuwizDatabase;
  editUserUrl?: string;
  onComplete: (universalId: MajikUniversalID) => void;
}

const STEPS: { id: SetupStep; label: string }[] = [
  { id: "confirm", label: "Profile" },
  { id: "key", label: "Key" },
  { id: "success", label: "Done" },
];

const defaultAddress: Address = {
  country: "Philippines",
  city: "Manila",
  area: "Unset",
  street: "Unset",
  building: "Unset",
  zip: "0000",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const MajikUniversalIDSetup: React.FC<MajikUniversalIDSetupProps> = ({
  majikah,
  majik,
  onComplete,
}) => {
  const navigate = useNavigate();

  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);

  // ── Step navigation ────────────────────────────────────────────────────────
  const [step, setStep] = useState<SetupStep>("confirm");

  // ── Profile editing ────────────────────────────────────────────────────────
  const [profileMode, setProfileMode] = useState<"view" | "edit">("view");
  const [editedUser, setEditedUser] = useState<MajikUser | null>(
    majikah?.user || null,
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [, setProfileValid] = useState(false);

  // ── Key loading (drag & drop / browse) ────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [loadedKey, setLoadedKey] = useState<MajikKey | null>(null);

  const [importedKeyId, setImportedKeyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Create state ───────────────────────────────────────────────────────────
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdID, setCreatedID] = useState<MajikUniversalID | null>(null);

  // Sync editedUser when session user changes
  useEffect(() => {
    if (majikah?.user) {
      setEditedUser(majikah.user as unknown as MajikUser);
    }
  }, [majikah?.user]);

  // ── Profile handlers ───────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFieldChange = useCallback((field: string, value: any) => {
    if (!value) return;
    setEditedUser((prev) => {
      if (!prev) return prev;
      const updated = prev.clone();
      if (field === "displayName") {
        updated.displayName = value.trim() || prev.displayName;
      } else if (field === "firstName" || field === "lastName") {
        const name: FullName = {
          first_name: field === "firstName" ? value : prev.firstName,
          last_name: field === "lastName" ? value : prev.lastName,
        };
        updated.setName(name);
      } else if (field === "gender") {
        updated.setGender(value as UserGenderOptions);
      } else if (field === "birthdate") {
        updated.setBirthdate(value);
      } else if (field.startsWith("address.")) {
        const addressField = field.split(".")[1];
        const currentAddress = prev.metadata?.address || defaultAddress;
        updated.setAddress({ ...currentAddress, [addressField]: value });
      }
      const isValid = updated.validate?.()?.isValid ?? false;
      setProfileValid(isValid);
      return updated;
    });
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!editedUser || !majikah) return;
    setIsSavingProfile(true);
    try {
      const response = await majikah.updateUserProfile(editedUser.toJSON());
      if (response.success) {
        toast.success("Profile updated");
        setProfileMode("view");
      } else {
        toast.error("Failed to update profile", {
          description: response.message,
        });
      }
    } catch (err) {
      toast.error("Failed to save profile", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }, [editedUser, majikah]);

  // ── File loading helpers ───────────────────────────────────────────────────

  const parseKeyFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      toast.error("Invalid file type", {
        description: "Please select a .json seed key backup file.",
      });
      return;
    }
    try {
      const text = await file.text();
      const parsedJSON = JSON.parse(text) as MnemonicJSON;

      const importedKey = await MajikKey.fromMnemonicJSON(
        parsedJSON,
        "majikah-imported-account",
      );

      setImportedKeyId(importedKey.id);
      setLoadedKey(importedKey);

      setCreateError(null);

      toast.success("Key loaded & unlocked", {
        description: `Fingerprint: ${importedKey.fingerprint.slice(0, 18)}…`,
      });
    } catch {
      toast.error("Failed to read file", {
        description: "The file could not be parsed.",
      });
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseKeyFile(file);
    },
    [parseKeyFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseKeyFile(file);
      // Reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [parseKeyFile],
  );

  /**
   * Create the Universal ID using the imported (and unlocked) key.
   */
  const handleCreate = useCallback(async () => {
    if (!majikah?.user || !importedKeyId) return;

    const key = loadedKey;
    if (!key) {
      toast.error("Key not found — please re-load it");
      return;
    }
    if (!key.isUnlocked) {
      toast.error("Key is locked — please re-enter your passphrase");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const muidJSON: MajikUniversalIDJSON = await majik.createMUID(key);
      const uid = await MajikUniversalID.fromJSON(muidJSON);
      setCreatedID(uid);
      setStep("success");
      onComplete(uid);
      toast.success("Universal ID created successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setCreateError(msg);
      toast.error("Creation failed", { description: msg });
    } finally {
      setIsCreating(false);
    }
  }, [majik, importedKeyId, majikah, onComplete, loadedKey]);

  const user = majikah?.user;
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  // ── Step 1: Confirm / Edit Profile ────────────────────────────────────────

  const renderConfirmStep = () => {
    if (!user)
      return (
        <StepContent>
          <EmptyNote>Please log in to continue.</EmptyNote>
          <ChoiceButton
            $variant="primary"
            onClick={() => setIsSigningIn(true)}
            $maxWidth={300}
          >
            Sign In
          </ChoiceButton>
          <DynamicPopUp
            scrollable={true}
            modal={{
              title: "Sign In",
              description: "Log in to continue creating a Universal ID.",
            }}
            buttons={{
              cancel: { text: "Cancel" },
              confirm: {
                text: "Close",
                isDisabled: true,
                hide: true,
              },
            }}
            isOpen={isSigningIn}
            onOpenChange={setIsSigningIn}
          >
            <UserAuth showLogo={false} expand />
          </DynamicPopUp>
        </StepContent>
      );

    const source = editedUser || (user as unknown as MajikUser);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (source as any).metadata || (user as any).metadata;
    const name = meta?.name;
    const address = meta?.address;
    const rawBirthdate = meta?.birthdate;

    return (
      <StepContent>
        <IconRow>
          <StepIconBadge>
            <UserCircleIcon size={22} />
          </StepIconBadge>
          <StepMeta>
            <StepTitle>Your Profile</StepTitle>
            <StepHint>
              Review or update the information encrypted into your Universal ID.
            </StepHint>
          </StepMeta>
        </IconRow>

        {/* Mode toggle */}
        <ProfileModeToggle>
          <ModeBtn
            $active={profileMode === "view"}
            onClick={() => setProfileMode("view")}
          >
            View
          </ModeBtn>
          <ModeBtn
            $active={profileMode === "edit"}
            onClick={() => setProfileMode("edit")}
          >
            <PencilSimpleIcon size={11} /> Edit
          </ModeBtn>
        </ProfileModeToggle>

        {profileMode === "view" ? (
          /* ── Read-only view ── */
          <InfoGrid>
            <InfoLabel>Display</InfoLabel>
            <InfoValue>{user.displayName}</InfoValue>

            <Divider />

            <InfoLabel>Email</InfoLabel>
            <InfoValue>{user.email}</InfoValue>

            <InfoLabel>Account</InfoLabel>
            <InfoValue
              style={{
                fontFamily: "monospace",
                fontSize: "10px",
                opacity: 0.6,
              }}
            >
              {user.id?.slice(0, 20)}…
            </InfoValue>

            {name && (
              <>
                <Divider />
                <InfoLabel>Full Name</InfoLabel>
                <InfoValue>
                  {[name.first_name, name.middle_name, name.last_name]
                    .filter(Boolean)
                    .join(" ")}
                  {name.suffix ? `, ${name.suffix}` : ""}
                </InfoValue>
              </>
            )}

            {rawBirthdate && (
              <>
                <InfoLabel>Birthday</InfoLabel>
                <InfoValue>{parseDateFromISO(rawBirthdate, true)}</InfoValue>
              </>
            )}

            {meta?.gender && (
              <>
                <InfoLabel>Gender</InfoLabel>
                <InfoValue>{meta.gender}</InfoValue>
              </>
            )}

            {meta?.phone && (
              <>
                <InfoLabel>Phone</InfoLabel>
                <InfoValue>{meta.phone}</InfoValue>
              </>
            )}

            {address && (
              <>
                <Divider />
                <InfoLabel>Address</InfoLabel>
                <InfoValue>
                  {[
                    address.building,
                    address.street,
                    address.area,
                    address.city,
                    address.region,
                    address.zip,
                    address.country_code || address.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </InfoValue>
              </>
            )}
          </InfoGrid>
        ) : (
          /* ── Inline edit form ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FormGroup>
              <CustomInputField
                label="Display Name"
                required
                currentValue={source?.displayName || ""}
                onChange={(e) => handleFieldChange("displayName", e)}
                placeholder="Your display name"
                maxChar={100}
                regex="letters"
                sensitive
              />
            </FormGroup>

            <FormRow>
              <FormGroup>
                <CustomInputField
                  label="First Name"
                  required
                  currentValue={source?.firstName || ""}
                  onChange={(e) => handleFieldChange("firstName", e)}
                  placeholder="First name"
                  maxChar={100}
                  regex="letters"
                  sensitive
                />
              </FormGroup>
              <FormGroup>
                <CustomInputField
                  label="Last Name"
                  required
                  currentValue={source?.lastName || ""}
                  onChange={(e) => handleFieldChange("lastName", e)}
                  placeholder="Last name"
                  maxChar={150}
                  regex="letters"
                  sensitive
                />
              </FormGroup>
            </FormRow>

            <FormRow>
              <FormGroup>
                <FormLabel>
                  Gender<Required>*</Required>
                </FormLabel>
                <FormSelect
                  value={source?.gender || UserGenderOptions.OTHER}
                  onChange={(e) => handleFieldChange("gender", e.target.value)}
                >
                  {Object.values(UserGenderOptions).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </FormSelect>
              </FormGroup>
              <FormGroup>
                <FormLabel>
                  Date of Birth<Required>*</Required>
                </FormLabel>
                <FormInput
                  type="date"
                  value={meta?.birthdate || ""}
                  onChange={(e) =>
                    handleFieldChange("birthdate", new Date(e.target.value))
                  }
                  data-private
                />
              </FormGroup>
            </FormRow>

            <FormDivider />
            <SectionSubhead>Address</SectionSubhead>

            <FormGroup>
              <CustomInputField
                label="Country"
                required
                currentValue={address?.country || defaultAddress.country}
                onChange={(e) => handleFieldChange("address.country", e)}
                placeholder="Country"
                maxChar={100}
                regex="letters"
                sensitive
              />
            </FormGroup>

            <FormRow>
              <FormGroup>
                <CustomInputField
                  label="City"
                  required
                  currentValue={address?.city || defaultAddress.city}
                  onChange={(e) => handleFieldChange("address.city", e)}
                  placeholder="City"
                  maxChar={100}
                  regex="letters"
                  sensitive
                />
              </FormGroup>
              <FormGroup>
                <CustomInputField
                  label="Barangay"
                  currentValue={address?.area || defaultAddress.area}
                  onChange={(e) => handleFieldChange("address.area", e)}
                  placeholder="Barangay/Area"
                  maxChar={100}
                  sensitive
                />
              </FormGroup>
            </FormRow>

            <FormRow>
              <FormGroup>
                <CustomInputField
                  label="Street"
                  currentValue={address?.street || defaultAddress.street}
                  onChange={(e) => handleFieldChange("address.street", e)}
                  placeholder="Street"
                  maxChar={250}
                  sensitive
                />
              </FormGroup>
              <FormGroup>
                <CustomInputField
                  label="Building / Unit"
                  currentValue={address?.building || defaultAddress.building}
                  onChange={(e) => handleFieldChange("address.building", e)}
                  placeholder="Bldg. / house no."
                  maxChar={250}
                  sensitive
                />
              </FormGroup>
            </FormRow>

            <FormGroup>
              <CustomInputField
                label="Postal / ZIP Code"
                currentValue={address?.zip || defaultAddress.zip}
                onChange={(e) => handleFieldChange("address.zip", e)}
                placeholder="ZIP"
                maxChar={8}
                sensitive
                regex="numbers"
              />
            </FormGroup>

            {/* Inline save / cancel */}
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <Btn
                onClick={() => setProfileMode("view")}
                disabled={isSavingProfile}
              >
                Cancel
              </Btn>
              <Btn
                $primary
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ShimmerBtn>Saving…</ShimmerBtn>
                ) : (
                  "Save Profile"
                )}
              </Btn>
            </div>
          </div>
        )}
      </StepContent>
    );
  };

  // ── Step 2: Load Key (drag & drop) ────────────────────────────────────────

  const renderKeyStep = () => (
    <StepContent>
      <IconRow>
        <StepIconBadge>
          <KeyIcon size={22} />
        </StepIconBadge>
        <StepMeta>
          <StepTitle>Load Your Majik Key</StepTitle>
          <StepHint>
            Drop your seed key backup JSON file here. The key will be loaded
            temporarily for this session — it will not be saved to your
            accounts.
          </StepHint>
        </StepMeta>
      </IconRow>

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleFileInput}
      />

      {/* Drop zone — shown until a file is loaded */}
      {!loadedKey ? (
        <DropZone
          $dragging={isDragging}
          $hasFile={false}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <DropZoneIcon $hasFile={false}>
            <UploadSimpleIcon size={22} />
          </DropZoneIcon>
          <DropZoneTitle>
            {isDragging ? "Release to load" : "Drop your seed key file here"}
          </DropZoneTitle>
          <DropZoneHint>
            Accepts the .json backup file exported when you created your
            account.
            <br />
            Your key is loaded into memory only — never re-uploaded.
          </DropZoneHint>
          <DropZoneBrowseBtn>
            <FilePlusIcon size={12} /> Browse files
          </DropZoneBrowseBtn>
        </DropZone>
      ) : (
        /* File loaded — show card + passphrase entry */
        <>
          <LoadedFileCard>
            <LoadedFileIcon>
              <FilePlusIcon size={16} />
            </LoadedFileIcon>
            <LoadedFileMeta>
              <LoadedFileName>{loadedKey.publicKeyBase64}</LoadedFileName>
              {loadedKey.fingerprint ? (
                <LoadedFileSub>
                  {loadedKey.fingerprint.slice(0, 22)}…
                </LoadedFileSub>
              ) : (
                <LoadedFileSub>Enter passphrase to unlock</LoadedFileSub>
              )}
            </LoadedFileMeta>
            {!importedKeyId && (
              <ClearFileBtn
                onClick={() => {
                  setLoadedKey(null);
                  setImportedKeyId(null);
                  setCreateError(null);
                }}
                title="Remove file"
              >
                <XCircleIcon size={15} />
              </ClearFileBtn>
            )}
          </LoadedFileCard>

          <UnlockBox
            style={{
              background: "rgba(34,197,94,0.07)",
              border: "1px solid rgba(34,197,94,0.18)",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircleIcon size={16} color="#22c55e" weight="fill" />
              <UnlockHint style={{ color: "#22c55e", opacity: 1, margin: 0 }}>
                Key unlocked — ready to bind to your Universal ID.
              </UnlockHint>
            </div>
            {loadedKey.fingerprint && (
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  opacity: 0.55,
                }}
              >
                {loadedKey.fingerprint.slice(0, 32)}…
              </div>
            )}
          </UnlockBox>
        </>
      )}

      {/* API error display */}
      {createError && (
        <ErrorBanner>
          <WarningCircleIcon
            size={14}
            weight="fill"
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <span>{createError}</span>
        </ErrorBanner>
      )}
    </StepContent>
  );

  // ── Step 3: Success ───────────────────────────────────────────────────────

  const renderSuccessStep = () => {
    if (!createdID) return null;
    const pub = createdID.toPublicView();
    return (
      <SuccessWrap>
        <SuccessIcon>
          <ShieldCheckIcon size={32} color="#E05C1A" weight="duotone" />
        </SuccessIcon>
        <SuccessTitle>Universal ID Created</SuccessTitle>
        <SuccessDesc>
          Your identity has been anchored to your Majik Key and saved securely.
          You can now begin the verification process.
        </SuccessDesc>

        <IDSummaryCard>
          <IDSummaryRow>
            <IDSummaryLabel>ID</IDSummaryLabel>
            <IDSummaryValue>{createdID.id.slice(0, 18)}…</IDSummaryValue>
          </IDSummaryRow>
          <IDSummaryRow>
            <IDSummaryLabel>Owner</IDSummaryLabel>
            <IDSummaryValue>{pub.display_name}</IDSummaryValue>
          </IDSummaryRow>
          <IDSummaryRow>
            <IDSummaryLabel>Tier</IDSummaryLabel>
            <TierBadge $tier={createdID.tier}>{createdID.tier}</TierBadge>
          </IDSummaryRow>
          <IDSummaryRow>
            <IDSummaryLabel>Key</IDSummaryLabel>
            <IDSummaryValue>
              {createdID.signingKey.fingerprint.slice(0, 18)}…
            </IDSummaryValue>
          </IDSummaryRow>
          <IDSummaryRow>
            <IDSummaryLabel>Created</IDSummaryLabel>
            <IDSummaryValue>
              {new Date(createdID.timestamp).toLocaleDateString()}
            </IDSummaryValue>
          </IDSummaryRow>
        </IDSummaryCard>
      </SuccessWrap>
    );
  };

  // ── Footer ─────────────────────────────────────────────────────────────────

  const renderFooter = () => {
    if (step === "success") {
      return (
        <Footer>
          <div />
          <FooterRight>
            <Btn $primary onClick={() => window.location.reload()}>
              View My ID <ArrowRightIcon size={12} />
            </Btn>
          </FooterRight>
        </Footer>
      );
    }

    if (step === "confirm") {
      return (
        <Footer>
          <FooterLeft>
            <Btn onClick={() => navigate("/majikah")}>
              <PencilSimpleIcon size={12} /> Edit on Profile Page
            </Btn>
          </FooterLeft>
          <FooterRight>
            <Btn
              $primary
              onClick={() => {
                setProfileMode("view");
                setStep("key");
              }}
              disabled={!user || profileMode === "edit"}
            >
              Confirm &amp; Continue <ArrowRightIcon size={12} />
            </Btn>
          </FooterRight>
        </Footer>
      );
    }

    // step === "key"
    const canCreate = !!importedKeyId;
    return (
      <Footer>
        <FooterLeft>
          <Btn
            onClick={() => {
              setStep("confirm");
              setCreateError(null);
            }}
          >
            <ArrowLeftIcon size={12} /> Back
          </Btn>
        </FooterLeft>
        <FooterRight>
          <Btn
            $primary
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
          >
            {isCreating ? (
              <ShimmerBtn>Saving to server…</ShimmerBtn>
            ) : (
              <>
                <ShieldPlusIcon size={12} /> Create Universal ID
              </>
            )}
          </Btn>
        </FooterRight>
      </Footer>
    );
  };

  return (
    <Root>
      <GuideHelper
        docsPath="https://majikah.solutions/products/majik-buwiz/docs/buwiz-muid-setup"
        // startTour={() => launchTutorialAccounts(tour)}
        id="guide-muid-setup"
      />
      <Header>
        <HeaderTitle>
          {step === "confirm"
            ? "Set Up Universal ID"
            : step === "key"
              ? "Load Majik Key"
              : "Identity Ready"}
        </HeaderTitle>
        <HeaderSub>
          {step === "confirm"
            ? "Confirm or update your personal information before proceeding."
            : step === "key"
              ? "Load the seed key backup file to temporarily bind a key to your identity."
              : "Your MajikUniversalID has been created and saved successfully."}
        </HeaderSub>
      </Header>

      <ProgressBar>
        {STEPS.map((s, i) => (
          <ProgressStep
            key={s.id}
            $state={
              i < stepIndex ? "done" : i === stepIndex ? "active" : "pending"
            }
          />
        ))}
      </ProgressBar>

      <StepLabel>
        {STEPS.map((s, i) => (
          <StepLabelItem key={s.id} $active={i === stepIndex}>
            {s.label}
          </StepLabelItem>
        ))}
      </StepLabel>

      <ScrollArea>
        {step === "confirm" && renderConfirmStep()}
        {step === "key" && renderKeyStep()}
        {step === "success" && renderSuccessStep()}
      </ScrollArea>

      {renderFooter()}
    </Root>
  );
};

export default MajikUniversalIDSetup;
