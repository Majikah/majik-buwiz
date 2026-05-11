import React, { useState } from "react";
import styled, { css } from "styled-components";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

import StyledIconButton from "./StyledIconButton";
import { ActionButton } from "../../globals/buttons";
import DuoButton from "./DuoButton";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "../../globals/styled-dialogs";
import ScrollableForm from "./ScrollableForm";
import DynamicPlaceholder from "./DynamicPlaceholder";

const Button = styled(ActionButton)`
  min-width: 100px;
`;

export const IconTextButton = styled.button<{
  $variant?: "primary" | "success" | "ghost" | "danger";
}>`
  font-family: ${({ theme }) => theme.typography.fonts.medium};
  width: fit-content;
  font-size: 11px;
  padding: 6px 13px;
  border-radius: ${({ theme }) => theme.borders.radius.medium};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transition: all ${({ theme }) => theme.animations.duration.short}
    ${({ theme }) => theme.animations.easing.easeOut};

  ${({ $variant, theme }) => {
    switch ($variant) {
      case "primary":
        return css`
          background: ${theme.gradients.primary};
          border: 1px solid transparent;
          color: ${theme.colors.static.white};
          &:hover:not(:disabled) {
            filter: brightness(1.08);
          }
        `;
      case "success":
        return css`
          background: ${theme.colors.brand.green}18;
          border: 1px solid ${theme.colors.brand.green}44;
          color: ${theme.colors.brand.green};
          &:hover:not(:disabled) {
            background: ${theme.colors.brand.green}28;
          }
        `;
      case "danger":
        return css`
          background: ${theme.colors.error}10;
          border: 1px solid ${theme.colors.error}44;
          color: ${theme.colors.error};
          &:hover:not(:disabled) {
            background: ${theme.colors.error}20;
          }
        `;
      default:
        return css`
          background: transparent;
          border: 1px solid ${theme.colors.primary}33;
          color: ${theme.colors.textSecondary};
          &:hover:not(:disabled) {
            background: ${theme.colors.primarySoft};
            color: ${theme.colors.primary};
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }

  svg {
    flex-shrink: 0;
  }
`;

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;

  padding: 1rem 50px;
`;

interface PopUpFormButtonProps {
  id?: string;
  text?: string;
  disabled?: boolean;
  icon?: React.ComponentType;
  children: React.ReactNode;
  scrollable?: boolean;
  buttons: {
    cancel: {
      text: string;
      onClick?: () => void;
      isDisabled?: boolean;
      hide?: boolean;
    };
    confirm: {
      text: string;
      onClick?: () => void;
      isDisabled?: boolean;
      hide?: boolean;
      confirmationText?: string;
    };
  };
  modal: {
    title: string;
    description: string;
  };
  loading?: {
    isLoading?: boolean;
    text?: string;
  };
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  layout?: "icon" | "full";
}

const PopUpFormButton: React.FC<PopUpFormButtonProps> = ({
  id,
  text = "Confirm",
  disabled = false,
  icon: Icon,
  children,
  scrollable = false,
  buttons = {
    cancel: {
      text: "Cancel",
      isDisabled: false,
      hide: false,
    },
    confirm: {
      text: "Confirm",
      isDisabled: false,
      hide: false,
      confirmationText: "Are you sure you want to proceed with this action?",
    },
  },
  modal = {
    title: "Confirm Action",
    description: "Are you sure you want to proceed with this action?",
  },
  loading = {
    isLoading: false,
    text: "Loading...",
  },
  isOpen,
  onOpenChange,
  layout = "icon",
}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);

  const open = isOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const handleOnConfirm = (): void => {
    buttons?.confirm?.onClick?.();
    setOpen(false); // Close dialog after confirming
  };

  const handleOnCancel = (): void => {
    buttons?.cancel?.onClick?.();
    setOpen(false); // Close dialog after confirming
  };

  const renderButton = () => (
    <>
      {layout === "full" && Icon ? (
        <IconTextButton onClick={() => setOpen(true)} disabled={disabled} id={id}>
          <Icon />
          {text}
        </IconTextButton>
      ) : Icon ? (
        <StyledIconButton
          icon={Icon}
          size={25}
          onClick={() => setOpen(true)}
          disabled={disabled}
          title={`${text}: ${modal.description}`}
          id={id}
        />
      ) : (
        <Button onClick={() => setOpen(true)} disabled={disabled} id={id}>
          {text}
        </Button>
      )}
    </>
  );

  return (
    <>
      {renderButton()}

      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modal.title}</DialogTitle>
              <DialogDescription>{modal.description} </DialogDescription>
            </DialogHeader>

            {loading.isLoading ? (
              <ModalContainer>
                <DynamicPlaceholder loading>{loading.text} </DynamicPlaceholder>
              </ModalContainer>
            ) : scrollable ? (
              <ScrollableForm
                onClickCancel={handleOnCancel}
                onClickProceed={handleOnConfirm}
                isDisabledCancel={buttons.cancel.isDisabled}
                isDisabledProceed={buttons.confirm.isDisabled}
                textCancelButton={buttons.cancel.text}
                textProceedButton={buttons.confirm.text}
                confirmationText={buttons.confirm.confirmationText}
                hideButtonA={buttons.cancel.hide}
                hideButtonB={buttons.confirm.hide}
              >
                {[children]}
              </ScrollableForm>
            ) : (
              <>
                <ModalContainer>{[children]}</ModalContainer>

                <DuoButton
                  textButtonA={buttons.cancel.text}
                  textButtonB={buttons.confirm.text}
                  onClickButtonA={handleOnCancel}
                  onClickButtonB={handleOnConfirm}
                  isDisabledButtonA={buttons.cancel.isDisabled}
                  isDisabledButtonB={buttons.confirm.isDisabled}
                  hideButtonA={buttons.cancel.hide}
                  hideButtonB={buttons.confirm.hide}
                  confirmationText={buttons.confirm.confirmationText}
                />
              </>
            )}
          </DialogContent>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
};

export default PopUpFormButton;
