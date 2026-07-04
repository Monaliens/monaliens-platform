import styled, { keyframes } from 'styled-components';

// Colors from raffle theme - exact same
const COLORS = {
  primary: '#6930c3',
  blue: '#2563eb',
  green: '#16a34a',
  danger: '#dc2626',
  background: '#f5f5f5',
  cardBackground: 'rgba(255, 255, 255, 0.95)',
  text: {
    primary: '#1f2937',
    secondary: '#6b7280'
  }
};

// Animations - same as raffle
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-5px); }
`;

const slideLeft = keyframes`
  from { 
    opacity: 0; 
    transform: translateX(50px); 
  }
  to { 
    opacity: 1; 
    transform: translateX(0); 
  }
`;

const slideRight = keyframes`
  from { 
    opacity: 0; 
    transform: translateX(-50px); 
  }
  to { 
    opacity: 1; 
    transform: translateX(0); 
  }
`;

// Main containers - same structure as raffle
export const PageContainer = styled.div`
  min-height: 100vh;
  background: transparent;
  font-family: var(--font-primary);
  position: relative;
`;

export const ContentWrapper = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 10px 85px 40px;
  overflow-x: hidden; /* prevent transient horizontal scroll on 4th slot */

  @media (max-width: 768px) {
    padding: 10px 25px 20px;
  }
`;

export const HeaderSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  animation: ${fadeIn} 0.6s ease;
  position: relative;
  z-index: 15;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
`;

export const PageTitle = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: ${COLORS.text.primary};
  margin: 0;
  font-family: var(--font-primary);
  
  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

export const BackButton = styled.button`
  background: transparent;
  color: ${COLORS.blue};
  border: 2px solid ${COLORS.blue};
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: var(--font-primary);
  
  &:hover {
    transform: scale(1.02);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  @media (max-width: 768px) {
    padding: 12px 20px;
    font-size: 15px;
    min-height: 44px;
  }
`;

// Create Offer Section Styles - centered layout with proper spacing
export const CreateSectionContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
  margin-bottom: 40px;
  transition: gap 0.3s ease;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
  }
`;

// Step Card - optimized dimensions for better fit
export const StepCard = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(105, 48, 195, 0.02) 100%);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);
  padding: 20px;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  width: 100%;
  max-width: 320px;
  min-width: 260px;
  height: 540px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 30px rgba(105, 48, 195, 0.5);
    border-color: rgba(105, 48, 195, 0.3);
    z-index: 2;
  }
  
  @media (max-width: 768px) {
    height: auto;
    min-height: 400px;
    max-height: 500px;
    max-width: 100%;
    min-width: 280px;
  }
`;

export const StepTransition = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  opacity: 0;
  transform: translateY(28px) scale(0.95);
  transform-origin: top center;
  transition:
    opacity 0.45s cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow: visible;
  will-change: opacity, transform;

  &[data-visible='true'] {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }

  &[data-visible='leaving'],
  &[data-visible='false'] {
    opacity: 0;
    transform: translateY(28px) scale(0.95);
    pointer-events: none;
  }

  @media (max-width: 768px) {
    &[data-visible='false'] {
      height: 0;
      overflow: hidden;
      transform: translateY(0) scale(1);
    }
  }
`;

export const StepSlot = styled.div`
  --slot-width: 320px;
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--slot-width);
  max-width: var(--slot-width);
  min-width: var(--slot-width);
  transition:
    flex-basis 0.45s cubic-bezier(0.22, 0.61, 0.36, 1),
    max-width 0.45s cubic-bezier(0.22, 0.61, 0.36, 1),
    min-width 0.45s cubic-bezier(0.22, 0.61, 0.36, 1),
    margin 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
  margin: 0;

  &[data-active='false'] {
    --slot-width: 0px;
    margin: 0;
  }

  @media (max-width: 1024px) {
    --slot-width: 300px;
  }

  @media (max-width: 768px) {
    --slot-width: 100%;
    margin: 0;

    &[data-active='false'] {
      --slot-width: 0px;
      height: 0;
      overflow: hidden;
      padding: 0;
    }
  }
`;

export const StepIndicator = styled.div`
  position: absolute;
  top: -15px;
  left: 24px;
  background: ${COLORS.primary};
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(105, 48, 195, 0.4);
`;

export const StepNumber = styled.span`
  color: white;
  font-weight: 700;
  font-size: 16px;
`;

export const StepTitle = styled.h2`
  color: ${COLORS.text.primary};
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
  margin-top: 6px;
  flex-shrink: 0;
`;

export const StepDescription = styled.p`
  color: ${COLORS.text.secondary};
  font-size: 12px;
  margin-bottom: 16px;
  line-height: 1.4;
  flex-shrink: 0;
`;

