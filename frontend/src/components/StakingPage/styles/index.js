import styled, { keyframes } from 'styled-components';

// Animations
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const modalFadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const modalSlideIn = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -45%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
`;

// Main containers
export const StakingPageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  background: transparent;
  padding: 2rem 1rem 4rem;
  position: relative;
  overflow: visible;
  opacity: 0;
  animation: ${fadeIn} 0.8s ease-out forwards;
  animation-delay: 0.1s;
  
  @media (min-width: 768px) {
    padding: 3rem 2rem 4rem;
  }
  
  @media (min-width: 1200px) {
    padding: 4rem 3rem 4rem;
  }
`;

export const ContentWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
  opacity: 0;
  animation: ${slideUp} 0.8s ease-out forwards;
  animation-delay: 0.3s;
`;

// Header section
export const StakingHeader = styled.div`
  text-align: center;
  margin-bottom: 3rem;
  position: relative;
  z-index: 1;
  
  h1 {
    font-size: 3rem;
    font-weight: 900;
    margin-bottom: 1rem;
    color: var(--accent-primary);
    text-transform: uppercase;
    letter-spacing: 3px;
    line-height: 1.2;
    text-shadow: 0 2px 4px var(--shadow-color);
    
    @media (max-width: 768px) {
      font-size: 2.2rem;
      letter-spacing: 2px;
    }
    
    @media (max-width: 480px) {
      font-size: 1.8rem;
      letter-spacing: 1px;
    }
  }
  
  p {
    font-size: 1.1rem;
    color: var(--text-secondary);
    margin: 0 auto;
    max-width: 600px;
    line-height: 1.6;
    font-weight: 500;
    
    @media (max-width: 768px) {
      font-size: 1rem;
    }
  }
`;

// Stats Grid
export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
  margin-top: -2rem; /* Reduce top spacing */

  @media (max-width: 968px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
`;

export const StatCard = styled.div`
  background: transparent;
  border: none;
  padding: 1rem;
  text-align: center;

  @media (max-width: 968px) {
    padding: 0.5rem;
  }
`;

export const StatLabel = styled.div`
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;

  @media (max-width: 968px) {
    font-size: 0.7rem;
    letter-spacing: 0.3px;
  }
`;

export const StatValue = styled.div`
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--accent-primary);
  line-height: 1;

  @media (max-width: 968px) {
    font-size: 1.75rem;
  }

  @media (max-width: 480px) {
    font-size: 1.5rem;
  }
`;

// Panels Container
export const PanelsContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: start; /* Panels stay at their own size */
  
  @media (max-width: 968px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
`;

// Container Headers (inside panels)
export const ContainerHeader = styled.div`
  position: relative;
  text-align: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border-light);

  h2 {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 0;
    width: 100%;
    text-align: center;
    
    @media (max-width: 768px) {
      font-size: 1.4rem;
      letter-spacing: 1px;
    }
  }
`;

// Selection Counter
export const SelectionCounter = styled.div`
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 600;
  
  @media (max-width: 768px) {
    position: static;
    transform: none;
    margin-top: 0.5rem;
  }
`;

// Container Wrapper
export const ContainerWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

// Container Content
export const ContainerContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1; /* Fill remaining space */
  justify-content: space-between; /* Distribute content evenly */
`;

// Unstake Panel Sections
export const UnstakeSection = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;

  &:not(:last-child) {
    border-bottom: 2px solid var(--border-light);
    margin-bottom: 1rem;
    padding-bottom: 1rem;
  }
`;

// Section Title
export const SectionTitle = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.75rem;
  text-align: center;
  
  &:empty {
    display: none;
  }
`;

// Panel Styles
export const Panel = styled.div`
  background: var(--bg-glass);
  backdrop-filter: blur(25px);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px var(--shadow-color);
  border: 1px solid var(--border-light);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  height: 650px;
  isolation: isolate; /* Allows NFT hover effects to extend outside container */
`;

export const PanelHeader = styled.div`
  display: none; // Will be replaced by ContainerHeader
`;

// Button Styles
export const PrimaryButton = styled.button`
  background: linear-gradient(135deg, var(--accent-primary) 0%, #8b5cf6 100%);
  color: var(--text-light);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px var(--shadow-color);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px var(--shadow-color);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

export const SecondaryButton = styled.button`
  background: transparent;
  color: var(--accent-primary);
  border: 2px solid var(--accent-primary);
  padding: 0.5rem 1rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--accent-primary);
    color: var(--text-light);
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// NFT Grid
export const NFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: visible; /* Allow hover effect to overflow from sides */
  padding: 12px 8px 12px 12px; /* Extra padding for hover */
  margin: -12px -8px -12px -12px; /* Compensate for padding */

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--bg-secondary);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--accent-primary);
    border-radius: 10px;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 0.5rem;
  }
