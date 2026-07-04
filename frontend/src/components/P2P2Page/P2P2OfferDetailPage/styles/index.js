import styled from 'styled-components';

export const DetailPage = styled.div`
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding:10px 20px 120px;
  background: transparent;

  @media (max-width: 768px) {
    padding: 10px 16px 80px;
  }
`;

export const DetailWrapper = styled.div`
  width: 100%;
  max-width: 1160px;
  display: flex;
  flex-direction: column;
  gap: 26px;

  @media (max-width: 768px) {
    gap: 16px;
  }
`;

export const TopRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 48px;

  @media (max-width: 768px) {
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;

    /* BackButton stays on left */
    > *:nth-child(1) {
      order: 1;
      flex: 0 0 auto;
    }

    /* Tabs go to bottom, centered, full width */
    > *:nth-child(2) {
      order: 3;
      flex: 0 0 100%;
      display: flex;
      justify-content: center;
    }

    /* Trade button(s) container stays on right */
    > *:nth-child(3) {
      order: 2;
      flex: 0 0 auto;
      margin-left: auto;
    }
  }
`;

export const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 999px;
  border: none;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 45%, #3b82f6 100%);
  box-shadow: 0 16px 32px rgba(99, 102, 241, 0.35);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 32px rgba(99, 102, 241, 0.4);
  }

  @media (max-width: 768px) {
    padding: 8px 14px;
    font-size: 13px;
    gap: 6px;
  }
`;

export const Tabs = styled.div`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  padding: 6px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.12), 0 18px 25px rgba(99, 102, 241, 0.2);
  gap: 6px;

  @media (max-width: 768px) {
    position: static;
    transform: none;
    padding: 3px;
    gap: 2px;
    width: auto;
    margin: 0 auto;
  }
`;

export const TabButton = styled.button`
  min-width: 140px;
  padding: 10px 20px;
  border: none;
  border-radius: 999px;
  font-weight: 600;
  font-size: 14px;
  color: ${(props) => (props.$active ? '#111827' : '#4c1d95')};
  background: ${(props) => (props.$active ? '#ffffff' : 'transparent')};
  box-shadow: ${(props) => (props.$active ? '0 10px 22px rgba(99, 102, 241, 0.28)' : 'none')};
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: ${(props) => (props.$active ? 'none' : 'translateY(-1px)')};
  }

  @media (max-width: 768px) {
    min-width: auto;
    padding: 6px 10px;
    font-size: 12px;
    white-space: nowrap;
  }
`;

export const Heading = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #0f172a;
  align-items: center;
  text-align: center;
`;

export const OfferTitle = styled.h1`
  margin: 0;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 0.4px;

  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

export const OfferDescription = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: #475569;
  max-width: 780px;
`;

export const PurpleSurface = styled.div`
  position: relative;
  border-radius: 42px;
  padding: 32px 24px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(124, 58, 237, 0.06);
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(24px, 60px) minmax(260px, 1fr);
  align-items: start;
  justify-items: center;
  gap: 24px;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(140deg, rgba(124, 58, 237, 0.12), transparent 55%),
      linear-gradient(-140deg, rgba(59, 130, 246, 0.12), transparent 55%);
    opacity: 0.45;
    pointer-events: none;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 32px;
    padding: 24px 16px;
    border-radius: 24px;
  }
`;

export const AssetsColumn = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  text-align: center;

  @media (max-width: 960px) {
    width: 100%;
    max-width: 480px;
  }
`;

export const ColumnHeading = styled.h2`
  margin: 0;
  font-size: 18px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #312e81;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    font-size: 14px;
    letter-spacing: 0.5px;
  }
`;

export const AssetGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18px;
  width: 100%;
  max-width: 720px;

  @media (max-width: 768px) {
    gap: 12px;
  }
`;

export const DividerColumn = styled.div`
  position: relative;
  z-index: 1;
  width: 1px;
  align-self: stretch;
  justify-self: center;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    inset: 12% 0;
    background: linear-gradient(180deg, rgba(147, 197, 253, 0), rgba(99, 102, 241, 0.45), rgba(147, 197, 253, 0));
    width: 100%;
    border-radius: 999px;
  }

  @media (max-width: 960px) {
    display: none;
  }
`;

export const AssetCard = styled.div`
  width: 140px;
  padding: 16px 12px 14px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 0 12px 24px rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.12);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  text-align: center;
`;

export const AssetImage = styled.img`
  width: 88px;
  height: 88px;
  border-radius: 22px;
  object-fit: cover;
  box-shadow: 0 14px 26px rgba(59, 130, 246, 0.25);
`;

export const AssetFallback = styled.span`
  width: 88px;
  height: 88px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: #4c1d95;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.18);
`;

export const AssetName = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: #111827;
`;

export const AssetSubtitle = styled.span`
  font-size: 12px;
  color: #64748b;
`;

export const SectionCard = styled.div`
  margin-top: 28px;
  padding: 32px;
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 22px 45px rgba(99, 102, 241, 0.2);
  border: 1px solid rgba(148, 163, 184, 0.22);
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

export const SectionHeading = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const SectionTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #312e81;
`;

export const AttributesTable = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
`;

export const AttributeCard = styled.div`
  padding: 16px;
  border-radius: 22px;
  background: rgba(224, 231, 255, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.22);
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: center;
`;

export const AttributeKey = styled.span`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #4c1d95;
  font-weight: 700;
`;

export const AttributeValue = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
`;

