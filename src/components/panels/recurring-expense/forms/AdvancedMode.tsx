/**
 * AdvancedMode.tsx
 *
 * Full field-by-field form for power users.
 *
 * API change from v1:
 *   - No longer owns a Save button or calls onSubmit directly.
 *   - Reports form data upward via onChange on every field change.
 *   - Reports validity immediately via onValidate.
 *   - The parent (AddRecurringExpenseModal) owns the confirm action.
 */

import React, { useEffect, useState } from "react";
import { CustomFormInput } from "@/components/foundations/CustomFormInput";
import styled from "styled-components";
import type { RecurringExpenseFormData } from "./WizardMode";
import { INITIAL_DATA } from "./WizardMode";
import { ExpenseLineItems } from "@/components/panels/expense/ExpenseRecord/ExpenseLineItems";
import type { LineItemInput } from "@majikah/majik-invoice";
import { RecurringExpenseItem } from "@/SDK/majik-buwiz-client/src/core/expenses/recurring/recurring-expense";
import {
  BIRContext,
  ExpenseCategory,
} from "@/SDK/majik-buwiz-client/src/core/expenses/types";
import { RecurringExpenseItemInput } from "@/SDK/majik-buwiz-client/src/core/expenses/recurring/types";

const EWT_PRESETS: {
  label: string;
  value: string;
}[] = [
  {
    label: "WC158 | Professional fees — individuals (5%)",
    value: "WC158",
  },
  {
    label: "WC157 | Professional fees — corporations (10%)",
    value: "WC157",
  },
  { label: "WC010 | Rental — corporations (2%)", value: "WC010" },
  { label: "WI010 | Rental — individuals (5%)", value: "WI010" },
  { label: "WC001 | Goods — corporations (1%)", value: "WC001" },
  { label: "WI001 | Services — individuals (2%)", value: "WI001" },
];

interface AdvancedModeProps {
  initialData?: RecurringExpenseItem;
  onChange: (data: RecurringExpenseFormData | RecurringExpenseItem) => void;
  onValidate: (valid: boolean) => void;
  onWizardMode: () => void;
  isEditing?: boolean;
}

// ── Validation ────────────────────────────────────────────────────────────────

const validate = (d: RecurringExpenseFormData): boolean => {
  if (!d.name?.trim()) return false;
  // Accept either line items or a single amount
  if (d.lineItems && d.lineItems.length > 0) {
    const total = d.lineItems.reduce(
      (s, li) => s + (li.quantity ?? 1) * (li.unitPrice ?? 0),
      0,
    );
    if (!(total > 0)) return false;
  } else {
    if (typeof d.amount !== "number" || isNaN(d.amount) || d.amount <= 0)
      return false;
  }
  if (!d.schedule || !d.schedule.startDate) return false;
  if (d.schedule.endDate && d.schedule.endDate < d.schedule.startDate)
    return false;
  return true;
};

// ── Styled ────────────────────────────────────────────────────────────────────

const FormRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitle = styled.div`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.semibold ?? "sans-serif"};
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  padding-bottom: 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}15;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Grid = styled.div<{ $cols?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $cols = 2 }) => $cols}, 1fr);
  gap: 12px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const HelpText = styled.span`
  font-family: ${({ theme }) => theme.typography?.fonts?.light ?? "sans-serif"};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.65;
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.primary}10;
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 10px 12px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primary}15;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  transition: border-color 0.15s;
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary}33;
  }
`;

const ToggleCheck = styled.input`
  width: 14px;
  height: 14px;
  accent-color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
`;

const ToggleLabel = styled.span`
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
`;

const BIRBox = styled.div<{ $visible: boolean }>`
  display: ${({ $visible }) => ($visible ? "block" : "none")};
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.primary}15;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  padding: 14px;
`;

const WizardLink = styled.button`
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

// ── Component ─────────────────────────────────────────────────────────────────