`;

// Vertical NFT Grid for unstake sections (fixed height)
export const VerticalNFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.75rem;
  overflow-y: auto;
  overflow-x: visible; /* Allow hover effect to overflow from sides */
  padding: 12px 8px 12px 12px; /* Extra padding for hover */
  margin: -12px -8px -12px -12px; /* Compensate for padding */
  height: 100%;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--bg-secondary);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--accent-primary);
    border-radius: 10px;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 0.5rem;
  }
`;

export const NFTCard = styled.div`
  background: var(--bg-card);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  border: 2px solid ${props => props.$selected ? 'var(--accent-primary)' : 'transparent'};
  opacity: ${props => props.$disabled ? '0.5' : '1'};
  box-shadow: 0 2px 8px var(--shadow-color);
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  isolation: isolate; /* improves hover effect stacking context */

  &:hover:not([disabled]) {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 16px 40px var(--shadow-color);
    z-index: 10;
  }

  img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: contain;
    background: var(--bg-glass);
  }

  .nft-info {
    padding: 0.5rem;

    .nft-name {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: center;
    }
  }
`;

// Loading States
export const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4rem;
  
  svg {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Loading Toast
export const LoadingToast = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: linear-gradient(135deg, var(--accent-primary) 0%, #8b5cf6 100%);
  color: var(--text-light);
  padding: 1rem 1.5rem;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 32px var(--shadow-color);
  z-index: 1000;
  animation: ${slideUp} 0.3s ease-out;
  
  svg {
    animation: spin 1s linear infinite;
  }
  
  span {
    font-size: 14px;
    font-weight: 600;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Wallet Warning
export const WalletWarning = styled.div`
  background: var(--bg-glass);
  backdrop-filter: blur(10px);
  border: 2px solid var(--border-light);
  color: var(--text-secondary);
  padding: 3rem 2rem;
  border-radius: 20px;
  margin: 2rem auto;
  max-width: 600px;
  text-align: center;
  font-weight: 500;
  box-shadow: 0 8px 32px var(--shadow-color);

  h3 {
    margin-bottom: 1rem;
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: 700;
  }

  p {
    margin-bottom: 2rem;
    font-size: 1.1rem;
    line-height: 1.6;
  }
`;

// Empty State
export const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  flex: 1; /* fill remaining space */
  display: flex;
  flex-direction: column;
  justify-content: center;

  h4 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }
  
  p {
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
  }
`;

// Action Button Container
export const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  padding-bottom: 1rem; /* bottom padding */
  border-top: 2px solid var(--border-light);
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.75rem;
  }
`;

// Selection Controls
export const SelectionControls = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;

  span {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
`;

// Cooldown indicator
export const CooldownIndicator = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: #ff6b00;
  color: var(--text-light);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
`;

// Staking duration (removed - no longer needed)
export const StakingDuration = styled.div`
  display: none;
`;

// Confirmation Modal
export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: ${modalFadeIn} 0.3s ease-out;
`;

export const ModalContent = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-card);
  border-radius: 20px;
  padding: 2.5rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px var(--shadow-color);
  animation: ${modalSlideIn} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1001;

  @media (max-width: 480px) {
    padding: 2rem 1.5rem;
    max-width: 95%;
  }
`;

export const ModalHeader = styled.div`
  margin-bottom: 1.5rem;

  h3 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent-primary);
    margin-bottom: 0.5rem;
    text-align: center;
  }

  p {
    font-size: 0.95rem;
    color: var(--text-secondary);
    text-align: center;
    line-height: 1.5;
  }
`;

export const ModalBody = styled.div`
  margin-bottom: 2rem;

  p {
    font-size: 0.95rem;
    color: var(--text-primary);
    line-height: 1.7;
    margin-bottom: 1rem;

    strong {
      color: var(--accent-primary);
      font-weight: 600;
    }
  }
`;

export const CheckboxContainer = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-glass);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 1.5rem;

  &:hover {
    background: var(--bg-secondary);
  }

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    min-width: 20px;
    cursor: pointer;
    margin-top: 2px;
    accent-color: var(--accent-primary);
  }

  span {
    font-size: 0.9rem;
    color: var(--text-primary);
    line-height: 1.6;
    font-weight: 500;
  }
`;

export const ModalActions = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: space-between;

  @media (max-width: 480px) {
    flex-direction: column-reverse;
  }
`;

export const ModalButton = styled.button`
  flex: 1;
  padding: 0.85rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;

  ${props => props.$variant === 'primary' ? `
    background: linear-gradient(135deg, var(--accent-primary) 0%, #8e44ad 100%);
    color: var(--text-light);
    box-shadow: 0 4px 15px var(--shadow-color);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px var(--shadow-color);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
  ` : `
    background: var(--bg-secondary);
    color: var(--text-secondary);

    &:hover {
      background: var(--bg-glass);
      color: var(--text-primary);
    }
  `}
`;