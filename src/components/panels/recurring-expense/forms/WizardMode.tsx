/**
 * WizardMode.tsx
 *
 * Step-by-step guided form for creating a recurring expense.
 *
 * API change from v1:
 *   - No longer owns a Save button or calls onSubmit directly.
 *   - Reports form data upward via onChange on every field change.
 *   - Reports validity via onValidate (true only on the final Review step).
 *   - The parent (AddRecurringExpenseModal) gates the DynamicPopUp confirm
 *     button on onValidate(true) and calls rm.save() itself.
 *
 * The "Next →" / "← Back" navigation is still internal.
 * "Advanced Mode" link is on step 0.
 */

import { RecurringExpenseItemInput } from "@/SDK/majik-buwiz-client/src/core/expenses/recurring/types";
import { RecurringExpenseItem } from "@/SDK/majik-buwiz-client/src/core/expenses/recurring/recurring-expense";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CustomFormInput } from "@/components/foundations/CustomFormInput";
import { ExpenseLineItems } from "@/components/panels/expense/ExpenseRecord/ExpenseLineItems";
import { LineItemTaxModal } from "@/components/panels/expense/modals/LineItemTaxModal";
import type { LineItemInput } from "@majikah/majik-invoice";
import styled, { keyframes } from "styled-components";
import { ExpenseCategory } from "@/SDK/majik-buwiz-client/src/core/expenses/types";
import { ModeBar, ModeBtn, ModeToggle } from "../shared/atoms";
import { ListIcon, TagIcon } from "@phosphor-icons/react";
import { useMajik } from "@/components/majik-context-wrapper/use-majik";

// ── Types ─────────────────────────────────────────────────────────────────────

// Use the actual RecurringExpenseItemInput shape for form data. UI inputs
// may still use strings for some text fields, but external wiring expects
// the RecurringExpenseItemInput shape when creating/saving items.
export type RecurringExpenseFormData = RecurringExpenseItemInput;

export const INITIAL_DATA: RecurringExpenseFormData = {
  name: "",
  description: "",
  category: "other",
  payee: { legalName: "" },
  paidBy: { legalName: "" },
  currency: "PHP",
  amount: 0,
  documentType: "other",
  schedule: {
    anchor: { frequency: "monthly", dayOfMonth: 1 },
    startDate: new Date().toISOString().slice(0, 10),
  },
  // lineItems omitted by default — single-amount mode
};

interface WizardModeProps {
  // Accept an existing RecurringExpenseItem when editing so the form
  // can apply class mutators directly. For new items, omit this prop.
  initialData?: RecurringExpenseItem;
  onChange: (data: RecurringExpenseFormData | RecurringExpenseItem) => void;
  onValidate: (valid: boolean) => void;
  onAdvancedMode: () => void;
  isEditing?: boolean;
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "basics", title: "Basics", subtitle: "Name & description", icon: "◈" },
  { id: "amount", title: "Amount", subtitle: "How much & currency", icon: "₱" },
  {
    id: "schedule",
    title: "Schedule",
    subtitle: "Frequency & dates",
    icon: "⏱",
  },
  { id: "parties", title: "Parties", subtitle: "Payee & payer", icon: "⇄" },
  {
    id: "review",
    title: "Review",
    subtitle: "Confirm before saving",
    icon: "✓",
  },
];

// ── Validation ────────────────────────────────────────────────────────────────

const validateStep = (
  step: number,
  d: RecurringExpenseFormData,
): string | null => {
  switch (step) {
    case 0:
      return d.name.trim() ? null : "Name is required.";
    case 1:
      // Support either explicit amount or itemized line items
      if (d.lineItems && d.lineItems.length > 0) {
        const total = d.lineItems.reduce(
          (s, li) => s + (li.quantity ?? 1) * (li.unitPrice ?? 0),
          0,
        );
        if (!(total > 0)) return "Enter valid positive line item amounts.";
        return null;
      }
      if (
        d.amount === undefined ||
        d.amount === null ||
        isNaN(d.amount) ||
        d.amount <= 0
      )
        return "Enter a valid positive amount.";
      return null;
    case 2:
      if (!d.schedule || !d.schedule.startDate)
        return "Start date is required.";
      if (d.schedule.endDate && d.schedule.endDate < d.schedule.startDate)
        return "End date must be after start date.";
      return null;
    default:
      return null;
  }
};

