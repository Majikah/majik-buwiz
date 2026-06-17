import React from "react";
import styled from "styled-components";

import type { Party } from "@majikah/majik-invoice";
import { EditableField } from "@/components/functional/MajikInvoiceDocument/EditableField";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const PartiesGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.large};
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  padding-top: ${({ theme }) => theme.spacing.medium};
  border-top: 1px solid ${({ theme }) => theme.colors.primary}18;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr;
  }
`;

const PartyContainer = styled.div``;

const SectionLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.primary}22;
  }
`;

const FieldStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const RoleTag = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 9px;
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExpensePartiesProps {
  /** The vendor / supplier being paid */
  payee: Party;
  /** The entity that made the payment (your company) */
  paidBy: Party;
  readonly: boolean;
  onPayeeChange: (patch: Partial<Party>) => void;
  onPaidByChange: (patch: Partial<Party>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpensePartiesComponent: React.FC<ExpensePartiesProps> = ({
  payee,
  paidBy,
  readonly,
  onPayeeChange,
  onPaidByChange,
}) => (
  <PartiesGrid>
    <PartyPane
      party={payee}
      label="Payee"
      roleTag="Vendor / Supplier"
      readonly={readonly}
      onChange={onPayeeChange}
    />
    <PartyPane
      party={paidBy}
      label="Paid By"
      roleTag="Your Entity"
      readonly={readonly}
      onChange={onPaidByChange}
    />
  </PartiesGrid>
);

export const ExpenseParties = React.memo(ExpensePartiesComponent);

// ---------------------------------------------------------------------------
// PartyPane — single party column
// ---------------------------------------------------------------------------

const PartyPane: React.FC<{
  party: Party;
  label: string;
  roleTag: string;
  readonly: boolean;
  onChange: (patch: Partial<Party>) => void;
}> = ({ party, label, roleTag, readonly, onChange }) => (
  <PartyContainer>
    <SectionLabel>
      {label}
      <RoleTag>{roleTag}</RoleTag>
    </SectionLabel>

    <FieldStack>
      <EditableField
        block
        label="Legal Name"
        value={party.legalName}
        onChange={(v) => onChange({ legalName: v })}
        readonly={readonly}
        inputStyle={{
          fontFamily: "var(--font-semibold)",
          fontSize: "14px",
          fontWeight: 600,
        }}
      />

      {(party.tradeName !== undefined || !readonly) && (
        <EditableField
          block
          label="Trade Name / DBA"
          value={party.tradeName ?? ""}
          onChange={(v) => onChange({ tradeName: v || undefined })}
          readonly={readonly}
          inputStyle={{ fontSize: "12px", opacity: 0.6, fontStyle: "italic" }}
        />
      )}

      {(party.tin !== undefined || !readonly) && (
        <EditableField
          block
          label="TIN / Tax ID"
          value={party.tin ?? ""}
          onChange={(v) => onChange({ tin: v || undefined })}
          readonly={readonly}
          inputStyle={{ fontSize: "11px", letterSpacing: "0.04em" }}
        />
      )}

      {(party.address?.line1 !== undefined || !readonly) && (
        <EditableField
          block
          label="Address Line 1"
          value={party.address?.line1 ?? ""}
          onChange={(v) =>
            onChange({
              address: {
                ...party.address,
                line1: v,
                city: party.address?.city ?? "",
                country: party.address?.country ?? "",
              },
            })
          }
          readonly={readonly}
          inputStyle={{ fontSize: "12px" }}
        />
      )}

      {(party.address?.city !== undefined || !readonly) && (
        <EditableField
          block
          label="City, State / Province"
          value={[party.address?.city, party.address?.stateOrProvince]
            .filter(Boolean)
            .join(", ")}
          onChange={(v) => {
            const [city, ...rest] = v.split(",").map((s) => s.trim());
            onChange({
              address: {
                ...party.address!,
                city: city ?? "",
                stateOrProvince: rest.join(", ") || undefined,
                country: party.address?.country ?? "",
              },
            });
          }}
          readonly={readonly}
          inputStyle={{ fontSize: "12px" }}
        />
      )}

      {(party.address?.country !== undefined || !readonly) && (
        <EditableField
          block
          label="Country (ISO 3166-1 Alpha-2)"
          value={party.address?.country ?? ""}
          onChange={(v) =>
            onChange({
              address: {
                ...party.address!,
                country: v.toUpperCase(),
                city: party.address?.city ?? "",
              },
            })
          }
          readonly={readonly}
          inputStyle={{
            fontSize: "11px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        />
      )}

      {(party.email !== undefined || !readonly) && (
        <EditableField
          block
          label="Email"
          type="email"
          value={party.email ?? ""}
          onChange={(v) => onChange({ email: v || undefined })}
          readonly={readonly}
          inputStyle={{ fontSize: "12px" }}
        />
      )}

      {(party.phone !== undefined || !readonly) && (
        <EditableField
          block
          label="Phone"
          type="tel"
          value={party.phone ?? ""}
          onChange={(v) => onChange({ phone: v || undefined })}
          readonly={readonly}
          inputStyle={{ fontSize: "12px" }}
        />
      )}
    </FieldStack>
  </PartyContainer>
);
