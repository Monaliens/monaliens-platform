import styled from 'styled-components';

// Main container
export const StatsContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 80px;
  background-color: var(--bg-card);
  border-radius: 20px;
  box-shadow: 0 4px 10px var(--shadow-color);

  @media (max-width: 768px) {
    flex-direction: column;
    padding: 30px 20px;
  }
`;

// Collection group container
export const CollectionGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 20px;
`;

// Collection header with image and name
export const CollectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.02);
  }
`;

// Collection image
export const CollectionImage = styled.img`
  width: 100px;
  height: 100px;
  border-radius: 16px;
  object-fit: cover;
  box-shadow: 0 8px 24px var(--shadow-color);
  border: 3px solid var(--border-light);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px var(--shadow-color);
  }

  @media (max-width: 768px) {
    width: 70px;
    height: 70px;
  }
`;

// Collection name
export const CollectionName = styled.h3`
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  text-align: center;

  @media (max-width: 768px) {
    font-size: 20px;
  }
`;

// Stats row for each collection
export const StatsRow = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 800px;

  @media (max-width: 768px) {
    gap: 20px;
    justify-content: center;
  }
`;

// Divider between collections
export const Divider = styled.div`
  width: 2px;
  background: linear-gradient(to bottom, transparent, var(--border-light), transparent);
  align-self: stretch;

  @media (max-width: 768px) {
    width: 80%;
    height: 2px;
    background: linear-gradient(to right, transparent, var(--border-light), transparent);
  }
`;

// Individual stat item
export const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-width: 120px;

  @media (max-width: 768px) {
    min-width: auto;
  }
`;

// Stat label/title
export const StatLabel = styled.h3`
  font-size: 16px;
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

// Stat value with icon support
export const StatValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  position: relative;

  img {
    width: 28px;
    height: 28px;
    margin-right: 6px;
  }

  @media (max-width: 768px) {
    font-size: 26px;

    img {
      width: 22px;
      height: 22px;
    }
  }
`;

// Stat percentage (inline next to value)
export const StatPercentage = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  margin-left: 6px;

  @media (max-width: 768px) {
    font-size: 12px;
  }
`;

// Loading and error states
export const MessageContainer = styled(StatsContainer)`
  justify-content: center;
  align-items: center;
  min-height: 100px;
  color: var(--text-secondary);
  font-size: 18px;
`; 