export const EmptyState = styled.div`
  width: 100%;
  padding: 42px 20px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px dashed rgba(124, 58, 237, 0.28);
  color: #4c1d95;
  font-weight: 600;
  text-align: center;
`;

export const MetaFooter = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
`;

export const MetaTags = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 900px;
`;

export const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

export const MetaPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.6);
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  letter-spacing: 0.3px;
  width: fit-content;

  a {
    color: #6366f1;
    text-decoration: none;
    font-weight: 600;

    &:hover {
      text-decoration: underline;
    }
  }

  ${props => !props.$noIcon && `
    &::before {
      content: '';
      display: none;
    }
  `}
`;

export const TradeButton = styled.button`
  padding: 10px 18px;
  border-radius: 999px;
  border: none;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #c084fc 100%);
  box-shadow: 0 16px 32px rgba(99, 102, 241, 0.35);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 20px 32px rgba(99, 102, 241, 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #94a3b8;
  }

  @media (max-width: 768px) {
    padding: 8px 14px;
    font-size: 13px;
    min-width: auto;
  }
`;

export const OwnerBadge = styled.div`
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.18);
  color: #047857;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  @media (max-width: 768px) {
    padding: 8px 14px;
    font-size: 12px;
    letter-spacing: 0.4px;
  }
`;

export const CancelButton = styled.button`
  padding: 10px 18px;
  border-radius: 999px;
  border: none;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  background: linear-gradient(135deg, #fb7185 0%, #ef4444 60%, #b91c1c 100%);
  box-shadow: 0 16px 32px rgba(239, 68, 68, 0.35);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 32px rgba(239, 68, 68, 0.45);
  }

  @media (max-width: 768px) {
    padding: 8px 14px;
    font-size: 13px;
    min-width: auto;
  }
`;

export const CounterOffersBlock = styled.div`
  padding: 48px;
  border-radius: 40px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(124, 58, 237, 0.14);
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  text-align: center;
  color: #312e81;
`;

export const CounterHeading = styled.h2`
  margin: 0;
  font-size: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

export const CounterDescription = styled.p`
  margin: 0;
  max-width: 420px;
  line-height: 1.6;
  color: #475569;
`;

export const CounterCardsGrid = styled.div`
  display: grid;
  gap: 20px;
  width: 100%;
  margin-top: 12px;
  grid-template-columns: repeat(auto-fill, minmax(320px, 320px));
  justify-content: start;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    justify-content: stretch;
  }
`;

export const CounterCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  background: linear-gradient(135deg, #ffffff 0%, #faf5ff 100%);
  border: 2px solid rgba(139, 92, 246, 0.15);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.05),
    0 8px 16px rgba(139, 92, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 4px 8px rgba(0, 0, 0, 0.08),
      0 12px 24px rgba(139, 92, 246, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    border-color: rgba(139, 92, 246, 0.25);
  }
`;

export const CounterBadge = styled.span`
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 5px 10px;
  border-radius: 8px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
`;

export const CounterCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const CounterThumbnail = styled.img`
  width: 72px;
  height: 72px;
  border-radius: 14px;
  object-fit: cover;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(139, 92, 246, 0.15);
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.8);
  transition: transform 0.2s ease;

  ${CounterCard}:hover & {
    transform: scale(1.03);
  }
`;

export const CounterCardTitle = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.4;
`;

export const CounterCardSubtitle = styled.span`
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
`;

export const CounterCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const CounterSummary = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.5);
  border: 1px solid rgba(226, 232, 240, 0.8);
`;

export const CounterSummaryLabel = styled.span`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
`;

export const CounterSummaryText = styled.span`
  font-size: 13px;
  color: #1f2937;
  line-height: 1.5;
  font-weight: 500;
`;

export const CounterCardFooter = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export const CounterCardButton = styled.button`
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.35);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #94a3b8;
  }
`;

export const CounterCardActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding-top: 4px;
`;

export const CounterCardButtonSecondary = styled.button`
  padding: 10px 18px;
  border-radius: 10px;
  border: 2px solid rgba(139, 92, 246, 0.2);
  background: white;
  color: #6366f1;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(139, 92, 246, 0.05);
    border-color: rgba(139, 92, 246, 0.3);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const LoadingState = styled.div`
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4c1d95;
  font-weight: 600;
`;

export const ErrorCard = styled.div`
  padding: 48px;
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 50px rgba(239, 68, 68, 0.2);
  display: grid;
  gap: 16px;
  justify-items: center;
  text-align: center;
`;

export const RetryButton = styled.button`
  padding: 10px 20px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-1px);
  }
`;

export const AcceptOfferButton = styled.button`
  padding: 10px 18px;
  border-radius: 999px;
  border: none;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  background: ${props => props.disabled
    ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
    : 'linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)'
  };
  box-shadow: ${props => props.disabled
    ? '0 8px 16px rgba(107, 114, 128, 0.2)'
    : '0 16px 32px rgba(16, 185, 129, 0.35)'
  };
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.6 : 1};
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;

  &:hover {
    transform: ${props => props.disabled ? 'none' : 'translateY(-1px)'};
    box-shadow: ${props => props.disabled
      ? '0 8px 16px rgba(107, 114, 128, 0.2)'
      : '0 20px 32px rgba(16, 185, 129, 0.4)'
    };
  }

  &:active {
    transform: ${props => props.disabled ? 'none' : 'translateY(0)'};
  }

  @media (max-width: 768px) {
    padding: 8px 14px;
    font-size: 13px;
    min-width: auto;
  }
`;
