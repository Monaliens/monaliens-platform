import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { Check, X, Copy, Search, Shield, ChevronDown, Lock, AlertTriangle, Info, Cpu, FileCode, Zap, Circle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useVerification } from './hooks/useVerification';
import { truncateHash, formatAmount, generateFinalSeed, calculateDrawnNumbers, getRiskLevelName, GRID_SIZE, DRAW_COUNT } from './utils/verifyUtils';

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const numberReveal = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.5) rotateY(180deg);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1) rotateY(90deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotateY(0deg);
  }
`;

const formulaSlide = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

// Styled Components
const PageContainer = styled.div`
  min-height: 100vh;
  padding: 2rem;
  animation: ${fadeIn} 0.5s ease-out;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const ContentWrapper = styled.div`
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 0.5rem;
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;

  svg {
    color: var(--accent-primary);
  }
`;

const Subtitle = styled.p`
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0;
`;

const Card = styled.div`
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 15px var(--shadow-color);
`;

const SearchCard = styled(Card)`
  display: flex;
  gap: 12px;
  align-items: center;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Input = styled.input`
  flex: 1;
  padding: 12px 16px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  font-size: 15px;
  font-family: 'Lexend', system-ui, sans-serif;
  background: var(--input-bg);
  color: var(--text-primary);
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--shadow-color);
  }

  &::placeholder {
    color: var(--placeholder-color);
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--accent-primary);
  color: var(--text-light);
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  font-family: 'Lexend', system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--accent-primary-hover);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    width: 100%;
    justify-content: center;
  }
`;

const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--text-light);
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const SectionTitle = styled.h3`
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 1rem 0;
`;

const SeedRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);

  &:last-child {
    border-bottom: none;
  }
`;

const SeedLabel = styled.span`
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
`;

const SeedValue = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const HashValue = styled.code`
  font-size: 0.8rem;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
`;

const CopyButton = styled.button`
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.2s;

  &:hover {
    color: var(--accent-primary);
  }
`;

const ExternalLinkButton = styled.a`
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
  text-decoration: none;

  &:hover {
    color: #8b5cf6;
  }
`;

const VerificationBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: ${props => props.$valid ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)'};
  color: ${props => props.$valid ? '#16a34a' : '#dc2626'};
`;

const GameSummary = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 500px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const SummaryItem = styled.div`
  text-align: center;
  padding: 10px 6px;
  background: var(--bg-tertiary);
  border-radius: 8px;

  .label {
    font-size: 0.65rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 4px;
    white-space: nowrap;
  }

  .value {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .result {
    color: ${props => props.$won ? '#16a34a' : '#dc2626'};
  }
`;

const ErrorMessage = styled.div`
  padding: 16px;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.9rem;
  text-align: center;
`;

// Keno Grid
const KenoGridContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const KenoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  max-width: 500px;
  width: 100%;

  @media (max-width: 500px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;

const KenoNumber = styled.div`
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  position: relative;
  background: ${props => {
    if (props.$isHit) return 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)';
    if (props.$isDrawn) return 'linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%)';
    if (props.$isSelected) return 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)';
    return 'var(--bg-secondary)';
  }};
  color: ${props => (props.$isHit || props.$isDrawn || props.$isSelected) ? 'var(--text-light)' : 'var(--text-secondary)'};
  border: 2px solid ${props => {
    if (props.$isHit) return '#16a34a';
    if (props.$isDrawn) return '#6930c3';
    if (props.$isSelected) return '#ea580c';
    return 'var(--border-light)';
  }};
  animation: ${numberReveal} 0.4s ease-out;
  animation-delay: ${props => props.$delay || '0s'};
  animation-fill-mode: both;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: default;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px var(--shadow-color);
  }
`;

const DrawOrder = styled.div`
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #6930c3;
  color: white;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-card);
`;

const GridLegend = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  flex-wrap: wrap;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: '';
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background: ${props => props.$color};
  }
`;

// Draw Sequence
const DrawSequence = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 12px;
`;

const DrawBall = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  background: ${props => props.$isHit
    ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
    : 'linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%)'};
  color: white;
  box-shadow: 0 2px 8px rgba(105, 48, 195, 0.3);
  animation: ${numberReveal} 0.4s ease-out;
  animation-delay: ${props => props.$delay || '0s'};
  animation-fill-mode: both;
`;

// Accordion
const AccordionHeader = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
`;

const AccordionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const AccordionContent = styled.div`
  margin-top: 1.5rem;
  display: ${props => props.$open ? 'block' : 'none'};
`;

const ChevronIcon = styled.span`
  transition: transform 0.2s ease;
  transform: ${props => props.$open ? 'rotate(180deg)' : 'rotate(0deg)'};
  color: var(--accent-primary);
`;

// How It Works Section
const HowItWorksCard = styled(Card)`
  background: var(--bg-glass-gradient);
