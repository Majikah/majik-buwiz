import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { EditableField } from "./EditableField";
import { Party } from "@majikah/majik-invoice";
import { PickContactModal } from "./modals/PickContactModal";
import { MajikBuwizDatabase } from "@/components/majik-context-wrapper/majik-buwiz-database";
import {
  AddressBookIcon,
  CheckIcon,
  ClipboardIcon,
  CopyIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Clipboard helpers
// ---------------------------------------------------------------------------

const CLIPBOARD_PREFIX = "majik-buwiz-party:";

function encodeParty(party: Party): string {
  const json = JSON.stringify(party);
  return CLIPBOARD_PREFIX + btoa(unescape(encodeURIComponent(json)));
}

function decodeParty(raw: string): Party | null {
  try {
    if (!raw.startsWith(CLIPBOARD_PREFIX)) return null;
    const b64 = raw.slice(CLIPBOARD_PREFIX.length);
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    // Shape validation — legalName is the only required field on Party
    if (
      typeof obj !== "object" ||
      obj === null ||
      typeof obj.legalName !== "string"
    ) {
      return null;
    }
    return obj as Party;
  } catch {
    return null;
  }
}

async function readClipboardParty(): Promise<Party | null> {
  try {
    const text = await navigator.clipboard.readText();
    return decodeParty(text);
  } catch {
    return null;
  }
}

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

const IconBtn = styled.button<{ $variant?: "default" | "accent" | "green" }>`
  border: none;
  background: transparent;
  padding: 0 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  flex-shrink: 0;
  transition:
    background ${({ theme }) => theme.animations.duration.short},
    color ${({ theme }) => theme.animations.duration.short},
    opacity ${({ theme }) => theme.animations.duration.short};

  color: ${({ theme, $variant }) =>
    $variant === "green" ? theme.colors.brand.green : theme.colors.primary};

  opacity: 0.6;

  &:hover {
    opacity: 1;
    background: ${({ theme, $variant }) =>
      $variant === "green"
        ? `${theme.colors.brand.green}18`
        : theme.colors.primarySoft};
  }
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

// Sits before the ::after rule so it doesn't stretch the label row
const LabelActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  /* Reset the uppercase/letter-spacing inherited from SectionLabel */
  font-size: 12px;
  letter-spacing: 0;
  text-transform: none;
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

const CLIPBOARD_POLL_MS = 1500;

const PartyBlockComponent: React.FC<PartyBlockProps> = ({
  majik,
  issuer,
  recipient,
  readonly,
  onIssuerChange,
  onRecipientChange,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clipboardParty, setClipboardParty] = useState<Party | null>(null);
  const [copiedSide, setCopiedSide] = useState<"issuer" | "recipient" | null>(
    null,
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Clipboard polling ────────────────────────────────────────────────────

  const refreshClipboard = useCallback(async () => {
    const party = await readClipboardParty();
    setClipboardParty(party);
  }, []);

  useEffect(() => {
    refreshClipboard();
    pollRef.current = setInterval(refreshClipboard, CLIPBOARD_POLL_MS);

    const onFocus = () => refreshClipboard();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshClipboard();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshClipboard]);

  // ── Copy / Paste handlers ────────────────────────────────────────────────

  const copyParty = async (side: "issuer" | "recipient") => {
    const party = side === "issuer" ? issuer : recipient;
    await navigator.clipboard.writeText(encodeParty(party));
    setCopiedSide(side);
    await refreshClipboard();
    setTimeout(() => setCopiedSide(null), 1400);
    toast.success(`${side === "issuer" ? "Issuer" : "Recipient"} copied`);
  };

  const pasteParty = (side: "issuer" | "recipient") => {
    if (!clipboardParty) return;
    const handler = side === "issuer" ? onIssuerChange : onRecipientChange;
    handler(clipboardParty);
    toast.success(`Pasted into ${side === "issuer" ? "Issuer" : "Recipient"}`);
  };

  const canPaste = clipboardParty !== null;

  return (
    <>
      <PartiesGrid>
        <PartyPane
          party={issuer}
          label="Issuer"
          readonly={readonly}
          onChange={onIssuerChange}
          isCopied={copiedSide === "issuer"}
          canPaste={canPaste}
          onCopy={() => copyParty("issuer")}
          onPaste={() => pasteParty("issuer")}
        />
        <PartyPane
          party={recipient}
          label="Bill to"
          readonly={readonly}
          onChange={onRecipientChange}
          isCopied={copiedSide === "recipient"}
          canPaste={canPaste}
          onCopy={() => copyParty("recipient")}
          onPaste={() => pasteParty("recipient")}
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
  isCopied: boolean;
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onPickContact?: () => void;
}> = ({
  party,
  label,
  readonly,
  onChange,
  isCopied,
  canPaste,
  onCopy,
  onPaste,
  onPickContact,
}) => (
  <PartyContainer>
    <SectionLabel>
      {label}

      {/* ── Clipboard actions — copy always, paste when available ── */}
      <LabelActions>
        <IconBtn
          type="button"
          title={isCopied ? "Copied!" : `Copy ${label} to clipboard`}
          onClick={onCopy}
        >
          {isCopied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        </IconBtn>

        <IconBtn
          type="button"
          $variant="green"
          title={
            canPaste
              ? `Paste clipboard party into ${label}`
              : "No copied party in clipboard"
          }
          onClick={onPaste}
          disabled={!canPaste}
          style={{
            opacity: canPaste ? 0.7 : 0.25,
            cursor: canPaste ? "pointer" : "default",
          }}
        >
          <ClipboardIcon size={14} />
        </IconBtn>
      </LabelActions>

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
