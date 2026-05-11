import React, { useState } from "react";
import styled from "styled-components";
import { EditableField } from "./EditableField";
import { Party } from "@majikah/majik-invoice";
import { PickContactModal } from "./modals/PickContactModal";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import { AddressBookIcon } from "@phosphor-icons/react";

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

const PickButton = styled.button`
  border: none;
  background: transparent;
  padding: 0 2px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  opacity: 0.6;
  transition: opacity 0.15s ease;
  justify-content: center;
  gap: 5px;

  &:hover {
    opacity: 1;
  }
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PartyBlockProps {
  majik: MajikBuwizDatabase;
  issuer: Party;
  recipient: Party;
  readonly: boolean;
  onIssuerChange: (patch: Partial<Party>) => void;
  onRecipientChange: (patch: Partial<Party>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PartyBlockComponent: React.FC<PartyBlockProps> = ({
  majik,
  issuer,
  recipient,
  readonly,
  onIssuerChange,
  onRecipientChange,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <PartiesGrid>
        <PartyPane
          party={issuer}
          label="Issuer"
          readonly={readonly}
          onChange={onIssuerChange}
        />
        <PartyPane
          party={recipient}
          label="Bill to"
          readonly={readonly}
          onChange={onRecipientChange}
          onPickContact={readonly ? undefined : () => setPickerOpen(true)}
        />
      </PartiesGrid>

      <PickContactModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        majik={majik}
        onSelect={onRecipientChange}
        partyLabel="Recipient"
      />
    </>
  );
};

export const PartyBlock = React.memo(PartyBlockComponent);

// ---------------------------------------------------------------------------
// PartyPane — single party
// ---------------------------------------------------------------------------

const PartyPane: React.FC<{
  party: Party;
  label: string;
  readonly: boolean;
  onChange: (patch: Partial<Party>) => void;

  onPickContact?: () => void; // ← add this
}> = ({ party, label, readonly, onChange, onPickContact }) => (
  <PartyContainer>
    <SectionLabel>
      {label}

      {onPickContact && (
        <PickButton
          type="button"
          onClick={onPickContact}
          title="Pick from directory"
        >
          <AddressBookIcon size={18} />
          Pick Contact from Directory
        </PickButton>
      )}
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
