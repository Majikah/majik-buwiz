// components/InvoiceReferenceFormPopover.tsx

import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { InfoIcon, NoteIcon } from "@phosphor-icons/react";

import type { DocumentReference } from "@majikah/majik-invoice";

import ConfirmationButton from "@/components/foundations/ConfirmationButton";
import { InvoiceReferenceTypePicker } from "@/components/functional/MajikInvoiceDocument/InvoiceReferenceTypePicker";
import { InvoiceReferenceType } from "@/components/functional/MajikInvoiceDocument/_utils";
import CustomFormInput from "@/components/foundations/CustomFormInput";

// ── Styled ────────────────────────────────────────────────────────────────

const Panel = styled.div`
  width: 100%;
  height: fit-content;
  background: inherit;
  display: flex;
  flex-direction: column;
`;

const PanelBody = styled.div`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionLabel = styled.div`
  font-size: 9px;
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}15;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: transparent;
  }
`;

const FieldColumn = styled.div`
  display: flex;
  flex-direction: column;
  grid-template-columns: 140px 1fr;
  align-items: flex-start;
  gap: 12px;
`;

const FieldLabel = styled.label`
  font-size: 11px;
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// ── Constants ─────────────────────────────────────────────────────────────

const FALLBACK_DEFAULTS: DocumentReference = {
  type: "PO",
  number: `PO-${Date.now().toString().slice(-4)}`,
  date: new Date().toISOString().slice(0, 10),
};

// ── Component ─────────────────────────────────────────────────────────────

interface InvoiceReferenceFormProps {
  onClose: () => void;
  onChange?: (data: DocumentReference) => void;
  onValidate?: (valid: boolean) => void;
}

export const InvoiceReferenceForm: React.FC<InvoiceReferenceFormProps> = ({
  onChange,
  onValidate,
}) => {
  const [form, setForm] = useState<DocumentReference>({
    ...FALLBACK_DEFAULTS,
    number: "",
  });

  const formRef = useRef<DocumentReference>({
    ...FALLBACK_DEFAULTS,
    number: "",
  });
  const validityRef = useRef<Record<string, boolean>>({});

  // keep metaRef and initial validity in sync with state when form changes
  useEffect(() => {
    formRef.current = form;
    validityRef.current["type"] = !!(form.type && String(form.type).trim());
    validityRef.current["number"] = !!(
      form.number && String(form.number).trim()
    );
    validityRef.current["date"] = !!(form.date && String(form.date).trim());
    computeOverallValidity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const computeOverallValidity = () => {
    // required fields for invoice contact
    const required = ["type", "number", "date"];
    const ok = required.every((k) => validityRef.current[k] === true);
    onValidate?.(ok);
    return ok;
  };

  const emitChange = (next: DocumentReference) => {
    onChange?.(next);
  };

  // Helpers
  const setField = <K extends keyof DocumentReference>(
    key: K,
    value: DocumentReference[K],
  ) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };

      queueMicrotask(() => emitChange(updated));

      return updated;
    });
  };

  const handleReset = async () => {
    setForm(FALLBACK_DEFAULTS);

    queueMicrotask(() => {
      emitChange(FALLBACK_DEFAULTS);
    });
  };

  return (
    <Panel>
      <PanelBody>
        {/* ── Issuer ── */}
        <Section>
          <SectionLabel>
            <InfoIcon size={12} /> Reference Info
          </SectionLabel>

          <FieldColumn>
            <FieldLabel>Type</FieldLabel>
            <InvoiceReferenceTypePicker
              value={
                (form.type as InvoiceReferenceType) ?? FALLBACK_DEFAULTS.type
              }
              onChange={(e) => setField("type", e || "PO")}
              readonly={false}
            />
          </FieldColumn>

          <CustomFormInput
            label="Reference Number"
            value={form.number ?? ""}
            onChange={(e) => setField("number", String(e))}
            layout="row"
            required
            onValidated={(valid) => {
              validityRef.current["number"] = !!valid;
              computeOverallValidity();
            }}
          />

          <CustomFormInput
            label="Date"
            value={
              form.date?.slice(0, 10) ??
              FALLBACK_DEFAULTS.date ??
              new Date().toISOString().slice(0, 10)
            }
            onChange={(e) => setField("date", String(e).slice(0, 10))}
            layout="row"
            required
            onValidated={(valid) => {
              validityRef.current["date"] = !!valid;
              computeOverallValidity();
            }}
            type="date"
          />
        </Section>

        {/* ── Billing ── */}
        <Section>
          <SectionLabel>
            <NoteIcon size={12} /> Notes
          </SectionLabel>

          <CustomFormInput
            label="Default Notes"
            value={form.notes ?? ""}
            onChange={(e) => setField("notes", String(e))}
            layout="stack"
            required={false}
            type="paragraph"
          />
        </Section>

        <ConfirmationButton
          onClick={handleReset}
          text="Reset to Defaults"
          strict
          alertTextTitle="Reset to Defaults"
        />
      </PanelBody>
    </Panel>
  );
};
