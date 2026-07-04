import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { Check, X, Copy, Search, Shield, ChevronDown, Lock, AlertTriangle, Info, Cpu, Globe, FileCode, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useVerification } from './hooks/useVerification';
import { cardToDisplay, truncateHash, generateFinalSeed, generateCard } from './utils/verifyUtils';

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const cardReveal = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.3) rotateY(180deg);
  }
  50% {
    opacity: 0.5;
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

const hashReveal = keyframes`
  from {
    opacity: 0;
    filter: blur(4px);
  }
  to {
    opacity: 1;
    filter: blur(0);
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
    border-color: var(--accent-secondary);
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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  padding: 12px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid var(--border-light);
`;

const Td = styled.td`
  padding: 12px 8px;
  font-size: 0.9rem;
  color: ${props => props.$unused ? 'var(--text-tertiary)' : 'var(--text-primary)'};
  border-bottom: 1px solid var(--border-light);
  background: ${props => props.$unused ? 'var(--bg-tertiary)' : 'transparent'};
`;

const CardValue = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
`;

const MatchIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${props => props.$match ? '#16a34a' : '#dc2626'};
  color: var(--text-light);
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
    color: ${props => {
      if (props.$result === 'win') return '#16a34a';
      if (props.$result === 'lose') return '#dc2626';
      return 'var(--text-secondary)';
    }};
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

// How It Works Section
const HowItWorksCard = styled(Card)`
  background: var(--bg-glass-gradient);
`;

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

// Sequence Diagram Styles
const SequenceDiagram = styled.div`
  margin: 1rem 0;
  overflow-x: auto;
`;

const SequenceHeader = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 8px;
  min-width: 600px;
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
  min-width: 600px;
`;

const SequenceLines = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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
  grid-template-columns: repeat(4, 1fr);
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
  background: var(--bg-card);
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

const SecurityBox = styled.div`
  background: rgba(22, 163, 74, 0.05);
  border: 1px solid rgba(22, 163, 74, 0.2);
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 8px;
`;

const SecurityTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: #16a34a;
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

const ChevronIcon = styled.span`
  transition: transform 0.2s ease;
  transform: ${props => props.$open ? 'rotate(180deg)' : 'rotate(0deg)'};
  color: var(--accent-primary);
`;

// Live Calculation Animation Components
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

const GameIdInput = styled(StyledInput)`
  width: 100%;
`;

const CalculateButton = styled(Button)`
  background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%);
  border: none;
  padding: 12px 24px;
  font-size: 0.9rem;
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(105, 48, 195, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

const InputRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-top: 16px;

  @media (max-width: 500px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const GameIdWrapper = styled.div`
  width: 160px;
  flex-shrink: 0;

  @media (max-width: 500px) {
    width: 100%;
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

const AnimatedFormula = styled(Formula)`
  animation: ${formulaSlide} 0.5s ease-out;
  animation-delay: ${props => props.$delay || '0s'};
  animation-fill-mode: both;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);

  .highlight {
    animation: ${hashReveal} 0.6s ease-out;
    animation-delay: ${props => props.$hashDelay || '0.3s'};
    animation-fill-mode: both;
  }
`;

const CardsGridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
  perspective: 1000px;
  padding: 12px;
  background: var(--bg-glass);
  border-radius: 10px;
  border: 1px solid var(--border-light);

  @media (max-width: 768px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;

const AnimatedCardBox = styled.div`
  text-align: center;
  padding: 10px 6px;
  background: ${props => props.$isInitial
    ? 'var(--bg-glass-gradient)'
    : 'var(--bg-secondary)'};
  border-radius: 8px;
  border: 2px solid ${props => props.$isInitial ? 'var(--border-light)' : 'transparent'};
  animation: ${cardReveal} 0.5s ease-out;
  animation-delay: ${props => props.$delay || '0s'};
  animation-fill-mode: both;
  transform-style: preserve-3d;
  transition: all 0.2s ease;
  cursor: default;

  &:hover {
    transform: translateY(-4px) scale(1.08);
    box-shadow: 0 8px 20px var(--shadow-color);
    border-color: ${props => props.$isInitial ? 'var(--accent-primary)' : 'var(--border-light)'};
  }
`;

const CardIndex = styled.div`
  font-size: 0.6rem;
  color: var(--text-tertiary);
  font-weight: 500;
  margin-bottom: 2px;
`;

const CardValueDisplay = styled.div`
  font-size: 1.1rem;
  font-weight: 800;
  color: ${props => props.$isInitial ? 'var(--accent-primary)' : 'var(--text-secondary)'};
`;

const CardsLegend = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 12px;
  animation: ${fadeIn} 0.3s ease-out;
  animation-delay: 1.2s;
  animation-fill-mode: both;
`;

const LegendDot = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 4px;
    background: ${props => props.$color || 'var(--accent-primary)'};
  }
`;

const BlackjackVerifyPage = () => {
  const { gameId: urlGameId } = useParams();
  const navigate = useNavigate();
  const [inputGameId, setInputGameId] = useState(urlGameId || '');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [showUnusedCards, setShowUnusedCards] = useState(false);
  const [liveCalcOpen, setLiveCalcOpen] = useState(false);
  const [customVrfSeed, setCustomVrfSeed] = useState('');
  const [customBackendSalt, setCustomBackendSalt] = useState('');
  const [customGameId, setCustomGameId] = useState('');
  const [liveResults, setLiveResults] = useState(null);

  // Live Verification state
  const [liveVerifyOpen, setLiveVerifyOpen] = useState(false);
  const [verifyVrfSeed, setVerifyVrfSeed] = useState('');
  const [verifyBackendSalt, setVerifyBackendSalt] = useState('');
  const [verifyGameId, setVerifyGameId] = useState('');
  const [verifyCards, setVerifyCards] = useState(['', '', '', '', '', '', '', '']); // 8 card inputs
  const [verifyResults, setVerifyResults] = useState(null);

  const {
    loading,
    error,
    gameData,
    seedData,
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

  // Set default values for live calc when seedData loads
  useEffect(() => {
    if (seedData?.vrfSeed && seedData?.backendSalt) {
      setCustomVrfSeed(seedData.vrfSeed);
      setCustomBackendSalt(seedData.backendSalt);
      // Also set for Live Verification
      setVerifyVrfSeed(seedData.vrfSeed);
      setVerifyBackendSalt(seedData.backendSalt);
    }
    if (gameData?.gameId) {
      setCustomGameId(String(gameData.gameId));
      setVerifyGameId(String(gameData.gameId));
    }
  }, [seedData, gameData]);

  // Set default cards for Live Verification when verification data loads
  useEffect(() => {
    if (verification?.cards) {
      const newCards = ['', '', '', '', '', '', '', ''];
      verification.cards.forEach(card => {
        if (card.used && card.index < 8) {
          newCards[card.index] = cardToDisplay(card.actual);
        }
      });
      setVerifyCards(newCards);
    }
  }, [verification]);

  // Live calculation function
  const runLiveCalculation = () => {
    if (!customVrfSeed || !customBackendSalt || !customGameId) {
      toast.error('Please enter VRF Seed, Backend Salt, and Game ID');
      return;
    }

    try {
      const finalSeed = generateFinalSeed(customVrfSeed, customBackendSalt);
      const gId = customGameId;

      const cards = [];
      for (let i = 0; i < 20; i++) {
        const cardValue = generateCard(finalSeed, gId, i);
        cards.push({ index: i, value: cardValue, display: cardToDisplay(cardValue) });
      }

      setLiveResults({ finalSeed, cards, gameId: gId });
    } catch (err) {
      toast.error('Invalid seed format');
    }
  };

  // Live verification function
  const runLiveVerification = () => {
    if (!verifyVrfSeed || !verifyBackendSalt || !verifyGameId) {
      toast.error('Please enter VRF Seed, Backend Salt, and Game ID');
      return;
    }

    // Filter out empty cards
    const actualCards = verifyCards
      .map((card, idx) => ({ index: idx, value: card.trim().toUpperCase() }))
      .filter(c => c.value !== '');

    if (actualCards.length === 0) {
      toast.error('Please enter at least one card');
      return;
    }

    try {
      const finalSeed = generateFinalSeed(verifyVrfSeed, verifyBackendSalt);
      const gId = verifyGameId;

      // Map card display to value (A=1, 2-10, J=11, Q=12, K=13)
      const cardDisplayToValue = (display) => {
        const map = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
        return map[display] || null;
      };

      const results = actualCards.map(({ index, value }) => {
        const expectedValue = generateCard(finalSeed, gId, index);
        const actualValue = cardDisplayToValue(value);
        const expectedDisplay = cardToDisplay(expectedValue);
        const match = actualValue === expectedValue;

        return {
          index,
          expected: expectedDisplay,
          actual: value,
          expectedValue,
          actualValue,
          match,
          valid: actualValue !== null
        };
      });

      const allMatch = results.every(r => r.match && r.valid);
      const invalidInputs = results.filter(r => !r.valid);

      setVerifyResults({
        finalSeed,
        results,
        allMatch,
        invalidInputs,
        gameId: gId
      });

      if (allMatch) {
        toast.success('All cards verified successfully!');
      } else if (invalidInputs.length > 0) {
        toast.error(`Invalid card format: ${invalidInputs.map(r => r.actual).join(', ')}`);
      } else {
        toast.error('Card mismatch detected! Verification failed.');
      }
    } catch (err) {
      toast.error('Invalid seed format');
    }
  };

  // Update verify card input
  const updateVerifyCard = (index, value) => {
    const newCards = [...verifyCards];
    newCards[index] = value;
    setVerifyCards(newCards);
    setVerifyResults(null);
  };

  const handleVerify = () => {
    if (!inputGameId.trim()) {
      toast.error('Please enter a game ID');
      return;
    }

    // Update URL
    navigate(`/blackjack/verify/${inputGameId.trim()}`);
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

  return (
    <PageContainer>
      <ContentWrapper>
        <div>
          <Header>
            <Title>
              <Shield size={28} />
              Blackjack Provably Fair Verification
            </Title>
          </Header>
          <Subtitle>
            Verify the fairness of any completed Blackjack game using cryptographic proofs
          </Subtitle>
        </div>

        <SearchCard>
          <Input
            type="text"
            placeholder="Enter Game ID (e.g., 1761)"
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

        {verification && (
          <>
            {gameData && (
              <Card>
                <SectionTitle>Game Summary</SectionTitle>
                <GameSummary>
                  <SummaryItem>
                    <div className="label">Game ID</div>
                    <div className="value">{gameData.gameId}</div>
                  </SummaryItem>
                  <SummaryItem $result={gameData.result}>
                    <div className="label">Result</div>
                    <div className="value result">{gameData.result?.toUpperCase()}</div>
                  </SummaryItem>
                  <SummaryItem>
                    <div className="label">Bet</div>
                    <div className="value">{gameData.totalBet?.ether} MON</div>
                  </SummaryItem>
                  <SummaryItem>
                    <div className="label">Payout</div>
                    <div className="value">{gameData.totalPayout?.ether} MON</div>
                  </SummaryItem>
                  <SummaryItem>
                    <div className="label">Player Total</div>
                    <div className="value">{verification?.handTotals?.[0]?.total || '-'}</div>
                  </SummaryItem>
                  <SummaryItem>
                    <div className="label">Dealer Total</div>
                    <div className="value">{verification?.dealerTotal?.total || '-'}</div>
                  </SummaryItem>
                </GameSummary>
              </Card>
            )}

            <Card>
              <SectionTitle>Seeds & Commitments</SectionTitle>

              <SeedRow>
                <SeedLabel>VRF Seed (Pyth)</SeedLabel>
                <SeedValue>
                  <HashValue>{truncateHash(seedData?.vrfSeed)}</HashValue>
                  <CopyButton onClick={() => copyToClipboard(seedData?.vrfSeed, 'VRF Seed')}>
                    <Copy size={14} />
                  </CopyButton>
                </SeedValue>
              </SeedRow>

              <SeedRow>
                <SeedLabel>Backend Salt</SeedLabel>
                <SeedValue>
                  <HashValue>{truncateHash(seedData?.backendSalt)}</HashValue>
                  <CopyButton onClick={() => copyToClipboard(seedData?.backendSalt, 'Backend Salt')}>
                    <Copy size={14} />
                  </CopyButton>
                </SeedValue>
              </SeedRow>

              <SeedRow>
                <SeedLabel>Final Seed</SeedLabel>
                <SeedValue>
                  <HashValue>{truncateHash(verification?.finalSeed)}</HashValue>
                  <CopyButton onClick={() => copyToClipboard(verification?.finalSeed, 'Final Seed')}>
                    <Copy size={14} />
                  </CopyButton>
                </SeedValue>
              </SeedRow>

              <SeedRow>
                <SeedLabel>VRF Commitment</SeedLabel>
                <SeedValue>
                  <VerificationBadge $valid={verification?.vrfCommitmentValid}>
                    {verification?.vrfCommitmentValid ? (
                      <><Check size={12} /> Verified</>
                    ) : (
                      <><X size={12} /> Invalid</>
                    )}
                  </VerificationBadge>
                </SeedValue>
              </SeedRow>
            </Card>

            <Card>
              <SectionTitle>Card Verification</SectionTitle>
              <Table>
                <thead>
                  <tr>
                    <Th>Index</Th>
                    <Th>Purpose</Th>
                    <Th>Expected</Th>
                    <Th>Actual</Th>
                    <Th>Match</Th>
                  </tr>
                </thead>
                <tbody>
                  {verification?.cards?.filter(card => card.used || showUnusedCards).map((card, idx) => (
                    <tr key={idx}>
                      <Td $unused={!card.used}>{card.index}</Td>
                      <Td $unused={!card.used}>{card.purpose}</Td>
                      <Td $unused={!card.used}>
                        <CardValue>{cardToDisplay(card.expected)}</CardValue>
                      </Td>
                      <Td $unused={!card.used}>
                        {card.used ? (
                          <CardValue>{cardToDisplay(card.actual)}</CardValue>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>-</span>
                        )}
                      </Td>
                      <Td $unused={!card.used}>
                        {card.used ? (
                          <MatchIcon $match={card.match}>
                            {card.match ? <Check size={14} /> : <X size={14} />}
                          </MatchIcon>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>Not used</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {verification?.cards?.some(card => !card.used) && (
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => setShowUnusedCards(!showUnusedCards)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6930c3',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(105, 48, 195, 0.05)'}
                    onMouseLeave={(e) => e.target.style.background = 'none'}
                  >
                    {showUnusedCards ? (
                      <>Hide unused cards <ChevronDown size={16} style={{ transform: 'rotate(180deg)' }} /></>
                    ) : (
                      <>Show next {verification?.cards?.filter(c => !c.used).length} cards (pre-generated) <ChevronDown size={16} /></>
                    )}
                  </button>
                </div>
              )}
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
                      VRF Seed (Pyth)
                    </InputLabel>
                    <StyledInput
                      value={customVrfSeed}
                      onChange={(e) => { setCustomVrfSeed(e.target.value); setLiveResults(null); }}
                      placeholder="0x722c...enter VRF seed here"
                    />
                  </InputGroup>
                  <InputGroup>
                    <InputLabel>
                      <Lock size={14} />
                      Backend Salt
                    </InputLabel>
                    <StyledInput
                      value={customBackendSalt}
                      onChange={(e) => { setCustomBackendSalt(e.target.value); setLiveResults(null); }}
                      placeholder="0xa0d1...enter backend salt here"
                    />
                  </InputGroup>
                  <InputRow>
                    <GameIdWrapper>
                      <InputLabel>
                        <FileCode size={14} />
                        Game ID
                      </InputLabel>
                      <GameIdInput
                        value={customGameId}
                        onChange={(e) => { setCustomGameId(e.target.value); setLiveResults(null); }}
                        placeholder="e.g., 1433"
                      />
                    </GameIdWrapper>
                    <CalculateButton onClick={runLiveCalculation}>
                      <Cpu size={18} />
                      Calculate Cards
                    </CalculateButton>
                  </InputRow>
                </LiveCalcInputSection>

                {liveResults && (
                  <LiveResultsContainer key={`${liveResults.gameId}-${liveResults.finalSeed}`}>
                    <FormulaStep $delay="0s">
                      <FormulaLabel>Step 1: Generate Final Seed</FormulaLabel>
                      <AnimatedFormula $delay="0.1s" $hashDelay="0.4s">
                        finalSeed = keccak256(vrfSeed, backendSalt)<br/>
                        <span className="highlight">= {truncateHash(liveResults.finalSeed, 20, 20)}</span>
                      </AnimatedFormula>
                    </FormulaStep>

                    <FormulaStep $delay="0.3s">
                      <FormulaLabel>Step 2: Generate Cards (gameId: {liveResults.gameId})</FormulaLabel>
                      <CardsGridContainer>
                        {liveResults.cards.map((card) => (
                          <AnimatedCardBox
                            key={card.index}
                            $isInitial={card.index < 4}
                            $delay={`${0.5 + card.index * 0.05}s`}
                          >
                            <CardIndex>#{card.index}</CardIndex>
                            <CardValueDisplay $isInitial={card.index < 4}>
                              {card.display}
                            </CardValueDisplay>
                          </AnimatedCardBox>
                        ))}
                      </CardsGridContainer>
                      <CardsLegend>
                        <LegendDot $color="linear-gradient(135deg, #6930c3, #8b5cf6)">Initial deal (0-3)</LegendDot>
                        <LegendDot $color="#e5e7eb">Hit cards (4-19)</LegendDot>
                      </CardsLegend>
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
                      VRF Seed (Pyth)
                    </InputLabel>
                    <StyledInput
                      value={verifyVrfSeed}
                      onChange={(e) => { setVerifyVrfSeed(e.target.value); setVerifyResults(null); }}
                      placeholder="0x722c...enter VRF seed here"
                    />
                  </InputGroup>
                  <InputGroup>
                    <InputLabel>
                      <Lock size={14} />
                      Backend Salt
                    </InputLabel>
                    <StyledInput
                      value={verifyBackendSalt}
                      onChange={(e) => { setVerifyBackendSalt(e.target.value); setVerifyResults(null); }}
                      placeholder="0xa0d1...enter backend salt here"
                    />
                  </InputGroup>
                  <InputGroup>
                    <InputLabel>
                      <FileCode size={14} />
                      Game ID
                    </InputLabel>
                    <StyledInput
                      value={verifyGameId}
                      onChange={(e) => { setVerifyGameId(e.target.value); setVerifyResults(null); }}
                      placeholder="e.g., 1433"
                      style={{ width: '160px' }}
                    />
                  </InputGroup>

                  <div style={{ marginTop: '20px' }}>
                    <InputLabel style={{ marginBottom: '12px' }}>
                      <Globe size={14} />
                      Enter Cards to Verify (A, 2-10, J, Q, K)
                    </InputLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      {[
                        { idx: 0, label: '#0 Player Card 1' },
                        { idx: 1, label: '#1 Player Card 2' },
                        { idx: 2, label: '#2 Dealer Up' },
                        { idx: 3, label: '#3 Dealer Hole' },
                        { idx: 4, label: '#4 Hit Card 1' },
                        { idx: 5, label: '#5 Hit Card 2' },
                        { idx: 6, label: '#6 Hit Card 3' },
                        { idx: 7, label: '#7 Hit Card 4' },
                      ].map(({ idx, label }) => (
                        <div key={idx}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
                          <StyledInput
                            value={verifyCards[idx]}
                            onChange={(e) => updateVerifyCard(idx, e.target.value)}
                            placeholder={idx < 4 ? 'Required' : 'Optional'}
                            style={{
                              width: '100%',
                              textAlign: 'center',
                              textTransform: 'uppercase',
                              fontWeight: '600',
                              background: verifyResults?.results?.find(r => r.index === idx)
                                ? verifyResults.results.find(r => r.index === idx).match
                                  ? 'rgba(22, 163, 74, 0.1)'
                                  : 'rgba(220, 38, 38, 0.1)'
                                : 'var(--input-bg)'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <CalculateButton onClick={runLiveVerification}>
                      <Shield size={18} />
                      Verify Cards
                    </CalculateButton>
                  </div>
                </LiveCalcInputSection>

                {verifyResults && (
                  <LiveResultsContainer>
                    <FormulaStep $delay="0s">
                      <FormulaLabel>
                        {verifyResults.allMatch ? (
                          <span style={{ color: '#16a34a' }}>All Cards Verified Successfully</span>
                        ) : (
                          <span style={{ color: '#dc2626' }}>Verification Failed - Card Mismatch Detected</span>
                        )}
                      </FormulaLabel>

                      <div style={{
                        background: verifyResults.allMatch ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                        border: `2px solid ${verifyResults.allMatch ? 'rgba(22, 163, 74, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`,
                        borderRadius: '10px',
                        padding: '16px',
                        marginTop: '12px'
                      }}>
                        <Table>
                          <thead>
                            <tr>
                              <Th>Index</Th>
                              <Th>Your Input</Th>
                              <Th>Expected</Th>
                              <Th>Result</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {verifyResults.results.map((result, idx) => (
                              <tr key={idx}>
                                <Td>#{result.index}</Td>
                                <Td>
                                  <CardValue style={{
                                    background: result.match ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                                    color: result.match ? '#16a34a' : '#dc2626'
                                  }}>
                                    {result.actual}
                                  </CardValue>
                                </Td>
                                <Td>
                                  <CardValue>{result.expected}</CardValue>
                                </Td>
                                <Td>
                                  <MatchIcon $match={result.match}>
                                    {result.match ? <Check size={14} /> : <X size={14} />}
                                  </MatchIcon>
                                </Td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>

                        <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <strong>Final Seed:</strong> <code style={{ fontSize: '0.75rem' }}>{truncateHash(verifyResults.finalSeed, 16, 16)}</code>
                        </div>
                      </div>

                      {!verifyResults.allMatch && (
                        <WarningBox style={{ marginTop: '16px' }}>
                          <WarningTitle><AlertTriangle size={14} /> Contract Would Reject This</WarningTitle>
                          <SecurityText>
                            If these cards were submitted to the smart contract, the transaction would <strong>revert</strong> because the card values don't match the algorithm.
                            The player would keep their bet and the game could not complete.
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
                      <ActorBox $bg="rgba(234, 88, 12, 0.1)" $color="#ea580c">BACKEND</ActorBox>
                      <ActorBox $bg="rgba(22, 163, 74, 0.1)" $color="#16a34a">CONTRACT</ActorBox>
                      <ActorBox $bg="rgba(139, 92, 246, 0.1)" $color="#8b5cf6">PYTH VRF</ActorBox>
                    </SequenceHeader>
                    <SequenceBody>
                      <SequenceLines>
                        <VerticalLine $color="rgba(37, 99, 235, 0.2)" />
                        <VerticalLine $color="rgba(234, 88, 12, 0.2)" />
                        <VerticalLine $color="rgba(22, 163, 74, 0.2)" />
                        <VerticalLine $color="rgba(139, 92, 246, 0.2)" />
                      </SequenceLines>
                      <SequenceSteps>
                        {/* Step 1 */}
                        <SequenceStep>
                          <ArrowCell $from={1} $to={2}>
                            <Arrow $color="#2563eb" />
                            <ArrowLabel><StepNumber $color="#2563eb">1</StepNumber>new game</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        {/* Step 2 */}
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#ea580c" />
                            <ArrowLabel><StepNumber $color="#ea580c">2</StepNumber>saltHash = keccak256(salt)</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        {/* Step 3 */}
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#16a34a" $reverse />
                            <ArrowLabel><StepNumber $color="#16a34a">3</StepNumber>saltHash stored on-chain</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        {/* Step 4 */}
                        <SequenceStep>
                          <ArrowCell $from={1} $to={3}>
                            <Arrow $color="#2563eb" />
                            <ArrowLabel><StepNumber $color="#2563eb">4</StepNumber>placeBet() + requestVRF()</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        {/* Step 5 */}
                        <SequenceStep>
                          <ArrowCell $from={3} $to={4}>
                            <Arrow $color="#16a34a" />
                            <ArrowLabel><StepNumber $color="#16a34a">5</StepNumber>request random</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        {/* Step 6 */}
                        <SequenceStep>
                          <ArrowCell $from={3} $to={4}>
                            <Arrow $color="#8b5cf6" $reverse />
                            <ArrowLabel><StepNumber $color="#8b5cf6">6</StepNumber>vrfSeed</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        {/* Gameplay loop */}
                        <SequenceStep>
                          <ArrowCell $from={1} $to={2}>
                            <Arrow $color="var(--text-tertiary)" />
                            <ArrowLabel style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>hit / stand / double / split</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#ea580c" />
                            <ArrowLabel style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>action tx</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#16a34a" $reverse />
                            <ArrowLabel style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>card result</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={1} $to={2}>
                            <Arrow $color="var(--text-tertiary)" $reverse />
                            <ArrowLabel style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>new card</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        {/* Step 7 */}
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#ea580c" />
                            <ArrowLabel><StepNumber $color="#ea580c">7</StepNumber>stand/bust → salt reveal</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        {/* Step 8 */}
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#16a34a" $reverse />
                            <ArrowLabel><StepNumber $color="#16a34a">8</StepNumber>verify & payout</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                      </SequenceSteps>
                    </SequenceBody>
                  </SequenceDiagram>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.6' }}>
                    <strong>Key:</strong> Salt hash is committed (step 2-3) <em>before</em> VRF is generated (step 6).
                    Backend cannot change salt after seeing VRF, and cannot predict VRF when committing salt.
                  </div>
                </SubSection>

                {/* Algorithm */}
                <SubSection>
                  <SubTitle>
                    <Cpu size={16} />
                    Card Generation Algorithm
                  </SubTitle>
                  <Formula>
                    <span className="comment">// Step 1: Combine two sources of randomness</span><br/>
                    <span className="highlight">finalSeed</span> = keccak256(vrfSeed, backendSalt)<br/><br/>
                    <span className="comment">// Step 2: Generate each card deterministically</span><br/>
                    cardHash = keccak256(<span className="highlight">finalSeed</span>, gameId, cardIndex, "card")<br/>
                    <span className="highlight">card</span> = (cardHash % 13) + 1 &nbsp;&nbsp;<span className="comment">// 1=Ace, 2-10, 11=J, 12=Q, 13=K</span>
                  </Formula>
                  <SecurityBox>
                    <SecurityTitle><Lock size={14} /> Why Two Seeds?</SecurityTitle>
                    <SecurityText>
                      Using dual-source randomness prevents manipulation by either party:
                      <br/>• <strong>VRF Seed</strong> - Generated by Pyth Network, backend cannot predict it
                      <br/>• <strong>Backend Salt</strong> - Committed before VRF arrives, cannot be changed after
                      <br/>• <strong>Hidden Until Game Ends</strong> - Salt stays secret during gameplay, so even if someone scrapes VRF seeds from on-chain transactions, they cannot calculate upcoming cards without the unrevealed salt
                    </SecurityText>
                  </SecurityBox>
                </SubSection>

                {/* Security Guarantees */}
                <SubSection>
                  <SubTitle>
                    <Lock size={16} />
                    Why Backend Cannot Cheat
                  </SubTitle>
                  <SecurityBox>
                    <SecurityTitle><Check size={14} /> Commitment Before Randomness</SecurityTitle>
                    <SecurityText>
                      Backend must commit to <code>saltHash</code> BEFORE the VRF seed is generated.
                      Once committed, changing the salt would produce a different hash, which the contract would reject.
                    </SecurityText>
                  </SecurityBox>
                  <SecurityBox>
                    <SecurityTitle><Check size={14} /> Unpredictable VRF</SecurityTitle>
                    <SecurityText>
                      The Pyth RNG seed is cryptographically random and unpredictable.
                      Backend cannot know what VRF seed will be generated when committing the salt.
                    </SecurityText>
                  </SecurityBox>
                  <SecurityBox>
                    <SecurityTitle><Check size={14} /> On-Chain Verification</SecurityTitle>
                    <SecurityText>
                      The smart contract independently recalculates all cards using the revealed seeds.
                      If any card doesn't match, the transaction fails and the game cannot complete.
                    </SecurityText>
                  </SecurityBox>
                  <SecurityBox>
                    <SecurityTitle><Check size={14} /> Hole Card Stays Hidden</SecurityTitle>
                    <SecurityText>
                      The dealer's hole card (card #3, face-down card) is pre-determined by the algorithm but never revealed until the player finishes their turn.
                      Since the backend salt is secret during gameplay, no one—including the player—can calculate what the hole card is until the game ends.
                    </SecurityText>
                  </SecurityBox>
                </SubSection>

                {/* What If Backend Lies */}
                <SubSection>
                  <SubTitle>
                    <AlertTriangle size={16} />
                    What If Backend Tries to Cheat?
                  </SubTitle>
                  <WarningBox>
                    <WarningTitle><X size={14} /> Wrong Salt = Transaction Fails</WarningTitle>
                    <SecurityText>
                      If backend provides a different salt than originally committed,
                      <code>keccak256(fakeSalt) != storedSaltHash</code> and the contract reverts.
                      The game cannot complete, player keeps their bet.
                    </SecurityText>
                  </WarningBox>
                  <WarningBox>
                    <WarningTitle><X size={14} /> Wrong Cards = Transaction Fails</WarningTitle>
                    <SecurityText>
                      Contract recalculates every card from the seeds. If backend sent wrong card values,
                      they won't match the algorithm and the transaction reverts.
                    </SecurityText>
                  </WarningBox>
                  <WarningBox>
                    <WarningTitle><X size={14} /> Selective Revealing = Impossible</WarningTitle>
                    <SecurityText>
                      Backend cannot "try different salts" because the hash was committed before VRF.
                      There's only one valid salt that matches the stored hash.
                    </SecurityText>
                  </WarningBox>
                </SubSection>

                {/* Contract Verification Logic */}
                <SubSection>
                  <SubTitle>
                    <Shield size={16} />
                    Smart Contract Verification (Solidity)
                  </SubTitle>
                  <Formula>
                    <span className="comment">// Contract: verifyAndComplete() - Called at game end</span><br/>
                    <span className="comment">// This is the actual verification the contract performs</span><br/><br/>

                    <span className="comment">// 1. Verify VRF Commitment (proves VRF seed is authentic)</span><br/>
                    bytes32 expectedCommitment = keccak256(abi.encodePacked(<br/>
                    &nbsp;&nbsp;pythSeed, gameId, <span className="highlight">"v1"</span><br/>
                    ));<br/>
                    <span className="highlight">require(vrfCommitment == expectedCommitment)</span>;<br/><br/>

                    <span className="comment">// 2. Verify Backend Salt (proves salt wasn't changed)</span><br/>
                    bytes32 expectedSaltHash = keccak256(abi.encodePacked(backendSalt));<br/>
                    <span className="highlight">require(backendSaltHash == expectedSaltHash)</span>;<br/><br/>

                    <span className="comment">// 3. Generate Final Seed (dual-source randomness)</span><br/>
                    bytes32 <span className="highlight">finalSeed</span> = keccak256(abi.encodePacked(pythSeed, backendSalt));<br/><br/>

                    <span className="comment">// 4. Verify ALL cards match the algorithm</span><br/>
                    <span className="highlight">require(_generateCard(finalSeed, gameId, 0) == playerCard1)</span>;<br/>
                    <span className="highlight">require(_generateCard(finalSeed, gameId, 1) == playerCard2)</span>;<br/>
                    <span className="highlight">require(_generateCard(finalSeed, gameId, 2) == dealerUpCard)</span>;<br/>
                    <span className="highlight">require(_generateCard(finalSeed, gameId, 3) == dealerHoleCard)</span>;<br/>
                    <span className="comment">// ... verify all hit cards ...</span><br/><br/>

                    <span className="comment">// 5. If ANY check fails → transaction reverts, player keeps bet</span>
                  </Formula>
                  <Formula style={{ marginTop: '12px' }}>
                    <span className="comment">// Contract: _generateCard() - Deterministic card generation</span><br/><br/>
                    function <span className="highlight">_generateCard</span>(bytes32 <span className="highlight">finalSeed</span>, uint64 gameId, uint8 cardIndex)<br/>
                    &nbsp;&nbsp;internal pure returns (uint8) {'{'}<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;bytes32 hash = keccak256(abi.encodePacked(<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="highlight">finalSeed</span>,<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;gameId,<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;cardIndex,<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="highlight">"card"</span><br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;));<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;return uint8(uint256(hash) % 13) + 1; <span className="comment">// 1-13</span><br/>
                    {'}'}
                  </Formula>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: '1.6' }}>
                    <strong>Note:</strong> Card index mapping: 0-1 = Player cards, 2 = Dealer up, 3 = Dealer hole, 4+ = Hit cards.
                    For split games: 0 = Hand1 Card1, 1 = Hand2 Card1, 4 = Hand1 Card2, 5 = Hand2 Card2.
                  </div>
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
                    const finalSeed = keccak256(encodePacked(<br/>
                    &nbsp;&nbsp;['bytes32', 'bytes32'],<br/>
                    &nbsp;&nbsp;[vrfSeed, backendSalt]<br/>
                    ));<br/><br/>
                    const cardHash = keccak256(encodePacked(<br/>
                    &nbsp;&nbsp;['bytes32', 'uint64', 'uint8', 'string'],<br/>
                    &nbsp;&nbsp;[finalSeed, gameId, cardIndex, 'card']<br/>
                    ));<br/><br/>
                    const card = Number(BigInt(cardHash) % 13n) + 1;
                  </Formula>
                </SubSection>
              </AccordionContent>
            </HowItWorksCard>
          </>
        )}
      </ContentWrapper>
    </PageContainer>
  );
};

export default BlackjackVerifyPage;
