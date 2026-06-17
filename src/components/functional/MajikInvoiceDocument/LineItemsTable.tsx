import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { EditableField } from "./EditableField";
import type { LineItemInput } from "@majikah/majik-invoice";
import { toast } from "sonner";
import {
  CheckIcon,
  ClipboardIcon,
  CopyIcon,
  DotsThreeIcon,
  PlusIcon,
  ScalesIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { CopyPlusIcon } from "lucide-react";

import DropDownMenu from "@/components/foundations/DropDownMenu";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function computeLineItem(item: LineItemInput): {
  base: number;
  discountAmt: number;
  postDiscount: number;
  taxAmt: number;
  net: number;
} {
  const base = item.quantity * item.unitPrice;
  const discountAmt = item.discount
    ? item.discount.type === "percentage"
      ? base * item.discount.value
      : item.discount.value
    : 0;
  const postDiscount = base - discountAmt;

  const taxes = item.taxes ?? [];
  const taxAmt = taxes.reduce((sum, tax) => {
    const amt = tax.inclusive
      ? postDiscount - postDiscount / (1 + tax.rate)
      : postDiscount * tax.rate;
    return sum + amt;
  }, 0);

  const hasExclusive = taxes.some((t) => !t.inclusive);
  const net = hasExclusive ? postDiscount + taxAmt : postDiscount;

  return { base, discountAmt, postDiscount, taxAmt, net };
}

export function fmt(n: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function pct(r: number) {
  return (r * 100).toFixed(0) + "%";
}

// ---------------------------------------------------------------------------
// Clipboard helpers
// ---------------------------------------------------------------------------

const CLIPBOARD_PREFIX = "majik-buwiz-line-item:";

/** Encode a LineItemInput to a base64 clipboard string */
function encodeLineItem(item: LineItemInput): string {
  const json = JSON.stringify(item);
  return CLIPBOARD_PREFIX + btoa(unescape(encodeURIComponent(json)));
}

/** Decode and validate a clipboard string. Returns null if invalid. */
function decodeLineItem(raw: string): LineItemInput | null {
  try {
    if (!raw.startsWith(CLIPBOARD_PREFIX)) return null;
    const b64 = raw.slice(CLIPBOARD_PREFIX.length);
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    // Shape validation — required fields
    if (
      typeof obj !== "object" ||
      obj === null ||
      typeof obj.description !== "string" ||
      typeof obj.quantity !== "number" ||
      typeof obj.unitPrice !== "number"
    ) {
      return null;
    }
    return obj as LineItemInput;
  } catch {
    return null;
  }
}

/** Try to read and decode clipboard. Returns null if unavailable or invalid. */
async function readClipboardItem(): Promise<LineItemInput | null> {
  try {
    const text = await navigator.clipboard.readText();
    return decodeLineItem(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const TableWrapper = styled.div`
  overflow-x: auto;
  margin-bottom: ${({ theme }) => theme.spacing.small};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-family: ${({ theme }) => theme.typography.fonts.regular};
`;

const Th = styled.th<{ $align?: "left" | "right" | "center" }>`
  font-family: ${({ theme }) => theme.typography.fonts.semibold};
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  padding: 8px 6px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}22;
  text-align: ${({ $align = "left" }) => $align};
`;

const Tr = styled.tr<{ $canEdit: boolean }>`
  &:hover .row-actions {
    opacity: 1;
  }

  ${({ $canEdit, theme }) =>
    $canEdit &&
    css`
      &:hover td {
        background: ${theme.colors.primarySoft};
      }
    `}
`;

const Td = styled.td<{ $align?: "left" | "right" | "center" }>`
  padding: 8px 6px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}10;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textPrimary};
  text-align: ${({ $align = "left" }) => $align};
  vertical-align: middle;
`;

const TaxChip = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.primarySoft};
  color: ${({ theme }) => theme.colors.primary};
`;

const DiscountChip = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borders.radius.rounded};
  background: ${({ theme }) => theme.colors.brand.green}18;
  color: ${({ theme }) => theme.colors.brand.green};
`;

const NoneChip = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
`;

const NetTotal = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.numbers};
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

// Row action column — fades in on hover (for canEdit), always visible for copy
const ActionsTd = styled(Td)`
  padding: 4px 4px;
  white-space: nowrap;
`;

const RowActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  opacity: 0;
  transition: opacity ${({ theme }) => theme.animations.duration.short};
`;

const IconBtn = styled.button<{ $variant?: "default" | "danger" | "accent" }>`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  transition:
    background ${({ theme }) => theme.animations.duration.short},
    color ${({ theme }) => theme.animations.duration.short},
    opacity ${({ theme }) => theme.animations.duration.short};
  padding: 0;
  flex-shrink: 0;

  color: ${({ theme, $variant }) =>
    $variant === "danger"
      ? theme.colors.error
      : $variant === "accent"
        ? theme.colors.primary
        : theme.colors.textSecondary};

  &:hover {
    background: ${({ theme, $variant }) =>
      $variant === "danger"
        ? `${theme.colors.error}18`
        : $variant === "accent"
          ? theme.colors.primarySoft
          : `${theme.colors.textSecondary}18`};
    color: ${({ theme, $variant }) =>
      $variant === "danger"
        ? theme.colors.error
        : $variant === "accent"
          ? theme.colors.primary
          : theme.colors.textPrimary};
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
    pointer-events: none;
  }
`;

const BottomBar = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;

const AddRowBtn = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 4px;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: opacity ${({ theme }) => theme.animations.duration.short};

  &:hover {
    opacity: 0.7;
  }
  &:disabled {
    display: none;
  }
`;

const PasteBtn = styled.button<{ $ready: boolean }>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 12px;
  color: ${({ theme, $ready }) =>
    $ready ? theme.colors.primary : theme.colors.textSecondary};
  background: none;
  border: none;
  cursor: ${({ $ready }) => ($ready ? "pointer" : "default")};
  padding: 8px 6px;
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: ${({ $ready }) => ($ready ? 1 : 0.35)};
  transition:
    opacity ${({ theme }) => theme.animations.duration.short},
    color ${({ theme }) => theme.animations.duration.short};
  border-radius: ${({ theme }) => theme.borders.radius.small};

  &:hover {
    opacity: ${({ $ready }) => ($ready ? 0.7 : 0.35)};
  }
`;

const CopiedToast = styled.span`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.brand.green};
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.borders.radius.small};
  background: ${({ theme }) => theme.colors.brand.green}18;
  animation: fadeOut 1.4s ease forwards;

  @keyframes fadeOut {
    0% {
      opacity: 1;
    }
    60% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LineItemsTableProps {
  items: LineItemInput[];
  currency: string;
  canEdit: boolean;
  onChange: (items: LineItemInput[]) => void;
  onEditTaxes?: (item: LineItemInput) => void;
  useDropdown?: boolean; // ← new
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CLIPBOARD_POLL_MS = 1500;

const LineItemsTableComponent: React.FC<LineItemsTableProps> = ({
  items,
  currency,
  canEdit,
  onChange,
  onEditTaxes,
  useDropdown = false,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [clipboardItem, setClipboardItem] = useState<LineItemInput | null>(
    null,
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Clipboard polling — checks for a valid majik line item in clipboard
  // Uses focus/visibilitychange for immediate refresh + interval as fallback
  // ---------------------------------------------------------------------------
  const refreshClipboard = useCallback(async () => {
    const item = await readClipboardItem();
    setClipboardItem(item);
  }, []);

  useEffect(() => {
    // Initial check
    refreshClipboard();

    // Poll at a low frequency as a fallback
    pollRef.current = setInterval(refreshClipboard, CLIPBOARD_POLL_MS);

    // Refresh immediately when window regains focus (e.g. user copied elsewhere)
    const onFocus = () => refreshClipboard();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshClipboard();
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshClipboard]);

  // ---------------------------------------------------------------------------
  // Item operations
  // ---------------------------------------------------------------------------

  const updateItem = (index: number, patch: Partial<LineItemInput>) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        description: "New line item",
        quantity: 1,
        unitPrice: 0,
        unit: "piece",
      },
    ]);
  };

  const duplicateItem = (index: number) => {
    const source = items[index];
    const duplicate: LineItemInput = {
      ...source,
      id: crypto.randomUUID(),
    };
    const next = [...items];
    next.splice(index + 1, 0, duplicate);
    onChange(next);
    toast.success("Line Item duplicated");
  };

  const copyItem = async (index: number) => {
    const encoded = encodeLineItem(items[index]);
    await navigator.clipboard.writeText(encoded);
    setCopiedIndex(index);
    // Refresh clipboard state immediately after copy
    await refreshClipboard();
    setTimeout(() => setCopiedIndex(null), 1400);
    toast.success("Line Item copied");
  };

  const pasteItem = () => {
    if (!clipboardItem) return;
    onChange([
      ...items,
      {
        ...clipboardItem,
        id: crypto.randomUUID(), // always fresh id on paste
      },
    ]);
  };

  const canPaste = clipboardItem !== null;

  return (
    <>
      <TableWrapper>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: "28%" }}>Description</Th>
              <Th style={{ width: "6%" }} $align="right">
                Qty
              </Th>
              <Th style={{ width: "6%" }}>Unit</Th>
              <Th style={{ width: "12%" }} $align="right">
                Unit price
              </Th>
              <Th style={{ width: "15%" }} $align="center">
                Tax
              </Th>
              <Th style={{ width: "9%" }} $align="center">
                Discount
              </Th>
              <Th style={{ width: "12%" }} $align="right">
                Net total
              </Th>
              <Th style={{ width: "12%" }} $align="center">
                Actions
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const c = computeLineItem(item);
              return (
                <Tr key={item.id ?? i} $canEdit={canEdit}>
                  <Td>
                    <EditableField
                      block
                      label="Description"
                      value={item.description}
                      onChange={(v) => updateItem(i, { description: v })}
                      readonly={!canEdit}
                      inputStyle={{ fontSize: "12px", width: "100%" }}
                    />
                  </Td>
                  <Td $align="right">
                    <EditableField
                      label="Qty"
                      type="number"
                      value={String(item.quantity)}
                      onChange={(v) => updateItem(i, { quantity: Number(v) })}
                      readonly={!canEdit}
                      inputStyle={{
                        fontSize: "12px",
                        width: "48px",
                        textAlign: "right",
                      }}
                    />
                  </Td>
                  <Td>
                    <EditableField
                      label="Unit"
                      value={item.unit ?? ""}
                      onChange={(v) => updateItem(i, { unit: v || undefined })}
                      readonly={!canEdit}
                      inputStyle={{ fontSize: "12px", width: "52px" }}
                    />
                  </Td>
                  <Td $align="right">
                    <EditableField
                      label="Unit Price"
                      type="number"
                      value={String(item.unitPrice)}
                      onChange={(v) => updateItem(i, { unitPrice: Number(v) })}
                      readonly={!canEdit}
                      inputStyle={{
                        fontSize: "12px",
                        width: "80px",
                        textAlign: "right",
                      }}
                    />
                  </Td>
                  <Td $align="center">
                    {item.taxes?.length ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 3,
                          justifyContent: "center",
                        }}
                      >
                        {item.taxes.map((tax, ti) => (
                          <TaxChip key={ti} title={tax.taxType}>
                            {tax.taxType} {pct(tax.rate)}
                            {tax.inclusive && " (incl.)"}
                          </TaxChip>
                        ))}
                      </div>
                    ) : canEdit && onEditTaxes ? (
                      <IconBtn
                        type="button"
                        title="Edit taxes for this item"
                        onClick={() => onEditTaxes(item)}
                      >
                        <ScalesIcon size={13} />
                      </IconBtn>
                    ) : (
                      <NoneChip>—</NoneChip>
                    )}
                  </Td>
                  <Td $align="center">
                    {item.discount ? (
                      <DiscountChip>
                        {item.discount.type === "percentage"
                          ? pct(item.discount.value)
                          : fmt(item.discount.value, currency)}
                      </DiscountChip>
                    ) : (
                      <NoneChip>—</NoneChip>
                    )}
                  </Td>
                  <Td $align="right">
                    <NetTotal>{fmt(c.postDiscount, currency)}</NetTotal>
                  </Td>

                  {/* ── Actions column ── */}
                  <ActionsTd $align="center">
                    {useDropdown ? (
                      <DropDownMenu
                        trigger={{
                          variant: "icon",
                          icon: DotsThreeIcon,
                          title: "Row actions",
                        }}
                        options={[
                          {
                            label: "Copy line item",
                            icon: CopyIcon,
                            onClick: () => copyItem(i),
                          },

                          {
                            label: "Duplicate",
                            icon: CopyPlusIcon,
                            onClick: () => duplicateItem(i),
                            hidden: !canEdit,
                          },
                          {
                            label: "Edit taxes",
                            icon: ScalesIcon,
                            onClick: () => onEditTaxes?.(item),
                            hidden: !canEdit || !onEditTaxes,
                          },
                          { type: "separator" },
                          {
                            label: "Delete",
                            icon: TrashIcon,
                            danger: true,
                            strict: true,
                            confirmTitle: "Delete this line item?",
                            confirmDescription:
                              "This will permanently remove the line item and cannot be undone.",
                            onClick: () => removeItem(i),
                          },
                        ]}
                      />
                    ) : (
                      <RowActions className="row-actions">
                        {/* Copy — always available */}
                        <IconBtn
                          $variant="default"
                          title="Copy line item to clipboard"
                          onClick={() => copyItem(i)}
                        >
                          {copiedIndex === i ? (
                            <CheckIcon size={14} />
                          ) : (
                            <CopyIcon size={14} />
                          )}
                        </IconBtn>

                        {canEdit && (
                          <IconBtn
                            $variant="accent"
                            title="Duplicate line item"
                            onClick={() => duplicateItem(i)}
                          >
                            <CopyPlusIcon size={14} />
                          </IconBtn>
                        )}

                        {canEdit && onEditTaxes && (
                          <IconBtn
                            type="button"
                            title="Edit taxes for this item"
                            onClick={() => onEditTaxes(item)}
                          >
                            <ScalesIcon size={13} />
                          </IconBtn>
                        )}

                        {canEdit && (
                          <IconBtn
                            $variant="danger"
                            title="Remove line item"
                            onClick={() => removeItem(i)}
                            disabled={items.length <= 1}
                          >
                            <TrashIcon size={14} />
                          </IconBtn>
                        )}
                      </RowActions>
                    )}
                  </ActionsTd>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrapper>

      <BottomBar>
        <AddRowBtn onClick={addItem} disabled={!canEdit}>
          <PlusIcon size={14} />
          Add line item
        </AddRowBtn>
        {canEdit && (
          <PasteBtn
            $ready={canPaste}
            onClick={pasteItem}
            disabled={!canPaste && !canEdit}
            title={
              canPaste
                ? `Paste "${clipboardItem?.description ?? "line item"}"`
                : "No copied line item in clipboard"
            }
          >
            <ClipboardIcon size={14} />
            Paste line item
          </PasteBtn>
        )}

        {copiedIndex !== null && (
          <CopiedToast key={copiedIndex}>Copied!</CopiedToast>
        )}
      </BottomBar>
    </>
  );
};

export const LineItemsTable = React.memo(LineItemsTableComponent);
