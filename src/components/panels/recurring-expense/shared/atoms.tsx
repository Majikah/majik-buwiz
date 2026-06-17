// ── Mode toggle ───────────────────────────────────────────────────────────────

import styled from "styled-components";

export const ModeBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary}14;
`;

export const ModeToggle = styled.div`
  display: flex;
  border: 1px solid ${({ theme }) => theme.colors.primary}22;
  border-radius: ${({ theme }) => theme.borders?.radius?.medium ?? "6px"};
  overflow: hidden;
`;

export const ModeBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  flex-direction: row;
  font-family: ${({ theme }) =>
    theme.typography?.fonts?.medium ?? "sans-serif"};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  align-items: center;
  justify-content: center;
  gap: 1em;
  padding: 5px 14px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySoft : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textSecondary};
  border-right: 1px solid ${({ theme }) => theme.colors.primary}15;

  &:last-child {
    border-right: none;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;