// Asset Grid - scrollable container without visible scrollbar
export const AssetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  position: relative;
  padding: 2px;
  margin: -2px;
  align-items: start;
  
  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }
  
  /* Hide scrollbar for IE, Edge and Firefox */
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    max-height: 200px;
  }
`;

export const StepScrollable = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(105, 48, 195, 0.2);
    border-radius: 6px;
  }
`;

export const RequestNFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  max-height: 230px;
  overflow-y: auto;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(105, 48, 195, 0.25);
    border-radius: 8px;
  }

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 768px) {
    max-height: 200px;
  }
`;

// Asset Card - dynamic sizing for better fit
export const AssetCard = styled.div`
  background: ${props => props.$selected ? 
    'linear-gradient(135deg, rgba(105, 48, 195, 0.1) 0%, rgba(105, 48, 195, 0.05) 100%)' : 
    'rgba(255, 255, 255, 0.95)'};
  border: 2px solid ${props => props.$selected ? 
    'rgba(105, 48, 195, 0.5)' : 
    'rgba(105, 48, 195, 0.1)'};
  border-radius: 6px;
  padding: 3px;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  
  &:hover {
    border-color: rgba(105, 48, 195, 0.4);
    box-shadow: 0 4px 12px rgba(105, 48, 195, 0.25);
  }
  
  &.add-new {
    border-style: dashed;
    opacity: 0.7;
    
    &:hover {
      opacity: 1;
    }
  }
`;

export const AssetImage = styled.img`
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 3px;
  margin-bottom: 4px;
  
  &.placeholder {
    background: rgba(105, 48, 195, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${COLORS.text.secondary};
    font-weight: 600;
    font-size: 12px;
  }
`;

export const RequestNFTCard = styled(AssetCard)`
  min-width: 0;
  max-width: none;
  padding: 4px;
`;

export const AssetInfo = styled.div`
  padding: 2px;
`;

export const AssetName = styled.div`
  color: ${COLORS.text.primary};
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const AssetCollection = styled.div`
  color: ${COLORS.text.secondary};
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// Form Elements
export const FormInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 8px;
  font-size: 14px;
  color: ${COLORS.text.primary};
  transition: all 0.2s ease;
  font-family: var(--font-primary);
  
  &:focus {
    outline: none;
    border-color: rgba(105, 48, 195, 0.3);
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
  }
  
  &::placeholder {
    color: ${COLORS.text.secondary};
    font-size: 13px;
  }
`;

export const FormTextarea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid rgba(105, 48, 195, 0.1);
  border-radius: 8px;
  font-size: 14px;
  color: ${COLORS.text.primary};
  transition: all 0.2s ease;
  font-family: var(--font-primary);
  resize: vertical;
  min-height: 80px;
  
  &:focus {
    outline: none;
    border-color: rgba(105, 48, 195, 0.3);
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
  }
  
  &::placeholder {
    color: ${COLORS.text.secondary};
    font-size: 13px;
  }
`;

export const FormLabel = styled.label`
  display: block;
  color: ${COLORS.text.primary};
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

// Toggle Buttons
export const ToggleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const ToggleButton = styled.button`
  padding: 12px 16px;
  background: ${props => props.$active ? 
    'rgba(105, 48, 195, 0.08)' : 
    'rgba(255, 255, 255, 0.95)'};
  border: 2px solid ${props => props.$active ? 
    'rgba(105, 48, 195, 0.4)' : 
    'rgba(105, 48, 195, 0.08)'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(105, 48, 195, 0.15);
    border-color: rgba(105, 48, 195, 0.2);
  }
  
  .title {
    color: ${COLORS.text.primary};
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 2px;
  }
  
  .description {
    color: ${COLORS.text.secondary};
    font-size: 11px;
    line-height: 1.3;
  }
`;

// Segmented control for binary toggles
export const Segmented = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  border: 2px solid rgba(105, 48, 195, 0.12);
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
  overflow: hidden;
`;

export const SegmentedThumb = styled.div`
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(105, 48, 195, 0.14) 0%, rgba(105, 48, 195, 0.06) 100%);
  box-shadow: inset 0 0 0 2px rgba(105, 48, 195, 0.2), 0 4px 10px rgba(105, 48, 195, 0.12);
  transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  pointer-events: none;
`;

export const SegmentedOption = styled.button`
  position: relative;
  z-index: 1;
  flex: 1;
  height: 40px;
  border: 0;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 14px;
  color: ${props => props.$active ? COLORS.text.primary : COLORS.text.primary};
  opacity: ${props => props.$active ? 1 : 0.8};
  transition: opacity 0.2s ease, color 0.2s ease;
  font-family: var(--font-primary);

  &:hover { opacity: 1; }