// ── Styled ────────────────────────────────────────────────────────────────────

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const StepsTrack = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0;
  overflow-x: auto;
  padding-bottom: 2px;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const StepItem = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    top: 11px;
    left: 50%;
    width: 100%;
    height: 1px;
    background: ${({ theme }) => theme.colors.primary}22;
    z-index: 0;
  }
  &:last-child::after {
    display: none;
  }
`;

const DotCircle = styled.div<{ $state: "done" | "active" | "upcoming" }>`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  z-index: 1;
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  transition: all 0.2s;

  border: 2px solid
    ${({ $state, theme }) =>
      $state !== "upcoming"
        ? theme.colors.primary
        : theme.colors.primary + "33"};
  background: ${({ $state, theme }) =>
    $state === "done"
      ? theme.colors.primary
      : $state === "active"
        ? theme.colors.primarySoft
        : "transparent"};
  color: ${({ $state, theme }) =>
    $state === "done"
      ? (theme.colors.static?.white ?? "#fff")
      : $state === "active"
        ? theme.colors.primary
        : theme.colors.textSecondary};
`;

const DotLabel = styled.span<{ $active?: boolean }>`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 9px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  opacity: ${({ $active }) => ($active ? 1 : 0.55)};
  white-space: nowrap;
  transition: color 0.2s;
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(10px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const StepContent = styled.div`
  animation: ${slideIn} 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const StepTitle = styled.h3`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.semibold ?? "sans-serif"};
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const StepSub = styled.p`
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.7;
`;

const FieldGrid = styled.div<{ $cols?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $cols = 1 }) => $cols}, 1fr);
  gap: 12px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const FieldLabel = styled.label`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.semibold ?? "sans-serif"};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.primary};
`;

const HelpText = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.65;
`;

const ErrorText = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.error};
`;

const NavRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
`;

const AdvancedLink = styled.button`
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  opacity: 0.7;
  transition: opacity 0.15s;
  &:hover {
    opacity: 1;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const GhostBtn = styled.button`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 12px;
  padding: 7px 14px;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  border: 1px solid ${({ theme }) => theme.colors.primary}33;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const PrimaryBtn = styled.button`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 12px;
  padding: 7px 16px;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  background: ${({ theme }) =>
    theme.gradients?.primary ?? theme.colors.primary};
  border: 1px solid transparent;
  color: ${({ theme }) => theme.colors.static?.white ?? "#fff"};
  cursor: pointer;
  transition: filter 0.15s;
  &:hover {
    filter: brightness(1.08);
  }
`;

// Review styled
const ReviewSection = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}12;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  padding: 12px 14px;
`;

const ReviewSectionTitle = styled.div`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.semibold ?? "sans-serif"};
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.6;
  margin-bottom: 8px;
  padding-bottom: 7px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}10;
`;

const ReviewRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  font-size: 12px;
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ReviewValue = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-weight: 600;
  text-align: right;
`;

const AmountPreview = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.numbers ?? "monospace"};
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtAmount = (amount: number | string | undefined, currency: string) => {
  const n =
    typeof amount === "number" ? amount : parseFloat(String(amount ?? ""));
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(
    n,
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const mapItemToFormData = (
  item: RecurringExpenseItem,
): Partial<RecurringExpenseFormData> => ({
  id: item.id,
  name: item.name,
  description: item.description ?? "",
  amount: item.amount,
  currency: item.currency ?? "PHP",
  documentType: item.documentType,
  schedule: {
    anchor: { ...(item.schedule?.anchor as any) },
    startDate:
      item.schedule?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: item.schedule?.endDate,
  },
  category: item.category ?? "other",
  payee: item.payee ?? { legalName: "" },
  paidBy: item.paidBy ?? { legalName: "" },
  tags: item.tags ?? [],
  bir: item.bir,
  lineItems: item.lineItems ? [...item.lineItems] : undefined,
});

export const WizardMode: React.FC<WizardModeProps> = ({
  initialData,
  onChange,
  onValidate,
  onAdvancedMode,
  isEditing,
}) => {
  const { majik } = useMajik();
  const itemRef = React.useRef<RecurringExpenseItem | undefined>(initialData);

  const currentAccount = useMemo(() => {
    return majik.getActiveAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik]);

  const [data, setData] = useState<RecurringExpenseFormData>({
    ...INITIAL_DATA,
    ...(initialData ? mapItemToFormData(initialData) : {}),
    paidBy: {
      ...currentAccount?.meta,
      legalName: currentAccount?.meta?.legalName ?? "",
    },
  });
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [useLineItems, setUseLineItems] = useState<boolean>(
    Boolean(
      initialData && initialData.lineItems && initialData.lineItems.length > 0,
    ),
  );
  const [singleTaxModalOpen, setSingleTaxModalOpen] = useState(false);
  const [singleLineItem, setSingleLineItem] = useState<LineItemInput | null>(
    null,
  );

  // Propagate upward on every change. When editing, prefer sending the
  // mutated `RecurringExpenseItem` instance; otherwise send the draft data.
  useEffect(() => {
    if (itemRef.current) onChange(itemRef.current);
    else onChange(data);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only valid once the user reaches the Review step
  useEffect(() => {
    onValidate(step === STEPS.length - 1);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Field handlers — map UI inputs into the RecurringExpenseItemInput shape
  const handleNameChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newData = { ...data, name: v };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withName(v);
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const handleDescriptionChange = (
    eOrVal: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newData = { ...data, description: v };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withDescription(v);
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const handleAmountChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const raw = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const v = parseFloat(String(raw));
    const amt = isNaN(v) ? 0 : v;
    const newData = { ...data, amount: amt };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withAmount(amt);
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const handleCurrencyChange = (
    eOrVal: React.ChangeEvent<HTMLSelectElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newData: RecurringExpenseItemInput = { ...data, currency: v };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withCurrency(v as any);
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const handleFrequencyChange = (
    eOrVal: React.ChangeEvent<HTMLSelectElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newSchedule = {
      ...data.schedule,
      anchor: { ...(data.schedule.anchor as any), frequency: v } as any,
    };
    const newData = { ...data, schedule: newSchedule };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withSchedule(newSchedule as any);
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const handleCategoryChange = (
    eOrVal: React.ChangeEvent<HTMLSelectElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newData: RecurringExpenseItemInput = {
      ...data,
      category: v as ExpenseCategory,
    };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withCategory(v as ExpenseCategory);
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const handleStartDateChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newSchedule = { ...data.schedule, startDate: v };
    const newData = { ...data, schedule: newSchedule };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withSchedule(newSchedule as any);
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const handleEndDateChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newSchedule = { ...data.schedule, endDate: v || undefined };
    const newData = { ...data, schedule: newSchedule };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        if (v) itemRef.current = itemRef.current.withEndDate(v);
        else itemRef.current = itemRef.current.withoutEndDate();
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const handlePayeeChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newData = {
      ...data,
      payee: { ...(data.payee ?? {}), legalName: v } as any,
    };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withPayee({
          ...(itemRef.current.payee ?? {}),
          legalName: v,
        } as any);
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const handlePaidByChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newData = {
      ...data,
      paidBy: { ...(data.paidBy ?? {}), legalName: v } as any,
    };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withPaidBy({
          ...(itemRef.current.paidBy ?? {}),
          legalName: v,
        } as any);
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const handleTagsChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const arr = v
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const newData = { ...data, tags: arr };
    setData(newData);
    setError(null);

    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withTags(arr as any);
        onChange(itemRef.current);
      } catch {
        onChange(newData);
      }
    } else {
      onChange(newData);
    }
  };

  const next = () => {
    const err = validateStep(step, data);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const stepState = (i: number): "done" | "active" | "upcoming" =>
    i < step ? "done" : i === step ? "active" : "upcoming";

  const handleSwitchToSingleItem = useCallback(async () => {
    // switch to single-amount mode
    if (useLineItems && data.lineItems && data.lineItems.length > 0) {
      const total = data.lineItems.reduce(
        (s, li) => s + (li.quantity ?? 1) * (li.unitPrice ?? 0),
        0,
      );
      const newData = {
        ...data,
        amount: total,
        lineItems: undefined,
      };
      setData(newData);
      setUseLineItems(false);
      setError(null);
      if (itemRef.current) {
        try {
          itemRef.current = itemRef.current.withoutLineItems();
          onChange(itemRef.current);
        } catch {
          onChange(newData);
        }
      } else {
        onChange(newData);
      }
    } else {
      setUseLineItems(false);
    }
  }, [useLineItems, data]);

  const handleSwitchToLineItems = useCallback(async () => {
    if (!useLineItems) {
      // initialize with a single synthetic line item if none
      if (!data.lineItems || data.lineItems.length === 0) {
        const li: LineItemInput = {
          id: (crypto as any).randomUUID(),
          description: data.name || "Line item",
          quantity: 1,
          unitPrice: data.amount ?? 0,
          taxes: [],
        } as any;
        const newData = { ...data, lineItems: [li] };
        setData(newData);
        if (itemRef.current) {
          try {
            itemRef.current = itemRef.current.withLineItems([li]);
            onChange(itemRef.current);
          } catch {
            onChange(newData);
          }
        } else {
          onChange(newData);
        }
      }
      setUseLineItems(true);
    }
  }, [useLineItems, data]);

  return (
    <Root>
      {/* Step tracker */}
      <StepsTrack>
        {STEPS.map((s, i) => (
          <StepItem key={s.id}>
            <DotCircle $state={stepState(i)}>
              {i < step ? "✓" : i + 1}
            </DotCircle>
            <DotLabel $active={i === step}>{s.title}</DotLabel>
          </StepItem>
        ))}
      </StepsTrack>

      {/* Content */}
      <StepContent key={step}>
        <div>
          <StepTitle>
            {STEPS[step].icon} {STEPS[step].title}
          </StepTitle>
          <StepSub>{STEPS[step].subtitle}</StepSub>
        </div>

        {/* ── Step 0: Basics ── */}
        {step === 0 && (
          <FieldGrid>
            <FormGroup>
              <CustomFormInput
                label="Name *"
                value={data.name}
                onChange={(v) => handleNameChange(v as string)}
                placeholder="e.g. Office Rent, Salary, Utilities"
                autoFocus
                required
              />
            </FormGroup>
            <FormGroup>
              <CustomFormInput
                label="Description"
                value={data.description ?? ""}
                onChange={(v) => handleDescriptionChange(v as string)}
                placeholder="Optional notes"
                type="paragraph"
              />
            </FormGroup>
          </FieldGrid>
        )}

        {/* ── Step 1: Amount ── */}
        {step === 1 && (
          <FieldGrid $cols={2}>
            <FormGroup style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <FieldLabel>Amount *</FieldLabel>
                  <HelpText>
                    Use a single amount or itemize with line items
                  </HelpText>
                </div>

                {/* Mode switcher */}
                <ModeBar>
                  <ModeToggle>
                    <ModeBtn
                      $active={!useLineItems}
                      onClick={handleSwitchToSingleItem}
                    >
                      <TagIcon size={13} /> Single Item
                    </ModeBtn>
                    <ModeBtn
                      $active={useLineItems}
                      onClick={handleSwitchToLineItems}
                    >
                      <ListIcon size={13} /> Itemize with Line Items
                    </ModeBtn>
                  </ModeToggle>
                </ModeBar>
              </div>
            </FormGroup>

            {!useLineItems ? (
              <>
                <FormGroup style={{ gridColumn: "1 / -1" }}>
                  <CustomFormInput
                    label="Amount *"
                    value={String(data.amount ?? "")}
                    onChange={(v) => handleAmountChange(String(v))}
                    placeholder="0.00"
                    type="number"
                    required
                    autoFocus
                  />
                  {data.amount && data.amount > 0 && (
                    <HelpText>
                      {fmtAmount(data.amount, data.currency)} {data.currency}
                    </HelpText>
                  )}
                </FormGroup>
                <FormGroup>
                  <CustomFormInput
                    label="Currency"
                    value={data.currency}
                    onChange={(v) => handleCurrencyChange(String(v))}
                    options={[
                      { value: "PHP", label: "PHP — Philippine Peso" },
                      { value: "USD", label: "USD — US Dollar" },
                      { value: "EUR", label: "EUR — Euro" },
                      { value: "SGD", label: "SGD — Singapore Dollar" },
                      { value: "JPY", label: "JPY — Japanese Yen" },
                      { value: "GBP", label: "GBP — British Pound" },
                    ]}
                  />
                  <div style={{ marginTop: 8 }}>
                    <GhostBtn
                      type="button"
                      onClick={() => {
                        setSingleLineItem({
                          id: (crypto as any).randomUUID(),
                          description: data.name || "Line item",
                          quantity: 1,
                          unitPrice: data.amount ?? 0,
                          taxes: [],
                        } as any);
                        setSingleTaxModalOpen(true);
                      }}
                    >
                      Edit Taxes
                    </GhostBtn>
                  </div>
                </FormGroup>
              </>
            ) : (
              <FormGroup style={{ gridColumn: "1 / -1" }}>
                <ExpenseLineItems
                  items={data.lineItems ?? []}
                  currency={data.currency}
                  canEdit={true}
                  onChange={(items) => {
                    const newData = {
                      ...data,
                      lineItems: items,
                    } as RecurringExpenseFormData;
                    setData(newData);
                    setError(null);
                    if (itemRef.current) {
                      try {
                        itemRef.current = itemRef.current.withLineItems(items);
                        onChange(itemRef.current);
                      } catch {
                        onChange(newData);
                      }
                    } else {
                      onChange(newData);
                    }
                  }}
                />
              </FormGroup>
            )}

            {singleTaxModalOpen && singleLineItem && (
              <LineItemTaxModal
                open
                onOpenChange={(open) => {
                  if (!open) {
                    setSingleTaxModalOpen(false);
                    setSingleLineItem(null);
                  }
                }}
                lineItem={singleLineItem}
                currency={data.currency}
                onSave={(updated) => {
                  const items = [updated];
                  const newData = {
                    ...data,
                    lineItems: items,
                  } as RecurringExpenseFormData;
                  setData(newData);
                  if (itemRef.current) {
                    try {
                      itemRef.current = itemRef.current.withLineItems(items);
                      onChange(itemRef.current);
                    } catch {
                      onChange(newData);
                    }
                  } else {
                    onChange(newData);
                  }
                  setSingleTaxModalOpen(false);
                  setSingleLineItem(null);
                  setUseLineItems(true);
                }}
              />
            )}
          </FieldGrid>
        )}

        {/* ── Step 2: Schedule ── */}
        {step === 2 && (
          <FieldGrid>
            <FieldGrid $cols={2}>
              <FormGroup>
                <CustomFormInput
                  label="Frequency *"
                  value={(data.schedule.anchor as any).frequency}
                  onChange={(v) => handleFrequencyChange(String(v))}
                  options={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                    { value: "quarterly", label: "Quarterly" },
                    { value: "semi-annual", label: "Semi-annual" },
                    { value: "annual", label: "Annual" },
                  ]}
                />
              </FormGroup>
              <FormGroup>
                <CustomFormInput
                  label="Category"
                  value={data.category}
                  onChange={(v) => handleCategoryChange(String(v))}
                  options={[
                    { value: "other", label: "Other" },
                    { value: "cost-of-sales", label: "Cost of Sales" },
                    { value: "compensation", label: "Compensation" },
                    { value: "rent", label: "Rent" },
                    { value: "professional-fees", label: "Professional Fees" },
                    { value: "utilities", label: "Utilities" },
                    { value: "depreciation", label: "Depreciation" },
                    { value: "interest", label: "Interest" },
                    { value: "taxes-and-licenses", label: "Taxes & Licenses" },
                    { value: "representation", label: "Representation" },
                    { value: "transportation", label: "Transportation" },
                    { value: "communication", label: "Communication" },
                    { value: "insurance", label: "Insurance" },
                    { value: "supplies", label: "Supplies" },
                    { value: "bad-debts", label: "Bad Debts" },
                    { value: "charitable-contributions", label: "Charitable" },
                  ]}
                />
              </FormGroup>
            </FieldGrid>
            <FieldGrid $cols={2}>
              <FormGroup>
                <CustomFormInput
                  label="Start Date *"
                  type="date"
                  value={data.schedule?.startDate ?? ""}
                  onChange={(v) => handleStartDateChange(String(v))}
                />
              </FormGroup>
              <FormGroup>
                <CustomFormInput
                  label="End Date"
                  type="date"
                  value={data.schedule?.endDate ?? ""}
                  onChange={(v) => handleEndDateChange(String(v))}
                />
                <HelpText>Leave blank for ongoing</HelpText>
              </FormGroup>
            </FieldGrid>
          </FieldGrid>
        )}

        {/* ── Step 3: Parties ── */}
        {step === 3 && (
          <FieldGrid $cols={2}>
            <FormGroup>
              <CustomFormInput
                label="Payee"
                value={(data.payee && (data.payee as any).legalName) ?? ""}
                onChange={(v) => handlePayeeChange(String(v))}
                placeholder="e.g. Amazon Web Services"
                autoFocus
              />
              <HelpText>Who receives payment</HelpText>
            </FormGroup>
            <FormGroup>
              <CustomFormInput
                label="Paid By"
                value={(data.paidBy && (data.paidBy as any).legalName) ?? ""}
                onChange={(v) => handlePaidByChange(String(v))}
                placeholder="e.g. Acme Corp"
              />
              <HelpText>Who makes payment</HelpText>
            </FormGroup>
            <FormGroup style={{ gridColumn: "1 / -1" }}>
              <CustomFormInput
                label="Tags"
                value={(data.tags ?? []).join(", ")}
                onChange={(v) => handleTagsChange(String(v))}
                placeholder="opex, cloud, infrastructure (comma-separated)"
              />
            </FormGroup>
          </FieldGrid>
        )}

        {/* ── Step 4: Review ── */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ReviewSection>
              <ReviewSectionTitle>Basics</ReviewSectionTitle>
              <ReviewRow>
                <span>Name</span>
                <ReviewValue>{data.name}</ReviewValue>
              </ReviewRow>
              {data.description && (
                <ReviewRow>
                  <span>Description</span>
                  <ReviewValue style={{ maxWidth: 200, textAlign: "right" }}>
                    {data.description}
                  </ReviewValue>
                </ReviewRow>
              )}
            </ReviewSection>

            <ReviewSection>
              <ReviewSectionTitle>Amount & Schedule</ReviewSectionTitle>
              <ReviewRow>
                <span>Amount</span>
                <AmountPreview>
                  {fmtAmount(data.amount, data.currency)}
                </AmountPreview>
              </ReviewRow>
              <ReviewRow>
                <span>Frequency</span>
                <ReviewValue style={{ textTransform: "capitalize" }}>
                  {(data.schedule?.anchor as any).frequency}
                </ReviewValue>
              </ReviewRow>
              <ReviewRow>
                <span>Category</span>
                <ReviewValue style={{ textTransform: "capitalize" }}>
                  {data.category.replace(/-/g, " ")}
                </ReviewValue>
              </ReviewRow>
              <ReviewRow>
                <span>Start Date</span>
                <ReviewValue>{data.schedule?.startDate}</ReviewValue>
              </ReviewRow>
              <ReviewRow>
                <span>End Date</span>
                <ReviewValue>{data.schedule?.endDate || "Ongoing"}</ReviewValue>
              </ReviewRow>
            </ReviewSection>

            {((data.payee as any)?.legalName ||
              (data.paidBy as any)?.legalName) && (
              <ReviewSection>
                <ReviewSectionTitle>Parties</ReviewSectionTitle>
                {(data.payee as any)?.legalName && (
                  <ReviewRow>
                    <span>Payee</span>
                    <ReviewValue>{(data.payee as any).legalName}</ReviewValue>
                  </ReviewRow>
                )}
                {(data.paidBy as any)?.legalName && (
                  <ReviewRow>
                    <span>Paid By</span>
                    <ReviewValue>{(data.paidBy as any).legalName}</ReviewValue>
                  </ReviewRow>
                )}
              </ReviewSection>
            )}
          </div>
        )}
      </StepContent>

      {error && <ErrorText>⚠ {error}</ErrorText>}

      {/* Navigation */}
      <NavRow>
        <div>
          {step === 0 && (
            <AdvancedLink onClick={onAdvancedMode}>
              Switch to Advanced Mode →
            </AdvancedLink>
          )}
          {step > 0 && <GhostBtn onClick={back}>← Back</GhostBtn>}
        </div>
        {step < STEPS.length - 1 && (
          <PrimaryBtn onClick={next}>Next →</PrimaryBtn>
        )}
        {step === STEPS.length - 1 && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "inherit",
              color: "var(--color-text-secondary, #888)",
              opacity: 0.7,
            }}
          >
            Click "{isEditing ? "Save Changes" : "Create Expense"}" above to
            confirm
          </span>
        )}
      </NavRow>
    </Root>
  );
};
