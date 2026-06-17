import React, { JSX, useState } from "react";
import styled, { css } from "styled-components";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  CaretDownIcon,
  CaretRightIcon,
  type Icon,
} from "@phosphor-icons/react";

import StyledIconButton from "./StyledIconButton";
import { ChoiceButton } from "../../globals/buttons";
import DuoButton from "./DuoButton";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@src/globals/styled-dialogs";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * A single dropdown row. Recursive via `items` so any entry can host
 * its own submenu, which itself can host further submenus, etc.
 */
export interface DropDownMenuItem {
  /** Reserved discriminant. Omit for a normal row. */
  type?: "item" | "separator";
  label?: string;
  onClick?: () => void;
  icon?: Icon;
  /** Renders a confirm step before firing onClick. Defaults to false. */
  strict?: boolean;
  /** Copy shown in the confirm dialog when strict is true. */
  confirmTitle?: string;
  confirmDescription?: string;
  disabled?: boolean;
  /** Visually flags the row as a destructive/dangerous action. */
  danger?: boolean;
  /** Nested rows. Presence of a non-empty array makes this a submenu trigger. */
  items?: DropDownMenuItem[];

  hidden?: boolean;
}

type TriggerVariant = "icon" | "icon-button" | "pressable" | "custom";

interface BaseTriggerProps {
  variant?: TriggerVariant;
  disabled?: boolean;
}

interface IconTriggerProps extends BaseTriggerProps {
  variant: "icon";
  icon: Icon;
  iconSize?: number;
  title?: string;
}

interface IconButtonTriggerProps extends BaseTriggerProps {
  variant: "icon-button";
  icon: Icon;
  label: string;
}

interface PressableTriggerProps extends BaseTriggerProps {
  variant: "pressable";
  value?: string | null;
  placeholder?: string;
  icon?: Icon;
}

interface CustomTriggerProps extends BaseTriggerProps {
  variant: "custom";
  children: React.ReactNode;
}

export type DropDownMenuTriggerProps =
  | IconTriggerProps
  | IconButtonTriggerProps
  | PressableTriggerProps
  | CustomTriggerProps;

interface DropDownMenuProps {
  id?: string;
  options: DropDownMenuItem[];
  trigger: DropDownMenuTriggerProps;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  contentWidth?: number;
}

/* ------------------------------------------------------------------ */
/*  Styled primitives                                                  */
/* ------------------------------------------------------------------ */

const StyledContent = styled(DropdownMenu.Content)<{ $width?: number }>`
  min-width: ${({ $width }) => $width ?? 200}px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  border-radius: 10px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: ${({ theme }) => theme.zIndex.topmost};

  animation: contentShow 120ms ease-out;

  @keyframes contentShow {
    from {
      opacity: 0;
      transform: translateY(-2px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const StyledSubContent = styled(StyledContent)``;

const rowBase = css<{ $danger?: boolean; $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme, $danger }) =>
    $danger ? theme.colors.error : theme.colors.textPrimary};
  cursor: pointer;
  outline: none;
  user-select: none;
  transition: background 100ms ease;

  &[data-highlighted],
  &[data-state="open"] {
    background: ${({ theme, $danger }) =>
      $danger ? "rgba(239, 68, 68, 0.12)" : theme.colors.primaryBackground};
  }

  ${({ $disabled }) =>
    $disabled &&
    css`
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    `}
`;

const StyledItem = styled(DropdownMenu.Item)<{
  $danger?: boolean;
  $disabled?: boolean;
}>`
  ${rowBase}
`;

const StyledSubTrigger = styled(DropdownMenu.SubTrigger)<{
  $danger?: boolean;
  $disabled?: boolean;
}>`
  ${rowBase}
  justify-content: space-between;
`;

const RowLabel = styled.span`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledSeparator = styled(DropdownMenu.Separator)`
  height: 1px;
  background: ${({ theme }) => theme.colors.primaryBackground};
  margin: 4px 2px;
`;

/* Triggers */

const IconTriggerButton = styled(StyledIconButton)``;

const IconButtonTriggerEl = styled(ChoiceButton)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 100px;
  width: inherit;
`;

const PressableTriggerEl = styled.button<{ $hasValue: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 9px;
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme, $hasValue }) =>
    $hasValue ? theme.colors.textPrimary : theme.colors.textSecondary};
  cursor: pointer;
  transition: all 120ms ease;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryBackground};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  &[data-state="open"] {
    border-color: ${({ theme }) =>
      theme.colors.accent ?? theme.colors.textSecondary};
  }
`;

const PressableValue = styled.span`
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ChevronWrap = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: transform 150ms ease;

  [data-state="open"] & {
    transform: rotate(180deg);
  }
`;

/* Confirm dialog (inline, styled to match — not reusing ConfirmationButton) */

const ConfirmModalBody = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0;
  gap: 10px;
`;

/* ------------------------------------------------------------------ */
/*  Confirm sub-component                                              */
/* ------------------------------------------------------------------ */

interface InlineConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: () => void;
}

