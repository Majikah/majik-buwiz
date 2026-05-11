/**
 * InvoicePDFExportDialog.tsx
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled, { css } from "styled-components";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

import type { MajikInvoice } from "@majikah/majik-invoice";

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/globals/styled-dialogs";

// =============================================================================
// Types
// =============================================================================

export interface InvoicePDFExportOptions {
  includeTaxBreakdown: boolean;
  includeReferences: boolean;
  includeTags: boolean;
  includeNotes: boolean;
  includeCryptographicProof: boolean;
  includePaymentProofs: boolean;
}

export type InvoicePDFExportPreset = "full" | "essentials" | "custom";

export interface InvoicePDFExportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;

  invoices: MajikInvoice[];

  onExport: (
    invoices: MajikInvoice[],
    options: InvoicePDFExportOptions,
  ) => Promise<void> | void;
}

// =============================================================================
// Defaults / Presets
// =============================================================================

export const FULL_EXPORT_OPTIONS: InvoicePDFExportOptions = {
  includeTaxBreakdown: true,
  includeReferences: true,
  includeTags: true,
  includeNotes: true,
  includeCryptographicProof: true,
  includePaymentProofs: true,
};

export const ESSENTIAL_EXPORT_OPTIONS: InvoicePDFExportOptions = {
  includeTaxBreakdown: true,
  includeReferences: false,
  includeTags: true,
  includeNotes: true,
  includeCryptographicProof: false,
  includePaymentProofs: false,
};

function optionsForPreset(
  preset: InvoicePDFExportPreset,
): InvoicePDFExportOptions {
  switch (preset) {
    case "essentials":
      return { ...ESSENTIAL_EXPORT_OPTIONS };

    case "full":
      return { ...FULL_EXPORT_OPTIONS };

    default:
      return { ...FULL_EXPORT_OPTIONS };
  }
}

// =============================================================================
// Metadata
// =============================================================================

const OPTION_META: Array<{
  key: keyof InvoicePDFExportOptions;
  label: string;
  description?: string;
}> = [
  {
    key: "includeTaxBreakdown",
    label: "Include tax breakdown",
  },
  {
    key: "includeReferences",
    label: "Include references",
  },
  {
    key: "includeTags",
    label: "Include tags",
  },
  {
    key: "includeNotes",
    label: "Include notes",
  },
  {
    key: "includeCryptographicProof",
    label: "Include cryptographic proof and signatures",
  },
  {
    key: "includePaymentProofs",
    label: "Include proof of payments",
  },
];

// =============================================================================
// Styled
// =============================================================================

const Body = styled.div`
  display: flex;
  flex-direction: column;
`;

const PresetStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}15;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const PresetLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
`;

const PresetBtn = styled.button<{ $active?: boolean }>`
  font-size: 11px;
  padding: 5px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  cursor: pointer;
  transition: all 0.13s;
  font-family: ${({ theme }) => theme.typography.fonts.medium};

  ${({ $active, theme }) =>
    $active
      ? css`
          background: ${theme.colors.primarySoft};
          border: 1px solid ${theme.colors.primary}55;
          color: ${theme.colors.primary};
        `
      : css`
          background: transparent;
          border: 1px solid ${theme.colors.primary}22;
          color: ${theme.colors.textSecondary};

          &:hover {
            background: ${theme.colors.primarySoft};
            border-color: ${theme.colors.primary}44;
            color: ${theme.colors.primary};
          }
        `}
`;

const OptionList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
`;

const OptionItem = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
  }
`;

const Checkbox = styled.input.attrs({
  type: "checkbox",
})`
  margin-top: 2px;
  accent-color: ${({ theme }) => theme.colors.primary};
`;

const OptionContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const OptionLabel = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fonts.medium};
`;

const OptionDescription = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid ${({ theme }) => theme.colors.primary}12;
  background: ${({ theme }) => theme.colors.secondaryBackground};
`;

const ScopeBadge = styled.span`
  font-size: 11px;
  padding: 3px 9px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};

  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  color: ${({ theme }) => theme.colors.primary};

  font-family: ${({ theme }) => theme.typography.fonts.medium};
`;

const FooterActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CancelBtn = styled(AlertDialog.Cancel)`
  font-size: 12px;
  padding: 7px 15px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};

  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  background: transparent;

  color: ${({ theme }) => theme.colors.textSecondary};

  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ExportBtn = styled.button`
  font-size: 12px;
  padding: 7px 15px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};

  border: 1px solid transparent;
  background: ${({ theme }) => theme.gradients.primary};

  color: ${({ theme }) => theme.colors.static.white};

  cursor: pointer;

  &:hover {
    filter: brightness(1.05);
  }
`;

// =============================================================================
// Component
// =============================================================================

export const InvoicePDFExportDialog: React.FC<InvoicePDFExportDialogProps> = ({
  isOpen,
  onOpenChange,
  invoices,
  onExport,
}) => {
  const [preset, setPreset] = useState<InvoicePDFExportPreset>("full");

  const [options, setOptions] =
    useState<InvoicePDFExportOptions>(FULL_EXPORT_OPTIONS);

  useEffect(() => {
    if (isOpen) {
      setPreset("full");
      setOptions(FULL_EXPORT_OPTIONS);
    }
  }, [isOpen]);

  const selectedCount = useMemo(
    () => Object.values(options).filter(Boolean).length,
    [options],
  );

  const applyPreset = useCallback((nextPreset: InvoicePDFExportPreset) => {
    setPreset(nextPreset);
    setOptions(optionsForPreset(nextPreset));
  }, []);

  const handleToggle = useCallback((key: keyof InvoicePDFExportOptions) => {
    setPreset("custom");

    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleExport = useCallback(async () => {
    await onExport(invoices, options);
    onOpenChange(false);
  }, [invoices, onExport, onOpenChange, options]);

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <DialogOverlay />

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Invoice PDF</DialogTitle>

            <DialogDescription>
              Choose which sections and metadata to include in the generated PDF
              export.
            </DialogDescription>
          </DialogHeader>

          <Body>
            <PresetStrip>
              <PresetLabel>Preset:</PresetLabel>

              <PresetBtn
                $active={preset === "full"}
                onClick={() => applyPreset("full")}
              >
                Full Export
              </PresetBtn>

              <PresetBtn
                $active={preset === "essentials"}
                onClick={() => applyPreset("essentials")}
              >
                Essentials
              </PresetBtn>
            </PresetStrip>

            <OptionList>
              {OPTION_META.map((option) => (
                <OptionItem key={option.key}>
                  <Checkbox
                    checked={options[option.key]}
                    onChange={() => handleToggle(option.key)}
                  />

                  <OptionContent>
                    <OptionLabel>{option.label}</OptionLabel>

                    {option.description && (
                      <OptionDescription>
                        {option.description}
                      </OptionDescription>
                    )}
                  </OptionContent>
                </OptionItem>
              ))}
            </OptionList>

            <Footer>
              <ScopeBadge>
                {selectedCount} section
                {selectedCount !== 1 ? "s" : ""} included
              </ScopeBadge>

              <FooterActions>
                <CancelBtn>Cancel</CancelBtn>

                <ExportBtn onClick={handleExport}>Export PDF</ExportBtn>
              </FooterActions>
            </Footer>
          </Body>
        </DialogContent>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default InvoicePDFExportDialog;