`;

const SubSection = styled.div`
  margin-bottom: 1.5rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SubTitle = styled.h4`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Formula = styled.div`
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 12px 16px;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 0.8rem;
  color: var(--text-primary);
  overflow-x: auto;
  margin-bottom: 8px;

  .comment {
    color: var(--text-secondary);
    font-style: italic;
  }

  .highlight {
    color: var(--accent-primary);
    font-weight: 600;
  }
`;

const SecurityBox = styled.div`
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 8px;
`;

const SecurityTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent-primary);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SecurityText = styled.div`
  font-size: 0.8rem;
  color: var(--text-primary);
  line-height: 1.6;
`;

const WarningBox = styled.div`
  background: rgba(220, 38, 38, 0.05);
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 8px;
`;

const WarningTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: #dc2626;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

// Sequence Diagram Styles
const SequenceDiagram = styled.div`
  margin: 1rem 0;
  overflow-x: auto;
`;

const SequenceHeader = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 8px;
  min-width: 500px;
`;

const ActorBox = styled.div`
  text-align: center;
  padding: 10px 8px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  background: ${props => props.$bg || 'var(--bg-tertiary)'};
  color: ${props => props.$color || 'var(--accent-primary)'};
`;

const SequenceBody = styled.div`
  position: relative;
  min-width: 500px;
`;

const SequenceLines = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

const VerticalLine = styled.div`
  width: 2px;
  background: ${props => props.$color || 'var(--border-light)'};
  margin: 0 auto;
  height: 100%;
`;

const SequenceSteps = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
`;

const SequenceStep = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 32px;
`;

const ArrowCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  grid-column: ${props => `${props.$from} / ${props.$to + 1}`};
  margin-left: calc((100% / ${props => props.$to - props.$from + 1}) / 2);
  margin-right: calc((100% / ${props => props.$to - props.$from + 1}) / 2);
`;

const Arrow = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  position: relative;
  flex-direction: ${props => props.$reverse ? 'row-reverse' : 'row'};

  &::before {
    content: '';
    flex: 1;
    height: 2px;
    background: ${props => props.$color || 'var(--accent-primary)'};
  }

  &::after {
    content: '';
    width: 0;
    height: 0;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    ${props => props.$reverse
      ? `border-right: 8px solid ${props.$color || 'var(--accent-primary)'};`
      : `border-left: 8px solid ${props.$color || 'var(--accent-primary)'};`
    }
  }
`;

const ArrowLabel = styled.div`
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  background: var(--bg-primary);
  padding: 2px 6px;
  border-radius: 4px;
`;

const StepNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${props => props.$color || 'var(--accent-primary)'};
  color: var(--text-light);
  font-size: 0.65rem;
  font-weight: 700;
  margin-right: 4px;
`;

// Live Calculation Components
const LiveCalcInputSection = styled.div`
  background: var(--bg-glass-gradient);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 20px;
`;

const InputGroup = styled.div`
  margin-bottom: 16px;

  &:last-of-type {
    margin-bottom: 0;
  }
`;

const InputLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent-primary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;

  svg {
    opacity: 0.7;
  }
`;

const StyledInput = styled(Input)`
  background: var(--input-bg);
  border: 2px solid var(--input-border);
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 0.85rem;
  padding: 12px 14px;
  transition: all 0.2s ease;

  &:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--shadow-color);
  }

  &::placeholder {
    color: var(--placeholder-color);
  }
`;

const InputRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-top: 16px;
  flex-wrap: wrap;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const CalculateButton = styled(Button)`
  background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%);
  border: none;
  padding: 12px 24px;
  font-size: 0.9rem;
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #5a28a8 0%, #6930c3 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(105, 48, 195, 0.4);
  }

  @media (max-width: 600px) {
    margin-left: 0;
  }
`;

const LiveResultsContainer = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px dashed var(--border-light);
  animation: ${fadeIn} 0.3s ease-out;
`;

const FormulaStep = styled.div`
  margin-bottom: 16px;
  animation: ${formulaSlide} 0.4s ease-out;
  animation-delay: ${props => props.$delay || '0s'};
  animation-fill-mode: both;
`;

const FormulaLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent-primary);
  margin-bottom: 8px;

  &::before {
    content: '';
    width: 4px;
    height: 16px;
    background: linear-gradient(180deg, var(--accent-primary), #8b5cf6);
    border-radius: 2px;
  }
`;

const LiveKenoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  max-width: 400px;
  margin: 0 auto;

  @media (max-width: 500px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;

const LiveNumber = styled.div`
  aspect-ratio: 1;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  position: relative;
  background: ${props => props.$isDrawn
    ? 'linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%)'
    : 'var(--bg-tertiary)'};
  color: ${props => props.$isDrawn ? 'white' : 'var(--text-secondary)'};
  border: 2px solid ${props => props.$isDrawn ? '#6930c3' : 'var(--border-light)'};
  animation: ${numberReveal} 0.4s ease-out;
  animation-delay: ${props => props.$delay || '0s'};
  animation-fill-mode: both;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
`;

const LiveDrawOrder = styled.div`
  position: absolute;
  top: -5px;
  right: -5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ea580c;
  color: white;
  font-size: 0.55rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const KenoVerifyPage = () => {
  const { gameId: urlGameId } = useParams();
  const navigate = useNavigate();
  const [inputGameId, setInputGameId] = useState(urlGameId || '');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [liveCalcOpen, setLiveCalcOpen] = useState(false);
  const [customRandomSeed, setCustomRandomSeed] = useState('');
  const [liveResults, setLiveResults] = useState(null);

  // Live Verification state
  const [liveVerifyOpen, setLiveVerifyOpen] = useState(false);
  const [verifyRandomSeed, setVerifyRandomSeed] = useState('');
  const [selectedDrawnNumbers, setSelectedDrawnNumbers] = useState(new Set());
  const [verifyResults, setVerifyResults] = useState(null);

  const {
    loading,
    error,
    gameData,
    verification,
    verify
  } = useVerification();

  // Auto-verify if gameId in URL
  useEffect(() => {
    if (urlGameId) {
      setInputGameId(urlGameId);
      verify(urlGameId);
    }
  }, [urlGameId, verify]);

  // Set default values for live calc when gameData loads
  useEffect(() => {
    if (gameData?.random_number) {
      setCustomRandomSeed(gameData.random_number);
      setVerifyRandomSeed(gameData.random_number);
    }
  }, [gameData]);

  // Set default drawn numbers for Live Verification when verification data loads
  useEffect(() => {
    if (verification?.calculatedDrawnNumbers) {
      setSelectedDrawnNumbers(new Set(verification.calculatedDrawnNumbers));
    }
  }, [verification]);

  // Live calculation function
  const runLiveCalculation = () => {
    if (!customRandomSeed) {
      toast.error('Please enter Random Seed');
      return;
    }

    try {
      const finalSeed = generateFinalSeed(customRandomSeed);
      const drawnNumbers = calculateDrawnNumbers(customRandomSeed);

      setLiveResults({ finalSeed, drawnNumbers });
    } catch (err) {
      toast.error('Invalid seed format');
    }
  };

  // Live Verification function
  const runLiveVerification = () => {
    if (!verifyRandomSeed) {
      toast.error('Please enter Random Seed');
      return;
    }

    if (selectedDrawnNumbers.size !== DRAW_COUNT) {
      toast.error(`Please select exactly ${DRAW_COUNT} drawn numbers`);
      return;
    }

    try {
      const finalSeed = generateFinalSeed(verifyRandomSeed);
      const expectedDrawn = calculateDrawnNumbers(verifyRandomSeed);
      const expectedSet = new Set(expectedDrawn);

      // Compare selected with expected
      const correctNumbers = [...selectedDrawnNumbers].filter(n => expectedSet.has(n));
      const wrongNumbers = [...selectedDrawnNumbers].filter(n => !expectedSet.has(n));
      const missedNumbers = expectedDrawn.filter(n => !selectedDrawnNumbers.has(n));

      const allMatch = wrongNumbers.length === 0 && missedNumbers.length === 0;

      setVerifyResults({
        finalSeed,
        expectedDrawn,
        selectedDrawn: [...selectedDrawnNumbers],
        correctNumbers,
        wrongNumbers,
        missedNumbers,
        allMatch
      });

      if (allMatch) {
        toast.success('All drawn numbers verified successfully!');
      } else {
        toast.error('Drawn numbers mismatch! Verification failed.');
      }
    } catch (err) {
      toast.error('Invalid seed format');
    }
  };

  // Toggle drawn number selection
  const toggleDrawnSelection = (num) => {
    const newSelected = new Set(selectedDrawnNumbers);
    if (newSelected.has(num)) {
      newSelected.delete(num);
    } else {
      if (newSelected.size < DRAW_COUNT) {
        newSelected.add(num);
      } else {
        toast.error(`Maximum ${DRAW_COUNT} numbers can be selected`);
        return;
      }
    }
    setSelectedDrawnNumbers(newSelected);
    setVerifyResults(null);
  };

  const handleVerify = () => {
    if (!inputGameId.trim()) {
      toast.error('Please enter a game ID');
      return;
    }

    navigate(`/keno/verify/${inputGameId.trim()}`);
    verify(inputGameId.trim());
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const selectedSet = new Set(gameData?.selected_numbers || []);

  return (
    <PageContainer>
      <ContentWrapper>
        <div>
          <Header>
            <Title>
              <Shield size={28} />
              Keno Provably Fair Verification
            </Title>
          </Header>
          <Subtitle>
            Verify the fairness of any completed Keno game using cryptographic proofs
          </Subtitle>
        </div>

        <SearchCard>
          <Input
            type="text"
            placeholder="Enter Game ID (e.g., 100)"
            value={inputGameId}
            onChange={(e) => setInputGameId(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <Button onClick={handleVerify} disabled={loading}>
            {loading ? (
              <>
                <LoadingSpinner />
                Verifying...
              </>
            ) : (
              <>
                <Search size={18} />
                Verify Game
              </>
            )}
          </Button>
        </SearchCard>

        {error && (
          <ErrorMessage>{error}</ErrorMessage>
        )}

        {verification && gameData && (
          <>
            <Card>
              <SectionTitle>Game Summary</SectionTitle>
              <GameSummary>
                <SummaryItem>
                  <div className="label">Game ID</div>
                  <div className="value">{gameData.game_id}</div>
                </SummaryItem>
                <SummaryItem $won={gameData.won}>
                  <div className="label">Result</div>
                  <div className="value result">{gameData.won ? 'WIN' : 'LOSE'}</div>
                </SummaryItem>
                <SummaryItem>
                  <div className="label">Bet</div>
                  <div className="value">{formatAmount(gameData.bet_amount)} MON</div>
                </SummaryItem>
                <SummaryItem>
                  <div className="label">Payout</div>
                  <div className="value">{formatAmount(gameData.payout)} MON</div>
                </SummaryItem>
                <SummaryItem>
                  <div className="label">Hits</div>
                  <div className="value">{gameData.hits}/{gameData.selected_numbers?.length}</div>
                </SummaryItem>
                <SummaryItem>
                  <div className="label">Risk</div>
                  <div className="value">{getRiskLevelName(gameData.risk_level)}</div>
                </SummaryItem>
              </GameSummary>
            </Card>

            <Card>
              <SectionTitle>Random Seed (Pyth Entropy VRF)</SectionTitle>

              <SeedRow>
                <SeedLabel>Random Number</SeedLabel>
                <SeedValue>
                  <HashValue>{truncateHash(gameData.random_number)}</HashValue>
                  <CopyButton onClick={() => copyToClipboard(gameData.random_number, 'Random Number')}>
                    <Copy size={14} />
                  </CopyButton>
                  {gameData.sequence_number && (
                    <ExternalLinkButton
                      href={`https://entropy-explorer.pyth.network/?search=${gameData.sequence_number}&chain=monad`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View on Pyth Entropy Explorer"
                    >
                      <ExternalLink size={14} />
                    </ExternalLinkButton>
                  )}
                </SeedValue>
              </SeedRow>

              {gameData.start_tx_hash && (
                <SeedRow>
                  <SeedLabel>Submit TX</SeedLabel>
                  <SeedValue>
                    <HashValue>{truncateHash(gameData.start_tx_hash)}</HashValue>
                    <ExternalLinkButton
                      href={`https://monadexplorer.com/tx/${gameData.start_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View on Explorer"
                    >
                      <ExternalLink size={14} />
                    </ExternalLinkButton>
                  </SeedValue>
                </SeedRow>
              )}

              {gameData.result_tx_hash && (
                <SeedRow>
                  <SeedLabel>Callback TX</SeedLabel>
                  <SeedValue>
                    <HashValue>{truncateHash(gameData.result_tx_hash)}</HashValue>
                    <ExternalLinkButton
                      href={`https://monadexplorer.com/tx/${gameData.result_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View on Explorer"
                    >
                      <ExternalLink size={14} />
                    </ExternalLinkButton>
                  </SeedValue>
                </SeedRow>
              )}

              <SeedRow>
                <SeedLabel>Numbers Verified</SeedLabel>
                <SeedValue>
                  <VerificationBadge $valid={verification.allNumbersVerified}>
                    {verification.allNumbersVerified ? (
                      <><Check size={12} /> Verified</>
                    ) : (
                      <><X size={12} /> Invalid</>
                    )}
                  </VerificationBadge>
                </SeedValue>
              </SeedRow>
            </Card>

            <Card>
              <SectionTitle>Draw Verification</SectionTitle>
              <KenoGridContainer>
                {/* Draw Sequence */}
                <div style={{ width: '100%', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                    Draw Order (1-10)
                  </div>
                  <DrawSequence>
                    {verification.calculatedDrawnNumbers.map((num, idx) => (
                      <DrawBall
                        key={idx}
                        $isHit={selectedSet.has(num)}
                        $delay={`${idx * 0.1}s`}
                      >
                        {num}
                      </DrawBall>
                    ))}
                  </DrawSequence>
                </div>

                {/* Full Grid */}
                <KenoGrid>
                  {verification.grid.map((cell, idx) => (
                    <KenoNumber
                      key={idx}
                      $isHit={cell.isHit}
                      $isDrawn={cell.isCalculatedDrawn && !cell.isHit}
                      $isSelected={cell.isSelected && !cell.isHit}
                      $delay={`${idx * 0.02}s`}
                    >
                      {cell.number}
                      {cell.drawOrder && <DrawOrder>{cell.drawOrder}</DrawOrder>}
                    </KenoNumber>
                  ))}
                </KenoGrid>

                <GridLegend>
                  <LegendItem $color="linear-gradient(135deg, #16a34a, #15803d)">Hit (Selected & Drawn)</LegendItem>
                  <LegendItem $color="linear-gradient(135deg, #6930c3, #8b5cf6)">Drawn</LegendItem>
                  <LegendItem $color="linear-gradient(135deg, #ea580c, #dc2626)">Selected (Miss)</LegendItem>
                </GridLegend>

                <div style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: '600', marginTop: '8px' }}>
                  {verification.allNumbersVerified ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={16} /> All {DRAW_COUNT} drawn numbers verified
                    </span>
                  ) : (
                    <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <X size={16} /> Drawn numbers mismatch
                    </span>
                  )}
                </div>
              </KenoGridContainer>
            </Card>

            {/* Live Calculation Section */}
            <Card>
              <AccordionHeader onClick={() => setLiveCalcOpen(!liveCalcOpen)}>
                <AccordionTitle>
                  <Cpu size={20} />
                  Try It Yourself - Live Calculation
                </AccordionTitle>
                <ChevronIcon $open={liveCalcOpen}>
                  <ChevronDown size={20} />
                </ChevronIcon>
              </AccordionHeader>

              <AccordionContent $open={liveCalcOpen}>
                <LiveCalcInputSection>
                  <InputGroup>
                    <InputLabel>
                      <Zap size={14} />
                      Random Seed (bytes32)
                    </InputLabel>
                    <StyledInput
                      value={customRandomSeed}
                      onChange={(e) => { setCustomRandomSeed(e.target.value); setLiveResults(null); }}
                      placeholder="0x49bd837900b98c58...enter random seed from API"
                    />
                  </InputGroup>
                  <InputRow>
                    <CalculateButton onClick={runLiveCalculation}>
                      <Cpu size={18} />
                      Calculate Draw
                    </CalculateButton>
                  </InputRow>
                </LiveCalcInputSection>

                {liveResults && (
                  <LiveResultsContainer key={liveResults.finalSeed}>
                    <FormulaStep $delay="0s">
                      <FormulaLabel>Fisher-Yates Shuffle → Draw [{liveResults.drawnNumbers.join(', ')}]</FormulaLabel>
                      <LiveKenoGrid>
                        {Array.from({ length: GRID_SIZE }, (_, i) => {
                          const num = i + 1;
                          const drawIndex = liveResults.drawnNumbers.indexOf(num);
                          const isDrawn = drawIndex !== -1;
                          return (
                            <LiveNumber
                              key={i}
                              $isDrawn={isDrawn}
                              $delay={`${0.5 + i * 0.02}s`}
                            >
                              {num}
                              {isDrawn && <LiveDrawOrder>{drawIndex + 1}</LiveDrawOrder>}
                            </LiveNumber>
                          );
                        })}
                      </LiveKenoGrid>
                    </FormulaStep>
                  </LiveResultsContainer>
                )}
              </AccordionContent>
            </Card>

            {/* Live Verification Section */}
            <Card>
              <AccordionHeader onClick={() => setLiveVerifyOpen(!liveVerifyOpen)}>
                <AccordionTitle>
                  <Shield size={20} />
                  Try It Yourself - Live Verification
                </AccordionTitle>
                <ChevronIcon $open={liveVerifyOpen}>
                  <ChevronDown size={20} />
                </ChevronIcon>
              </AccordionHeader>

              <AccordionContent $open={liveVerifyOpen}>
                <LiveCalcInputSection>
                  <InputGroup>
                    <InputLabel>
                      <Zap size={14} />
                      Random Seed (bytes32)
                    </InputLabel>
                    <StyledInput
                      value={verifyRandomSeed}
                      onChange={(e) => { setVerifyRandomSeed(e.target.value); setVerifyResults(null); }}
                      placeholder="0x49bd837900b98c58...enter random seed from API"
                    />
                  </InputGroup>

                  <div style={{ marginTop: '20px' }}>
                    <InputLabel style={{ marginBottom: '8px' }}>
                      <Circle size={14} />
                      Select Drawn Numbers ({selectedDrawnNumbers.size}/{DRAW_COUNT})
                    </InputLabel>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      Click numbers to mark them as drawn. The positions are pre-filled from the game data.
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(8, 1fr)',
                      gap: '6px',
                      maxWidth: '400px',
                      margin: '0 auto'
                    }}>
                      {Array.from({ length: GRID_SIZE }, (_, i) => {
                        const num = i + 1;
                        const isSelected = selectedDrawnNumbers.has(num);
                        const isCorrect = verifyResults?.correctNumbers?.includes(num);
                        const isWrong = verifyResults?.wrongNumbers?.includes(num);
                        const isMissed = verifyResults?.missedNumbers?.includes(num);

                        let bgColor = 'var(--bg-card)';
                        let borderColor = 'rgba(105, 48, 195, 0.2)';

                        if (verifyResults) {
                          if (isCorrect) {
                            bgColor = 'rgba(22, 163, 74, 0.2)';
                            borderColor = '#16a34a';
                          } else if (isWrong) {
                            bgColor = 'rgba(220, 38, 38, 0.2)';
                            borderColor = '#dc2626';
                          } else if (isMissed) {
                            bgColor = 'rgba(249, 115, 22, 0.2)';
                            borderColor = '#f97316';
                          }
                        } else if (isSelected) {
                          bgColor = 'rgba(105, 48, 195, 0.15)';
                          borderColor = '#6930c3';
                        }

                        return (
                          <div
                            key={i}
                            onClick={() => !verifyResults && toggleDrawnSelection(num)}
                            style={{
                              width: '40px',
                              height: '40px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: bgColor,
                              border: `2px solid ${borderColor}`,
                              borderRadius: '6px',
                              cursor: verifyResults ? 'default' : 'pointer',
                              transition: 'all 0.2s ease',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              color: isSelected || isCorrect || isWrong || isMissed ? 'var(--text-primary)' : 'var(--text-tertiary)'
                            }}
                          >
                            {num}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', fontSize: '0.7rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '12px', height: '12px', background: 'rgba(105, 48, 195, 0.15)', border: '2px solid #6930c3', borderRadius: '3px' }}></span>
                        Selected
                      </span>
                      {verifyResults && (
                        <>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '12px', height: '12px', background: 'rgba(22, 163, 74, 0.2)', border: '2px solid #16a34a', borderRadius: '3px' }}></span>
                            Correct
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '12px', height: '12px', background: 'rgba(220, 38, 38, 0.2)', border: '2px solid #dc2626', borderRadius: '3px' }}></span>
                            Wrong
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '12px', height: '12px', background: 'rgba(249, 115, 22, 0.2)', border: '2px solid #f97316', borderRadius: '3px' }}></span>
                            Missed
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <CalculateButton onClick={runLiveVerification}>
                      <Shield size={18} />
                      Verify Drawn Numbers
                    </CalculateButton>
                    {verifyResults && (
                      <Button
                        onClick={() => {
                          setVerifyResults(null);
                          if (verification?.calculatedDrawnNumbers) {
                            setSelectedDrawnNumbers(new Set(verification.calculatedDrawnNumbers));
                          }
                        }}
                        style={{ background: 'transparent', color: '#6930c3', border: '2px solid #6930c3' }}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </LiveCalcInputSection>

                {verifyResults && (
                  <LiveResultsContainer>
                    <FormulaStep $delay="0s">
                      <FormulaLabel>
                        {verifyResults.allMatch ? (
                          <span style={{ color: '#16a34a' }}>All Drawn Numbers Verified Successfully</span>
                        ) : (
                          <span style={{ color: '#dc2626' }}>Verification Failed - Number Mismatch Detected</span>
                        )}
                      </FormulaLabel>

                      <div style={{
                        background: verifyResults.allMatch ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                        border: `2px solid ${verifyResults.allMatch ? 'rgba(22, 163, 74, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`,
                        borderRadius: '10px',
                        padding: '16px',
                        marginTop: '12px'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.85rem' }}>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Your Selection:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {verifyResults.selectedDrawn.sort((a, b) => a - b).map(num => (
                                <span key={num} style={{
                                  padding: '4px 10px',
                                  background: verifyResults.correctNumbers.includes(num) ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                                  color: verifyResults.correctNumbers.includes(num) ? '#16a34a' : '#dc2626',
                                  borderRadius: '6px',
                                  fontWeight: '600',
                                  fontSize: '0.8rem'
                                }}>
                                  {num}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Expected:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {verifyResults.expectedDrawn.map((num, idx) => (
                                <span key={num} style={{
                                  padding: '4px 10px',
                                  background: 'rgba(105, 48, 195, 0.1)',
                                  color: '#6930c3',
                                  borderRadius: '6px',
                                  fontWeight: '600',
                                  fontSize: '0.8rem'
                                }}>
                                  #{idx + 1}: {num}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {!verifyResults.allMatch && (
                          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(220, 38, 38, 0.2)' }}>
                            {verifyResults.wrongNumbers.length > 0 && (
                              <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '8px' }}>
                                <strong>Wrong numbers:</strong> {verifyResults.wrongNumbers.join(', ')} (you selected but not actually drawn)
                              </div>
                            )}
                            {verifyResults.missedNumbers.length > 0 && (
                              <div style={{ color: '#f97316', fontSize: '0.8rem' }}>
                                <strong>Missed numbers:</strong> {verifyResults.missedNumbers.join(', ')} (actually drawn but you didn't select)
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {!verifyResults.allMatch && (
                        <WarningBox style={{ marginTop: '16px' }}>
                          <WarningTitle><AlertTriangle size={14} /> Numbers Don't Match</WarningTitle>
                          <SecurityText>
                            The contract <strong>wouldn't generate these numbers</strong> with this random seed.
                            The Fisher-Yates algorithm produces a deterministic result - given the same random number, it always outputs the same draw sequence.
                          </SecurityText>
                        </WarningBox>
                      )}
                    </FormulaStep>
                  </LiveResultsContainer>
                )}
              </AccordionContent>
            </Card>

            {/* How It Works Section */}
            <HowItWorksCard>
              <AccordionHeader onClick={() => setHowItWorksOpen(!howItWorksOpen)}>
                <AccordionTitle>
                  <Info size={20} />
                  How Provably Fair Works
                </AccordionTitle>
                <ChevronIcon $open={howItWorksOpen}>
                  <ChevronDown size={20} />
                </ChevronIcon>
              </AccordionHeader>

              <AccordionContent $open={howItWorksOpen}>
                {/* Sequence Diagram */}
                <SubSection>
                  <SubTitle>
                    <Zap size={16} />
                    Game Flow
                  </SubTitle>
                  <SequenceDiagram>
                    <SequenceHeader>
                      <ActorBox $bg="rgba(37, 99, 235, 0.1)" $color="#2563eb">PLAYER</ActorBox>
                      <ActorBox $bg="rgba(105, 48, 195, 0.1)" $color="#6930c3">CONTRACT</ActorBox>
                      <ActorBox $bg="rgba(139, 92, 246, 0.1)" $color="#8b5cf6">PYTH ENTROPY</ActorBox>
                    </SequenceHeader>
                    <SequenceBody>
                      <SequenceLines>
                        <VerticalLine $color="rgba(37, 99, 235, 0.2)" />
                        <VerticalLine $color="rgba(105, 48, 195, 0.2)" />
                        <VerticalLine $color="rgba(139, 92, 246, 0.2)" />
                      </SequenceLines>
                      <SequenceSteps>
                        {/* Submit TX */}
                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#2563eb', textAlign: 'center', padding: '4px 0', background: 'rgba(37, 99, 235, 0.08)', borderRadius: '4px', marginBottom: '4px' }}>
                          SUBMIT TX
                        </div>
                        <SequenceStep>
                          <ArrowCell $from={1} $to={2}>
                            <Arrow $color="#2563eb" />
                            <ArrowLabel><StepNumber $color="#2563eb">1</StepNumber>play(numbers, risk) + bet + fee</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#6930c3" />
                            <ArrowLabel><StepNumber $color="#6930c3">2</StepNumber>requestV2()</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>

                        {/* Callback TX */}
                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#8b5cf6', textAlign: 'center', padding: '4px 0', background: 'rgba(139, 92, 246, 0.08)', borderRadius: '4px', margin: '8px 0 4px 0' }}>
                          CALLBACK TX
                        </div>
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#8b5cf6" $reverse />
                            <ArrowLabel><StepNumber $color="#8b5cf6">3</StepNumber>entropyCallback(randomNumber)</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={1} $to={2}>
                            <Arrow $color="#6930c3" $reverse />
                            <ArrowLabel><StepNumber $color="#6930c3">4</StepNumber>_drawNumbers() → payout</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                      </SequenceSteps>
                    </SequenceBody>
                  </SequenceDiagram>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.6' }}>
                    <strong>Key:</strong> Keno uses pure on-chain VRF - no backend involvement!
                    Pyth Entropy provides the random number directly to the contract via callback.
                  </div>
                </SubSection>

                {/* Algorithm */}
                <SubSection>
                  <SubTitle>
                    <Cpu size={16} />
                    Draw Generation Algorithm
                  </SubTitle>
                  <Formula>
                    <span className="comment">// Contract receives randomNumber from Pyth Entropy callback</span><br/>
                    <span className="comment">// Fisher-Yates shuffle to select 10 numbers from 1-40</span><br/><br/>
                    for i = 0 to 9:<br/>
                    &nbsp;&nbsp;hash = keccak256(<span className="highlight">randomNumber</span>, i)<br/>
                    &nbsp;&nbsp;j = i + (hash % (40 - i))<br/>
                    &nbsp;&nbsp;swap(pool[i], pool[j])<br/>
                    &nbsp;&nbsp;drawn[i] = pool[i]<br/><br/>
                    <span className="highlight">drawnNumbers</span> = drawn[0..9]
                  </Formula>
                  <SecurityBox>
                    <SecurityTitle><Lock size={14} /> Pure On-Chain Randomness</SecurityTitle>
                    <SecurityText>
                      Keno uses Pyth Network's Entropy service for randomness:
                      <br/>• <strong>Pyth Entropy</strong> - Trusted VRF provider, generates unpredictable random numbers
                      <br/>• <strong>Direct Callback</strong> - Random number goes directly to contract, no backend intermediary
                      <br/>• <strong>Deterministic Draw</strong> - Same random seed always produces same draw via Fisher-Yates
                    </SecurityText>
                  </SecurityBox>
                </SubSection>

                {/* Security */}
                <SubSection>
                  <SubTitle>
                    <Lock size={16} />
                    Why This Is Provably Fair
                  </SubTitle>
                  <SecurityBox>
                    <SecurityTitle><Check size={14} /> VRF from Pyth Network</SecurityTitle>
                    <SecurityText>
                      Pyth Entropy is a trusted Verifiable Random Function (VRF) service.
                      The random number is cryptographically secure and cannot be predicted or manipulated.
                    </SecurityText>
                  </SecurityBox>
                  <SecurityBox>
                    <SecurityTitle><Check size={14} /> Deterministic Draw</SecurityTitle>
                    <SecurityText>
                      The Fisher-Yates shuffle is completely deterministic - given the same random seed, it always produces the same draw.
                      Anyone can verify the result by running the same algorithm with the random_number from API.
                    </SecurityText>
                  </SecurityBox>
                </SubSection>

                {/* Contract Code */}
                <SubSection>
                  <SubTitle>
                    <Shield size={16} />
                    Smart Contract Code (Solidity)
                  </SubTitle>
                  <Formula>
                    <span className="comment">// Contract: entropyCallback() - Called by Pyth when VRF arrives</span><br/><br/>
                    function entropyCallback(<br/>
                    &nbsp;&nbsp;uint64 sequenceNumber,<br/>
                    &nbsp;&nbsp;address provider,<br/>
                    &nbsp;&nbsp;bytes32 <span className="highlight">randomNumber</span><br/>
                    ) internal {'{'}<br/>
                    &nbsp;&nbsp;<span className="comment">// Draw 10 numbers using the random seed</span><br/>
                    &nbsp;&nbsp;uint8[10] memory drawnNumbers = <span className="highlight">_drawNumbers(randomNumber)</span>;<br/>
                    &nbsp;&nbsp;<br/>
                    &nbsp;&nbsp;<span className="comment">// Count hits and calculate payout</span><br/>
                    &nbsp;&nbsp;uint8 hits = _countHits(selectedNumbers, drawnNumbers);<br/>
                    &nbsp;&nbsp;uint256 payout = _calculatePayout(betAmount, hits, riskLevel);<br/>
                    {'}'}
                  </Formula>
                  <Formula style={{ marginTop: '12px' }}>
                    <span className="comment">// Contract: _drawNumbers() - Fisher-Yates shuffle</span><br/><br/>
                    function <span className="highlight">_drawNumbers</span>(bytes32 random)<br/>
                    &nbsp;&nbsp;internal pure returns (uint8[10] memory) {'{'}<br/><br/>
                    &nbsp;&nbsp;<span className="comment">// Create pool [1, 2, 3, ..., 40]</span><br/>
                    &nbsp;&nbsp;uint8[40] memory pool;<br/>
                    &nbsp;&nbsp;for (uint8 i = 0; i &lt; 40; i++) pool[i] = i + 1;<br/><br/>
                    &nbsp;&nbsp;uint8[10] memory drawn;<br/><br/>
                    &nbsp;&nbsp;<span className="comment">// Fisher-Yates shuffle</span><br/>
                    &nbsp;&nbsp;for (uint8 i = 0; i &lt; 10; i++) {'{'}<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;uint256 randomIndex = uint256(keccak256(<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;abi.encodePacked(<span className="highlight">random</span>, i)<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;));<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;uint8 j = i + uint8(randomIndex % (40 - i));<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="comment">// Swap pool[i] and pool[j]</span><br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;uint8 temp = pool[i];<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;pool[i] = pool[j];<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;pool[j] = temp;<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;drawn[i] = pool[i];<br/>
                    &nbsp;&nbsp;{'}'}<br/>
                    &nbsp;&nbsp;return drawn;<br/>
                    {'}'}
                  </Formula>
                </SubSection>

                {/* Verify Yourself */}
                <SubSection>
                  <SubTitle>
                    <FileCode size={16} />
                    Verify It Yourself (JavaScript)
                  </SubTitle>
                  <Formula>
                    <span className="comment">// JavaScript verification (matches contract exactly)</span><br/>
                    import {'{ keccak256, encodePacked }'} from 'viem';<br/><br/>
                    function calculateDrawnNumbers(<span className="highlight">randomNumber</span>) {'{'}<br/>
                    &nbsp;&nbsp;const pool = Array.from({'{ length: 40 }'}, (_, i) =&gt; i + 1);<br/>
                    &nbsp;&nbsp;const drawn = [];<br/><br/>
                    &nbsp;&nbsp;for (let i = 0; i &lt; 10; i++) {'{'}<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;const hash = keccak256(encodePacked(<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;['bytes32', 'uint8'],<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[<span className="highlight">randomNumber</span>, i]<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;));<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;const j = i + Number(BigInt(hash) % BigInt(40 - i));<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;[pool[i], pool[j]] = [pool[j], pool[i]]; <span className="comment">// Swap</span><br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;drawn.push(pool[i]);<br/>
                    &nbsp;&nbsp;{'}'}<br/>
                    &nbsp;&nbsp;return drawn;<br/>
                    {'}'}
                  </Formula>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: '1.6' }}>
                    <strong>Tip:</strong> Get the <code>random_number</code> from the API response and verify the drawn numbers match!
                  </div>
                </SubSection>
              </AccordionContent>
            </HowItWorksCard>
          </>
        )}
      </ContentWrapper>
    </PageContainer>
  );
};

export default KenoVerifyPage;