export const AdvancedMode: React.FC<AdvancedModeProps> = ({
  initialData,
  onChange,
  onValidate,
  onWizardMode,
}) => {
  const itemRef = React.useRef<RecurringExpenseItem | undefined>(initialData);

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

  const [data, setData] = useState<RecurringExpenseFormData>({
    ...INITIAL_DATA,
    ...(initialData ? mapItemToFormData(initialData) : {}),
  });
  const [useLineItems, setUseLineItems] = useState<boolean>(
    Boolean(
      initialData && initialData.lineItems && initialData.lineItems.length > 0,
    ),
  );

  // Propagate upward on every change
  useEffect(() => {
    if (itemRef.current) onChange(itemRef.current);
    else onChange(data);
    onValidate(validate(data));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNameChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newData = { ...data, name: v };
    setData(newData);
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
    eOrVal: React.ChangeEvent<HTMLTextAreaElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newData = { ...data, description: v };
    setData(newData);
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

  const handleAmountChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const raw = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const v = parseFloat(String(raw));
    const amt = isNaN(v) ? 0 : v;
    const newData = { ...data, amount: amt };
    setData(newData);
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
    const newData = { ...data, currency: v };
    setData(newData);
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

  const handleStartDateChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newSchedule = { ...data.schedule, startDate: v };
    const newData = { ...data, schedule: newSchedule };
    setData(newData);
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

  const handleBirToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newBIR: BIRContext = {
        ...(data.bir ?? {}),

        withholdingAtcCode: "",
        inputVatRate: undefined,
      };
      const newData = { ...data, bir: newBIR };
      setData(newData);
      if (itemRef.current) {
        try {
          itemRef.current = itemRef.current.withBIR(newBIR);
          onChange(itemRef.current);
        } catch {
          onChange(newData);
        }
      } else {
        onChange(newData);
      }
    } else {
      const newData = { ...data, bir: undefined };
      setData(newData);
      if (itemRef.current) {
        try {
          itemRef.current = itemRef.current.withoutBIR();
          onChange(itemRef.current);
        } catch {
          onChange(newData);
        }
      } else {
        onChange(newData);
      }
    }
  };

  const handleBirDescriptionChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newBIR = { ...(data.bir ?? {}), description: v } as any;
    const newData = { ...data, bir: newBIR };
    setData(newData);
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

  const handleBirAtcCodeChange = (
    eOrVal: React.ChangeEvent<HTMLInputElement> | string,
  ) => {
    const v = typeof eOrVal === "string" ? eOrVal : eOrVal.target.value;
    const newBIR = { ...(data.bir ?? {}), atcCode: v } as any;
    const newData = { ...data, bir: newBIR };
    setData(newData);
    if (itemRef.current) {
      try {
        itemRef.current = itemRef.current.withBIRPatch({
          withholdingAtcCode: v,
        });
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

  return (
    <FormRoot>
      {/* ── Core ── */}
      <Section>
        <SectionTitle>Core</SectionTitle>
        <FormGroup>
          <CustomFormInput
            label="Name *"
            value={data.name}
            onChange={(v) => handleNameChange(v as string)}
            placeholder="e.g. Office Rent, AWS Subscription"
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
        <FormGroup>
          <CustomFormInput
            label="Tags"
            value={(data.tags ?? []).join(", ")}
            onChange={(v) => handleTagsChange(v as string)}
            placeholder="opex, cloud, infrastructure (comma-separated)"
          />
        </FormGroup>
      </Section>

      <Divider />

      {/* ── Amount ── */}
      <Section>
        <SectionTitle>Amount</SectionTitle>
        <ToggleRow>
          <ToggleCheck
            type="checkbox"
            checked={useLineItems}
            onChange={(e) => {
              const checked = e.target.checked;
              setUseLineItems(checked);
              if (checked) {
                // initialize a single synthetic line item if none
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
              } else {
                // convert back to single amount preserving total
                if (data.lineItems && data.lineItems.length > 0) {
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
                }
              }
            }}
          />
          <ToggleLabel>Itemize using line items</ToggleLabel>
        </ToggleRow>

        {useLineItems ? (
          <div>
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
          </div>
        ) : (
          <Grid $cols={2}>
            <FormGroup>
              <CustomFormInput
                label="Amount *"
                value={String(data.amount ?? "")}
                onChange={(v) => handleAmountChange(String(v))}
                placeholder="0.00"
                type="number"
                required
              />
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
            </FormGroup>
          </Grid>
        )}
      </Section>

      <Divider />

      {/* ── Schedule ── */}
      <Section>
        <SectionTitle>Schedule</SectionTitle>
        <Grid $cols={2}>
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
        </Grid>
      </Section>

      <Divider />

      {/* ── Parties ── */}
      <Section>
        <SectionTitle>Parties</SectionTitle>
        <Grid $cols={2}>
          <FormGroup>
            <CustomFormInput
              label="Payee Legal Name"
              value={(data.payee && (data.payee as any).legalName) ?? ""}
              onChange={(v) => handlePayeeChange(String(v))}
              placeholder="e.g. Amazon Web Services"
            />
            <HelpText>Who receives payment</HelpText>
          </FormGroup>
          <FormGroup>
            <CustomFormInput
              label="Paid By Legal Name"
              value={(data.paidBy && (data.paidBy as any).legalName) ?? ""}
              onChange={(v) => handlePaidByChange(String(v))}
              placeholder="e.g. Acme Corp"
            />
            <HelpText>Who makes payment</HelpText>
          </FormGroup>
        </Grid>
      </Section>

      <Divider />

      {/* ── BIR / Tax ── */}
      <Section>
        <SectionTitle>
          BIR / Tax
          <span
            style={{
              fontSize: 9,
              opacity: 0.55,
              letterSpacing: "0.04em",
              textTransform: "none",
              fontWeight: 400,
            }}
          >
            Bureau of Internal Revenue (PH)
          </span>
        </SectionTitle>
        <ToggleRow>
          <ToggleCheck
            type="checkbox"
            checked={!!data.bir}
            onChange={handleBirToggle}
          />
          <ToggleLabel>Enable BIR fields</ToggleLabel>
        </ToggleRow>
        <BIRBox $visible={!!data.bir}>
          <Grid $cols={2}>
            <FormGroup>
              <CustomFormInput
                label="BIR Description"
                value={(data.bir && (data.bir as any).description) ?? ""}
                onChange={(v) => handleBirDescriptionChange(String(v))}
                placeholder="e.g. Professional fees"
              />
            </FormGroup>
            <FormGroup>
              <CustomFormInput
                label="ATC Code"
                value={(data.bir && (data.bir as any).atcCode) ?? ""}
                onChange={(v) => handleBirAtcCodeChange(String(v))}
                placeholder="e.g. WC010"
                options={EWT_PRESETS}
              />
            </FormGroup>
          </Grid>
        </BIRBox>
      </Section>

      {/* Wizard link */}
      <div>
        <WizardLink onClick={onWizardMode}>← Switch to Wizard Mode</WizardLink>
      </div>
    </FormRoot>
  );
};