`;

// Action Button - smaller for card layout
export const ActionButton = styled.button`
  width: 100%;
  background: transparent;
  color: ${COLORS.blue};
  border: 2px solid ${COLORS.blue};
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: var(--font-primary);
  margin-top: 8px;
  
  &:hover {
    transform: scale(1.02);
    background: rgba(37, 99, 235, 0.05);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Scroll Indicator - same as raffle
export const ScrollIndicatorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 40px 0;
  animation: ${fadeIn} 0.8s ease 0.3s both;
`;

export const ScrollArrow = styled.div`
  width: 3px;
  height: 40px;
  background: ${COLORS.text.primary};
  margin-bottom: 20px;
  animation: ${bounce} 2s infinite;
  border-radius: 2px;
  opacity: 0.7;
`;

export const ScrollText = styled.p`
  color: ${COLORS.text.secondary};
  font-size: 14px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

export const RequestAssetForm = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;

  @media (max-width: 1024px) {
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    flex-direction: column;

    > button {
      width: 100%;
    }
  }
`;

export const AddRequestedAssetButton = styled.button`
  background: ${COLORS.primary};
  color: #ffffff;
  border: none;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  white-space: nowrap;
  min-width: 140px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 25px rgba(105, 48, 195, 0.25);
  }

  &:active {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const RequestedAssetsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 12px;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(105, 48, 195, 0.25);
    border-radius: 8px;
  }

  -ms-overflow-style: none;
  scrollbar-width: thin;
`;

export const RequestedAssetItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(105, 48, 195, 0.08);
  border: 1px solid rgba(105, 48, 195, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  gap: 12px;
`;

export const RequestedAssetContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const RequestedAssetBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(105, 48, 195, 0.15);
  color: ${COLORS.text.primary};
  font-weight: 600;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  width: fit-content;
`;

export const RequestedAssetTitle = styled.div`
  color: ${COLORS.text.primary};
  font-size: 14px;
  font-weight: 600;
`;

export const RequestedAssetSubtitle = styled.div`
  color: ${COLORS.text.secondary};
  font-size: 12px;
  letter-spacing: 0.3px;
`;

export const RemoveAssetButton = styled.button`
  background: transparent;
  border: none;
  color: ${COLORS.blue};
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  padding: 6px 0 6px 12px;
  transition: color 0.2s ease;

  &:hover {
    color: ${COLORS.primary};
  }
`;

export const RequestedAssetsEmpty = styled.div`
  border: 1px dashed rgba(105, 48, 195, 0.2);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  color: ${COLORS.text.secondary};
  font-size: 13px;
  background: rgba(255, 255, 255, 0.7);
`;

export const InlineError = styled.div`
  color: ${COLORS.danger};
  font-size: 12px;
  font-weight: 600;
  margin-top: 6px;
`;

export const CollectionGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  overflow-y: auto;
  padding: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(105, 48, 195, 0.25);
    border-radius: 8px;
  }
`;

export const CollectionCard = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${props => props.$selected ? 'rgba(105, 48, 195, 0.12)' : 'rgba(255, 255, 255, 0.95)'};
  border: 1px solid ${props => props.$selected ? 'rgba(105, 48, 195, 0.4)' : 'rgba(105, 48, 195, 0.15)'};
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  color: ${COLORS.text.primary};
  width: 100%;
  height: 40px;

  &:hover {
    border-color: rgba(105, 48, 195, 0.3);
    background: rgba(105, 48, 195, 0.05);
  }
`;

export const CollectionImage = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
`;