const InlineConfirmDialog: React.FC<InlineConfirmProps> = ({
  open,
  onOpenChange,
  title = "Confirm Action",
  description = "Are you sure you want to proceed with this action? This cannot be undone.",
  onConfirm,
}) => {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <DialogOverlay $zOffset={9999999999999}>
          <DialogContent $zOffset={9999999999}>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <ConfirmModalBody />

            <DuoButton
              textButtonA="Cancel"
              textButtonB="Confirm"
              onClickButtonA={() => onOpenChange(false)}
              onClickButtonB={() => {
                onConfirm();
                onOpenChange(false);
              }}
            />
          </DialogContent>
        </DialogOverlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

/* ------------------------------------------------------------------ */
/*  Row renderer (recursive)                                           */
/* ------------------------------------------------------------------ */

interface RenderRowProps {
  item: DropDownMenuItem;
  index: number;
}

const RenderRow: React.FC<RenderRowProps> = ({ item, index }) => {
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  if (item.type === "separator") {
    return <StyledSeparator key={`sep-${index}`} />;
  }

  const IconComp = item.icon;
  const hasChildren = !!item.items && item.items.length > 0;

  const handleSelect = (e: Event): void => {
    if (item.strict) {
      // Prevent the menu from closing on this select so the confirm
      // dialog can take over; we close everything manually after.
      e.preventDefault();
      setConfirmOpen(true);
      return;
    }
    item.onClick?.();
  };

  if (item.hidden) {
    return null;
  }

  if (hasChildren) {
    return (
      <DropdownMenu.Sub key={`sub-${index}`}>
        <StyledSubTrigger
          $danger={item.danger}
          $disabled={item.disabled}
          disabled={item.disabled}
        >
          <RowLabel>
            {IconComp && <IconComp size={16} />}
            {item.label}
          </RowLabel>
          <CaretRightIcon size={14} />
        </StyledSubTrigger>
        <DropdownMenu.Portal>
          <StyledSubContent sideOffset={4} alignOffset={-4}>
            {item.items!.map((sub, subIndex) => (
              <RenderRow
                key={`${index}-${subIndex}`}
                item={sub}
                index={subIndex}
              />
            ))}
          </StyledSubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    );
  }

  return (
    <React.Fragment key={`item-${index}`}>
      <StyledItem
        $danger={item.danger}
        $disabled={item.disabled}
        disabled={item.disabled}
        onSelect={handleSelect}
      >
        <RowLabel>
          {IconComp && <IconComp size={16} />}
          {item.label}
        </RowLabel>
      </StyledItem>

      {item.strict && (
        <InlineConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={item.confirmTitle ?? `Confirm: ${item.label}`}
          description={item.confirmDescription}
          onConfirm={() => item.onClick?.()}
        />
      )}
    </React.Fragment>
  );
};

/* ------------------------------------------------------------------ */
/*  Trigger renderer                                                    */
/* ------------------------------------------------------------------ */

const renderTrigger = (trigger: DropDownMenuTriggerProps): JSX.Element => {
  switch (trigger.variant) {
    case "icon": {
      const IconComp = trigger.icon;
      return (
        <DropdownMenu.Trigger asChild disabled={trigger.disabled}>
          <IconTriggerButton
            icon={IconComp}
            size={trigger.iconSize ?? 22}
            disabled={trigger.disabled}
            title={trigger.title}
          />
        </DropdownMenu.Trigger>
      );
    }
    case "icon-button": {
      const IconComp = trigger.icon;
      return (
        <DropdownMenu.Trigger asChild disabled={trigger.disabled}>
          <IconButtonTriggerEl disabled={trigger.disabled}>
            <IconComp size={18} />
            {trigger.label}
          </IconButtonTriggerEl>
        </DropdownMenu.Trigger>
      );
    }
    case "pressable": {
      const IconComp = trigger.icon;
      const hasValue = !!trigger.value && trigger.value.trim().length > 0;
      return (
        <DropdownMenu.Trigger asChild disabled={trigger.disabled}>
          <PressableTriggerEl $hasValue={hasValue} disabled={trigger.disabled}>
            <PressableValue>
              {hasValue ? trigger.value : (trigger.placeholder ?? "Select...")}
            </PressableValue>
            {IconComp && <IconComp size={16} />}
            <ChevronWrap>
              <CaretDownIcon size={14} />
            </ChevronWrap>
          </PressableTriggerEl>
        </DropdownMenu.Trigger>
      );
    }
    case "custom": {
      return (
        <DropdownMenu.Trigger asChild disabled={trigger.disabled}>
          <span>{trigger.children}</span>
        </DropdownMenu.Trigger>
      );
    }
  }
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const DropDownMenuComponent: React.FC<DropDownMenuProps> = ({
  id,
  options,
  trigger,
  align = "start",
  side = "bottom",
  contentWidth,
}) => {
  return (
    <DropdownMenu.Root>
      {renderTrigger(trigger)}

      <DropdownMenu.Portal>
        <StyledContent
          id={id}
          align={align}
          side={side}
          sideOffset={6}
          $width={contentWidth}
        >
          {options.map((item, index) => (
            <RenderRow key={index} item={item} index={index} />
          ))}
        </StyledContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default DropDownMenuComponent;
