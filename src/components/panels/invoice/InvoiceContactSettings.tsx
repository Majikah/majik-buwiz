import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import CustomFormInput from "../../foundations/CustomFormInput";
import type { MajikBuwizClient } from "../../../SDK/majik-buwiz-client/src/majik-buwiz-client";
import type {
  MajikInvoiceContactMeta,
  InvoiceContactAddress,
  InvoiceContactTaxProfile,
} from "../../../SDK/majik-buwiz-client/src/core/party/types";
import {
  TAXPAYER_TYPE,
  TAXPAYER_CATEGORY,
  VAT_TYPE,
} from "../../../SDK/majik-buwiz-client/src/core/party/enums";
import DynamicAlertBanner from "@/components/foundations/DynamicAlertBanner";

// Reuse InvoiceSettings look & feel
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
`;

const FieldRow = styled.div`
  display: flex;
  width: 100%;
`;

// Fallback meta used when there is no active account
const FALLBACK_META: MajikInvoiceContactMeta = {
  label: "",
  notes: "",
  blocked: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  legalName: "",
};

interface Props {
  majik: MajikBuwizClient;
  onClose?: () => void;
  onChange?: (meta: MajikInvoiceContactMeta) => void;
  /** Fires whenever the overall form validity changes */
  onValidate?: (valid: boolean) => void;
  contactId?: string;
}

export const InvoiceContactSettings: React.FC<Props> = ({
  majik,
  onChange,
  onValidate,
  contactId,
}) => {
  const [form, setForm] = useState<MajikInvoiceContactMeta>(FALLBACK_META);

  const metaRef = useRef<MajikInvoiceContactMeta>(FALLBACK_META);
  const validityRef = useRef<Record<string, boolean>>({});

  // keep metaRef and initial validity in sync with state when form changes
  useEffect(() => {
    metaRef.current = form;
    validityRef.current["legalName"] = !!(
      form.legalName && String(form.legalName).trim()
    );
    validityRef.current["tradeName"] = !!(
      form.tradeName && String(form.tradeName).trim()
    );
    validityRef.current["tin"] = !!(form.tin && String(form.tin).trim());
    computeOverallValidity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  useEffect(() => {
    // Prefill from active account where possible
    try {
      // majik.getActiveAccount may be undefined at runtime; guard it
      // and merge any available meta fields into the form.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acct = contactId?.trim()
        ? majik.getContactByID(contactId)
        : majik.getActiveAccount();
      if (acct?.meta) {
        const merged: MajikInvoiceContactMeta = {
          ...FALLBACK_META,
          ...acct.meta,
          updatedAt: new Date().toISOString(),
        } as MajikInvoiceContactMeta;
        setForm(merged);
        onChange?.(merged);
      } else {
        setForm(FALLBACK_META);
      }
    } catch (err) {
      setForm(FALLBACK_META);
    }
    // run on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitChange = (next: MajikInvoiceContactMeta) => {
    onChange?.(next);
  };

  const computeOverallValidity = () => {
    // required fields for invoice contact
    const required = ["legalName", "tradeName", "tin"];
    const ok = required.every((k) => validityRef.current[k] === true);
    onValidate?.(ok);
    return ok;
  };

  const setField = <K extends keyof MajikInvoiceContactMeta>(
    key: K,
    value: MajikInvoiceContactMeta[K],
  ) => {
    // update ref immediately so handlers/readers get latest without waiting for state
    const updated = {
      ...metaRef.current,
      [key]: value,
    } as MajikInvoiceContactMeta;
    metaRef.current = updated;
    setForm(updated);
    queueMicrotask(() => emitChange(updated));
  };

  const setAddressField = (key: keyof InvoiceContactAddress, value: string) => {
    const updated = {
      ...metaRef.current,
      address: { ...(metaRef.current.address ?? {}), [key]: value },
    } as MajikInvoiceContactMeta;
    metaRef.current = updated;
    setForm(updated);
    queueMicrotask(() => emitChange(updated));
  };

  const setTaxProfileField = (
    key: keyof InvoiceContactTaxProfile,
    value: any,
  ) => {
    const updated = {
      ...metaRef.current,
      taxProfile: { ...(metaRef.current.taxProfile ?? {}), [key]: value },
    } as MajikInvoiceContactMeta;
    metaRef.current = updated;
    setForm(updated);
    queueMicrotask(() => emitChange(updated));
  };

  return (
    <Panel>
      <PanelBody>
        <DynamicAlertBanner
          title="Your data stays with you"
          level="info"
          description="All information here is stored locally on your device. When you use Majik Invoices on the exchange network, sensitive data is encrypted on your device before it’s sent—so only you and the intended recipient can read it."
        />
        <Section>
          <SectionLabel>Identity</SectionLabel>
          <FieldRow>
            <CustomFormInput
              label="Label"
              value={form.label ?? ""}
              onChange={(v) => setField("label", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Legal name"
              value={form.legalName ?? ""}
              onChange={(v) => setField("legalName", String(v))}
              layout="row"
              required
              onValidated={(valid) => {
                validityRef.current["legalName"] = !!valid;
                computeOverallValidity();
              }}
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Trade name"
              value={form.tradeName ?? ""}
              onChange={(v) => setField("tradeName", String(v))}
              layout="row"
              required
              onValidated={(valid) => {
                validityRef.current["tradeName"] = !!valid;
                computeOverallValidity();
              }}
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Nature of business"
              value={form.natureOfBusiness ?? ""}
              onChange={(v) => setField("natureOfBusiness", String(v))}
              layout="row"
            />
          </FieldRow>
        </Section>

        <Section>
          <SectionLabel>Contact</SectionLabel>
          <FieldRow>
            <CustomFormInput
              label="Email"
              type="email"
              value={form.email ?? ""}
              onChange={(v) => setField("email", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Phone"
              value={form.phone ?? ""}
              onChange={(v) => setField("phone", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Website"
              type="url"
              value={form.website ?? ""}
              onChange={(v) => setField("website", String(v))}
              layout="row"
            />
          </FieldRow>
        </Section>

        <Section>
          <SectionLabel>Tax & ID</SectionLabel>
          <FieldRow>
            <CustomFormInput
              label="TIN"
              value={form.tin ?? ""}
              onChange={(v) => setField("tin", String(v))}
              layout="row"
              required
              onValidated={(valid) => {
                validityRef.current["tin"] = !!valid;
                computeOverallValidity();
              }}
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Tax ID type"
              value={form.taxIdType ?? ""}
              onChange={(v) => setField("taxIdType", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Tax-exempt"
              value={!!form.taxExempt}
              onChange={(v) => setField("taxExempt", Boolean(v))}
              type="boolean"
              useToggle
              layout="row"
            />
          </FieldRow>

          {form.taxExempt && (
            <FieldRow>
              <CustomFormInput
                label="Exempt ref"
                value={form.taxExemptRef ?? ""}
                onChange={(v) => setField("taxExemptRef", String(v))}
                layout="row"
              />
            </FieldRow>
          )}

          <FieldRow>
            <CustomFormInput
              label="Taxpayer type"
              value={form.taxProfile?.taxpayerType ?? ""}
              onChange={(v) => setTaxProfileField("taxpayerType", String(v))}
              options={Object.values(TAXPAYER_TYPE).map((v) => ({
                value: v,
                label: v,
              }))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Taxpayer category"
              value={form.taxProfile?.taxpayerCategory ?? ""}
              onChange={(v) =>
                setTaxProfileField("taxpayerCategory", String(v))
              }
              options={Object.values(TAXPAYER_CATEGORY).map((v) => ({
                value: v,
                label: v,
              }))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Is Percentage Tax"
              value={!!form.taxProfile?.isPercentageTax}
              onChange={(v) =>
                setTaxProfileField("isPercentageTax", Boolean(v))
              }
              type="boolean"
              useToggle
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Is Withholding Agent"
              value={!!form.taxProfile?.isWithholdingAgent}
              onChange={(v) =>
                setTaxProfileField("isWithholdingAgent", Boolean(v))
              }
              type="boolean"
              useToggle
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Default ATC"
              value={form.taxProfile?.defaultATC ?? ""}
              onChange={(v) => setTaxProfileField("defaultATC", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="VAT type"
              value={form.taxProfile?.vatType ?? ""}
              onChange={(v) => setTaxProfileField("vatType", String(v))}
              options={Object.values(VAT_TYPE).map((v) => ({
                value: v,
                label: v,
              }))}
              layout="row"
            />
          </FieldRow>
        </Section>

        <Section>
          <SectionLabel>Address</SectionLabel>
          <FieldRow>
            <CustomFormInput
              label="Line 1"
              value={form.address?.line1 ?? ""}
              onChange={(v) => setAddressField("line1", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Line 2"
              value={form.address?.line2 ?? ""}
              onChange={(v) => setAddressField("line2", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="City"
              value={form.address?.city ?? ""}
              onChange={(v) => setAddressField("city", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="State"
              value={form.address?.stateOrProvince ?? ""}
              onChange={(v) => setAddressField("stateOrProvince", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Postal"
              value={form.address?.postalCode ?? ""}
              onChange={(v) => setAddressField("postalCode", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Country"
              value={form.address?.country ?? ""}
              onChange={(v) => setAddressField("country", String(v))}
              placeholder="ISO 3166-1 alpha-2"
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="Branch code"
              value={form.address?.branchCode ?? ""}
              onChange={(v) => setAddressField("branchCode", String(v))}
              layout="row"
            />
          </FieldRow>

          <FieldRow>
            <CustomFormInput
              label="District"
              value={form.address?.district ?? ""}
              onChange={(v) => setAddressField("district", String(v))}
              layout="row"
            />
          </FieldRow>
        </Section>
      </PanelBody>
    </Panel>
  );
};

export default InvoiceContactSettings;