export const CollectionName = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: ${COLORS.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`;

export const InlineActionButton = styled.button`
  margin-left: 8px;
  background: none;
  border: none;
  color: ${COLORS.blue};
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  font-size: 12px;

  &:hover {
    color: ${COLORS.primary};
  }
`;

export const SelectedCollectionCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(105, 48, 195, 0.1);
  border: 1px solid rgba(105, 48, 195, 0.25);
  border-radius: 12px;
  padding: 12px 16px;
`;

export const SelectedCollectionThumb = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: cover;
  box-shadow: 0 6px 16px rgba(105, 48, 195, 0.25);
`;

export const SelectedCollectionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
`;

export const SelectedCollectionName = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${COLORS.text.primary};
`;

export const SelectedCollectionMeta = styled.div`
  font-size: 12px;
  color: ${COLORS.text.secondary};
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

export const GhostButton = styled.button`
  background: transparent;
  border: 1px solid rgba(105, 48, 195, 0.25);
  color: ${COLORS.blue};
  font-weight: 600;
  font-size: 12px;
  padding: 6px 16px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${COLORS.blue};
    color: ${COLORS.primary};
  }
`;

export const HelperText = styled.p`
  margin: 6px 0 0;
  font-size: 11px;
  color: ${COLORS.text.secondary};
  line-height: 1.4;
`;

export const SummaryList = styled.ul`
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const SummaryItem = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${COLORS.text.primary};
  width: 100%;
`;

export const SummaryThumbnail = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
`;

export const SummaryBadge = styled.span`
  background: rgba(105, 48, 195, 0.15);
  color: ${COLORS.text.primary};
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 999px;
  flex-shrink: 0;
`;

export const SummaryItemLabel = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SummaryRemoveButton = styled.button`
  background: transparent;
  border: none;
  color: ${COLORS.text.secondary};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;

  &:hover {
    background: rgba(105, 48, 195, 0.12);
    color: ${COLORS.danger};
    transform: scale(1.02);
  }

  &:active {
    transform: scale(0.96);
  }
`;

// Simple stepper styles used in CreateOfferSection
export const StepperContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
`;

export const StepperLine = styled.div`
  flex: 1;
  height: 2px;
  background: rgba(105, 48, 195, 0.2);
`;

export const StepperStep = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: ${props => props.$active ? 1 : 0.5};
`;

export const StepperDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${COLORS.primary};
  box-shadow: 0 0 0 2px rgba(105, 48, 195, 0.15);
`;

export const StepperLabel = styled.span`
  font-size: 11px;
  color: ${COLORS.text.secondary};
`;

// Duration Selector
export const DurationSegmented = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  border: 2px solid rgba(105, 48, 195, 0.15);
  background: white;
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
  overflow: hidden;
  margin-top: 8px;
`;

export const DurationSegmentedThumb = styled.div`
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(25% - 3px);
  height: calc(100% - 8px);
  border-radius: 8px;
  background: ${COLORS.primary};
  box-shadow: 0 2px 8px rgba(105, 48, 195, 0.3);
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  pointer-events: none;
`;

export const DurationSegmentedOption = styled.button`
  position: relative;
  z-index: 1;
  flex: 1;
  height: 38px;
  border: 0;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  color: ${props => props.$active ? 'white' : COLORS.text.primary};
  transition: color 0.2s ease;
  font-family: 'Lexend', system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &:hover {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Token Selector Components (MON/LMON)
export const TokenSelectorContainer = styled.div`
  margin-bottom: 12px;
`;

export const TokenSelectorRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const TokenToggle = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  border: 2px solid rgba(105, 48, 195, 0.15);
  background: white;
  border-radius: 8px;
  padding: 3px;
  gap: 3px;
  width: fit-content;
  margin: 0 auto;
`;

export const TokenToggleThumb = styled.div`
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 2px);
  height: calc(100% - 6px);
  border-radius: 6px;
  background: ${COLORS.primary};
  box-shadow: 0 2px 8px rgba(105, 48, 195, 0.3);
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  pointer-events: none;
`;

export const TokenToggleButton = styled.button`
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 85px;
  height: 36px;
  border: 0;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  color: ${props => props.$active ? 'white' : COLORS.text.primary};
  transition: color 0.2s ease;
  font-family: 'Lexend', system-ui, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 10px;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const TokenLogo = styled.img`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
`;

export const TokenInputWrapper = styled.div`
  width: 100%;
  display: flex;
  gap: 8px;
  align-items: center;
  position: relative;
`;

export const TokenInput = styled(FormInput)`
  flex: 1;
  padding: 8px 12px;
  height: 38px;

  /* Remove number input arrows */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type=number] {
    -moz-appearance: textfield;
  }
`;

export const TokenBalance = styled.span`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: ${COLORS.text.secondary};
  opacity: ${props => props.$hasValue ? '0' : '0.5'};
  white-space: nowrap;
  font-weight: 500;
  pointer-events: none;
  transition: opacity 0.2s ease;
`;

export const AddTokenButton = styled.button`
  height: 38px;
  padding: 0 20px;
  background: transparent;
  color: ${COLORS.blue};
  border: 2px solid ${COLORS.blue};
  border-radius: 8px;
  font-weight: 600;
  font-size: 12px;
  font-family: 'Lexend', system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: ${COLORS.blue};
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    border-color: ${COLORS.text.secondary};
    color: ${COLORS.text.secondary};
  }
`;

export const TokenList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
`;

export const TokenItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(105, 48, 195, 0.05);
  border: 1px solid rgba(105, 48, 195, 0.1);
  border-radius: 8px;
  animation: ${fadeIn} 0.3s ease;
`;

export const TokenItemInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
`;

export const TokenItemAmount = styled.span`
  font-weight: 600;
  font-size: 14px;
  color: ${COLORS.text.primary};
`;

export const TokenItemSymbol = styled.span`
  font-size: 12px;
  color: ${COLORS.text.secondary};
  font-weight: 500;
`;

export const RemoveTokenButton = styled.button`
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(220, 38, 38, 0.1);
  color: ${COLORS.danger};
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  transition: all 0.2s ease;

  &:hover {
    background: ${COLORS.danger};
    color: white;
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`;
