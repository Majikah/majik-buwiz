// ConditionalBanner.tsx

import React from "react";
import styled from "styled-components";

interface ConditionalBannerProps {
  show: boolean;
  children?: React.ReactNode;
  className?: string;
}

const BannerRoot = styled.div`
  width: 100%;
  box-sizing: border-box;
`;

export const ConditionalBanner: React.FC<ConditionalBannerProps> = ({
  show,
  children,
  className,
}) => {
  if (!show) return null;
  return <BannerRoot className={className}>{children}</BannerRoot>;
};
