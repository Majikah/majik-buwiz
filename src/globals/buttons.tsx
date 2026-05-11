// import Image from 'next/image';
import styled, { css } from "styled-components";

export const ButtonPrimaryCTA = styled.button`
  font-family: ${({ theme }) => theme.typography.fonts.regular};
  padding: 0.75rem 2rem;
  background-color: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.primary};
  border: none;
  border-radius: 8px;
  font-size: 1.3rem;
  cursor: pointer;
  width: 100%;
  border: 1px solid transparent;
  box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.18);
  transition: all 0.3s ease;
  user-select: none;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.75);
  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryBackground};
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.3);
  }

  &:focus,
  &:active {
    outline: none;
    color: ${({ theme }) => theme.colors.primaryBackground};
    background-color: ${({ theme }) => theme.colors.primary};
    border-color: transparent;
  }

  &:disabled {
    background-color: ${({ theme }) => theme.colors.secondaryBackground};
    border-color: ${({ theme }) => theme.colors.secondaryBackground};
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: not-allowed;
  }
`;

export const ActionButton = styled.button`
  background: ${({ theme }) => theme.gradients.primary};
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(234, 188, 102, 0.3);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(234, 192, 102, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const ChoiceButton = styled.button<{
  $variant?: "primary" | "secondary";
  $maxWidth?: number;
}>`
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  max-width: ${({ $maxWidth }) => ($maxWidth ? `${$maxWidth}px` : "none")};

  ${({ $variant, theme }) =>
    $variant === "primary"
      ? `
    background: ${theme.gradients.primary};
    color: ${theme.colors.primaryBackground};
    box-shadow: 0 4px 15px rgba(234, 188, 102, 0.3);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(234, 192, 102, 0.4);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `
      : `
    background: transparent;
    color: ${theme.colors.textPrimary};
    border: 1px solid ${theme.colors.secondaryBackground};

    &:hover {
      background: ${theme.colors.secondaryBackground};
    }
  `}
`;

export interface ButtonPrimaryConfirmProps {
  size?: number | null | undefined;
}

export const ButtonPrimaryConfirm = styled.button<ButtonPrimaryConfirmProps>`
  padding: 0.35rem 2rem;
  font-weight: 500;
  background-color: ${({ theme }) => theme.colors.secondaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.18);
  transition: all 0.3s ease;
  max-width: ${(props) => (props.size ? `${props.size}px` : "unset")};
  width: ${(props) => (props.size ? `inherit` : "auto")};

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primaryBackground};
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.3);
  }

  &:disabled {
    background-color: ${({ theme }) => theme.colors.secondaryBackground};
    border-color: ${({ theme }) => theme.colors.secondaryBackground};
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: not-allowed;
  }

  &:focus,
  &:active {
    outline: none;
    color: ${({ theme }) => theme.colors.primaryBackground};
    background-color: ${({ theme }) => theme.colors.primary};
    border-color: transparent;
  }
`;

export const SubMenuTabButton = styled(ButtonPrimaryConfirm)`
  background-color: transparent;
  padding: 0.75rem 1rem;
  user-select: none;
  color: ${({ theme }) => theme.colors.textPrimary};
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: none;
  height: 3.6em;
  font-size: 14px;
  font-weight: ${({ theme }) => theme.typography.weights.subject};
  border-radius: 0px;

  text-align: left;

  &:disabled {
    color: ${({ theme }) => theme.colors.textPrimary};
    background-color: ${({ theme }) => theme.colors.accent};
    border: 0px solid ${({ theme }) => theme.colors.disabled};
    opacity: 1;
    font-weight: ${({ theme }) => theme.typography.weights.title};
    text-shadow: 0 0 10px rgba(255, 255, 255, 1);
  }
`;

// Styled component for Utility button
export const UtilityButton = styled.button`
  background-color: ${({ theme }) => theme.colors.textPrimary};
  color: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid;
  padding: 10px 20px;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium || "8px"};
  font-size: ${({ theme }) => theme.typography.sizes.body};
  font-weight: ${({ theme }) => theme.typography.weights.title};

  &:hover {
    background-color: ${({ theme }) => theme.colors.secondaryBackground};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
    border: 1px solid;
  }

  &:disabled {
    background-color: ${({ theme }) => theme.colors.secondaryBackground};
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: not-allowed;
    border: 1px solid ${({ theme }) => theme.colors.disabled};
    opacity: 0.6;
  }
`;



export const CtrlBtn = styled.button<{
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
