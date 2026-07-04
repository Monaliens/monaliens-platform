import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { Check, X, Copy, Search, Shield, ChevronDown, Lock, AlertTriangle, Info, Cpu, FileCode, Zap, Gem } from 'lucide-react';
import toast from 'react-hot-toast';
import { useVerification } from './hooks/useVerification';
import { truncateHash, formatAmount, generateFinalSeed, calculateMinePositions, getGridDimensions } from './utils/verifyUtils';

// Custom Bomb SVG
const BombIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="14" r="8" fill="currentColor"/>
    <rect x="10" y="2" width="4" height="6" rx="1" fill="currentColor"/>
    <path d="M16 4L19 1" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
    <path d="M18 6L20 4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M17 8L19 7" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round"/>
    <ellipse cx="9" cy="11" rx="2" ry="1.5" fill="rgba(255,255,255,0.3)" transform="rotate(-20 9 11)"/>
  </svg>
);

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const tileReveal = keyframes`
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
    color: ${props => props.$won ? 'var(--accent-primary)' : '#dc2626'};
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

// Mine Grid
const MineGridContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const MineGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${props => props.$cols || 5}, 1fr);
  gap: 8px;
  max-width: 400px;
  width: 100%;
`;

const MineTile = styled.div`
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.2rem;
  background: ${props => {
    if (props.$isHitMine) return 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
    if (props.$isMine) return 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
    if (props.$wasRevealed) return 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)';
    return 'var(--bg-secondary)';
  }};
  color: ${props => (props.$isHitMine || props.$isMine || props.$wasRevealed) ? 'var(--text-light)' : 'var(--text-secondary)'};
  border: 2px solid ${props => {
    if (props.$isHitMine) return '#f97316';
    if (props.$isMine) return '#dc2626';
    if (props.$wasRevealed) return '#16a34a';
    return 'var(--border-light)';
  }};
  box-shadow: ${props => props.$isHitMine ? '0 0 12px rgba(249, 115, 22, 0.5)' : 'none'};
  animation: ${tileReveal} 0.4s ease-out;
  animation-delay: ${props => props.$delay || '0s'};
  animation-fill-mode: both;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: default;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px var(--shadow-color);
  }
`;

const GridLegend = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  font-size: 0.8rem;
  color: var(--text-secondary);
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
  gap: 24px;
  align-items: flex-end;
  margin-top: 20px;
  flex-wrap: wrap;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
`;

const SmallInputWrapper = styled.div`
  flex-shrink: 0;

  @media (max-width: 600px) {
    width: 100%;
  }

  input {
    width: 80px;
  }
`;

const CalculateButton = styled(Button)`
  background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%);
  border: none;
  padding: 12px 24px;
  font-size: 0.9rem;
  box-shadow: 0 4px 15px rgba(105, 48, 195, 0.3);
  margin-left: 12px;

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

const LiveMineGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  max-width: 300px;
  margin: 0 auto;
`;

const LiveMineTile = styled.div`
  aspect-ratio: 1;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  background: ${props => props.$isMine
    ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
    : 'var(--bg-tertiary)'};
  color: ${props => props.$isMine ? 'white' : 'var(--accent-primary)'};
  border: 2px solid ${props => props.$isMine ? '#dc2626' : 'var(--border-light)'};
  animation: ${tileReveal} 0.4s ease-out;
  animation-delay: ${props => props.$delay || '0s'};
  animation-fill-mode: both;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
`;

const MinesVerifyPage = () => {
  const { gameId: urlGameId } = useParams();
  const navigate = useNavigate();
  const [inputGameId, setInputGameId] = useState(urlGameId || '');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [liveCalcOpen, setLiveCalcOpen] = useState(false);
  const [customVrfSeed, setCustomVrfSeed] = useState('');
  const [customBackendSalt, setCustomBackendSalt] = useState('');
  const [customGameId, setCustomGameId] = useState('');
  const [customGridSize, setCustomGridSize] = useState('25');
  const [customMineCount, setCustomMineCount] = useState('3');
  const [liveResults, setLiveResults] = useState(null);

  // Live Verification state
  const [liveVerifyOpen, setLiveVerifyOpen] = useState(false);
  const [verifyVrfSeed, setVerifyVrfSeed] = useState('');
  const [verifyBackendSalt, setVerifyBackendSalt] = useState('');
  const [verifyGameId, setVerifyGameId] = useState('');
  const [verifyGridSize, setVerifyGridSize] = useState(25);
  const [verifyMineCount, setVerifyMineCount] = useState(3);
  const [selectedMines, setSelectedMines] = useState(new Set()); // User's selected mine positions
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
    if (gameData?.vrf_seed && gameData?.backend_salt) {
      setCustomVrfSeed(gameData.vrf_seed);
      setCustomBackendSalt(gameData.backend_salt);
      setCustomGameId(String(gameData.game_id));
      setCustomGridSize(String(gameData.grid_size));
      setCustomMineCount(String(gameData.mine_count));
      // Also set for Live Verification
      setVerifyVrfSeed(gameData.vrf_seed);
      setVerifyBackendSalt(gameData.backend_salt);
      setVerifyGameId(String(gameData.game_id));
      setVerifyGridSize(gameData.grid_size || 25);
      setVerifyMineCount(gameData.mine_count || 3);
    }
  }, [gameData]);

  // Set default mine positions for Live Verification when verification data loads
  useEffect(() => {
    if (verification?.calculatedPositions) {
      setSelectedMines(new Set(verification.calculatedPositions));
    }
  }, [verification]);

  // Live calculation function
  const runLiveCalculation = () => {
    if (!customVrfSeed || !customBackendSalt || !customGameId) {
      toast.error('Please enter VRF Seed, Backend Salt, and Game ID');
      return;
    }

    try {
      const gridSize = parseInt(customGridSize) || 25;
      const mineCount = parseInt(customMineCount) || 3;
      const finalSeed = generateFinalSeed(customVrfSeed, customBackendSalt, customGameId);
      const minePositions = calculateMinePositions(finalSeed, customGameId, gridSize, mineCount);

      setLiveResults({ finalSeed, minePositions, gameId: customGameId, gridSize, mineCount });
    } catch (err) {
      toast.error('Invalid seed format');
    }
  };

  // Live Verification function
  const runLiveVerification = () => {
    if (!verifyVrfSeed || !verifyBackendSalt || !verifyGameId) {
      toast.error('Please enter VRF Seed, Backend Salt, and Game ID');
      return;
    }

    if (selectedMines.size !== verifyMineCount) {
      toast.error(`Please select exactly ${verifyMineCount} mine positions`);
      return;
    }

    try {
      const finalSeed = generateFinalSeed(verifyVrfSeed, verifyBackendSalt, verifyGameId);
      const expectedMines = calculateMinePositions(finalSeed, verifyGameId, verifyGridSize, verifyMineCount);
      const expectedSet = new Set(expectedMines);

      // Compare selected mines with expected mines
      const correctMines = [...selectedMines].filter(pos => expectedSet.has(pos));
      const wrongMines = [...selectedMines].filter(pos => !expectedSet.has(pos));
      const missedMines = expectedMines.filter(pos => !selectedMines.has(pos));

      const allMatch = wrongMines.length === 0 && missedMines.length === 0;

      setVerifyResults({
        finalSeed,
        expectedMines,
        selectedMines: [...selectedMines],
        correctMines,
        wrongMines,
        missedMines,
        allMatch,
        gridSize: verifyGridSize,
        mineCount: verifyMineCount
      });

      if (allMatch) {
        toast.success('All mine positions verified successfully!');
      } else {
        toast.error('Mine positions mismatch! Verification failed.');
      }
    } catch (err) {
      toast.error('Invalid seed format');
    }
  };

  // Toggle mine selection
  const toggleMineSelection = (index) => {
    const newSelected = new Set(selectedMines);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      if (newSelected.size < verifyMineCount) {
        newSelected.add(index);
      } else {
        toast.error(`Maximum ${verifyMineCount} mines can be selected`);
        return;
      }
    }
    setSelectedMines(newSelected);
    setVerifyResults(null);
  };

  const handleVerify = () => {
    if (!inputGameId.trim()) {
      toast.error('Please enter a game ID');
      return;
    }

    navigate(`/mines/verify/${inputGameId.trim()}`);
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

  const { rows, cols } = gameData ? getGridDimensions(gameData.grid_size) : { rows: 5, cols: 5 };

  return (
    <PageContainer>
      <ContentWrapper>
        <div>
          <Header>
            <Title>
              <Shield size={28} />
              Mines Provably Fair Verification
            </Title>
          </Header>
          <Subtitle>
            Verify the fairness of any completed Mines game using cryptographic proofs
          </Subtitle>
        </div>

        <SearchCard>
          <Input
            type="text"
            placeholder="Enter Game ID (e.g., 2311)"
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
                  <div className="label">Grid</div>
                  <div className="value">{rows}x{cols}</div>
                </SummaryItem>
                <SummaryItem>
                  <div className="label">Mines</div>
                  <div className="value">{gameData.mine_count}</div>
                </SummaryItem>
              </GameSummary>
            </Card>

            <Card>
              <SectionTitle>Seeds & Commitments</SectionTitle>

              <SeedRow>
                <SeedLabel>VRF Seed (Pyth)</SeedLabel>
                <SeedValue>
                  <HashValue>{truncateHash(gameData.vrf_seed)}</HashValue>
                  <CopyButton onClick={() => copyToClipboard(gameData.vrf_seed, 'VRF Seed')}>
                    <Copy size={14} />
                  </CopyButton>
                </SeedValue>
              </SeedRow>

              <SeedRow>
                <SeedLabel>Backend Salt</SeedLabel>
                <SeedValue>
                  <HashValue>{truncateHash(gameData.backend_salt)}</HashValue>
                  <CopyButton onClick={() => copyToClipboard(gameData.backend_salt, 'Backend Salt')}>
                    <Copy size={14} />
                  </CopyButton>
                </SeedValue>
              </SeedRow>

              <SeedRow>
                <SeedLabel>Final Seed</SeedLabel>
                <SeedValue>
                  <HashValue>{truncateHash(verification.finalSeed)}</HashValue>
                  <CopyButton onClick={() => copyToClipboard(verification.finalSeed, 'Final Seed')}>
                    <Copy size={14} />
                  </CopyButton>
                </SeedValue>
              </SeedRow>

              <SeedRow>
                <SeedLabel>VRF Commitment</SeedLabel>
                <SeedValue>
                  <VerificationBadge $valid={verification.vrfCommitmentValid}>
                    {verification.vrfCommitmentValid ? (
                      <><Check size={12} /> Verified</>
                    ) : (
                      <><X size={12} /> Invalid</>
                    )}
                  </VerificationBadge>
                </SeedValue>
              </SeedRow>
            </Card>

            <Card>
              <SectionTitle>Mine Positions Verification</SectionTitle>
              <MineGridContainer>
                <MineGrid $cols={cols}>
                  {verification.tiles.map((tile, idx) => {
                    const isHitMine = gameData.mine_hit_tile === idx;
                    return (
                      <MineTile
                        key={idx}
                        $isHitMine={isHitMine}
                        $isMine={tile.isCalculatedMine && !isHitMine}
                        $wasRevealed={tile.wasRevealed && !tile.isCalculatedMine}
                        $delay={`${idx * 0.03}s`}
                      >
                        {tile.isCalculatedMine ? <BombIcon size={20} /> : tile.wasRevealed ? <Gem size={18} /> : idx}
                      </MineTile>
                    );
                  })}
                </MineGrid>
                <GridLegend>
                  <LegendItem $color="linear-gradient(135deg, #f97316, #ea580c)">Hit Mine</LegendItem>
                  <LegendItem $color="linear-gradient(135deg, #dc2626, #b91c1c)">Mine</LegendItem>
                  <LegendItem $color="linear-gradient(135deg, #16a34a, #15803d)">Revealed Safe</LegendItem>
                  <LegendItem $color="rgba(156, 163, 175, 0.3)">Hidden</LegendItem>
                </GridLegend>
                <div style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: '600', marginTop: '8px' }}>
                  {verification.allPositionsVerified ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={16} /> All {gameData.mine_count} mine positions verified
                    </span>
                  ) : (
                    <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <X size={16} /> Mine positions mismatch
                    </span>
                  )}
                </div>
              </MineGridContainer>
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
                      placeholder="0x7604...enter VRF seed here"
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
                      placeholder="0x01a7...enter backend salt here"
                    />
                  </InputGroup>
                  <InputRow>
                    <SmallInputWrapper>
                      <InputLabel>
                        <FileCode size={14} />
                        Game ID
                      </InputLabel>
                      <StyledInput
                        value={customGameId}
                        onChange={(e) => { setCustomGameId(e.target.value); setLiveResults(null); }}
                        placeholder="2311"
                      />
                    </SmallInputWrapper>
                    <SmallInputWrapper>
                      <InputLabel>Grid Size</InputLabel>
                      <StyledInput
                        value={customGridSize}
                        onChange={(e) => { setCustomGridSize(e.target.value); setLiveResults(null); }}
                        placeholder="25"
                      />
                    </SmallInputWrapper>
                    <SmallInputWrapper>
                      <InputLabel>Mines</InputLabel>
                      <StyledInput
                        value={customMineCount}
                        onChange={(e) => { setCustomMineCount(e.target.value); setLiveResults(null); }}
                        placeholder="3"
                      />
                    </SmallInputWrapper>
                    <CalculateButton onClick={runLiveCalculation}>
                      <Cpu size={18} />
                      Calculate
                    </CalculateButton>
                  </InputRow>
                </LiveCalcInputSection>

                {liveResults && (
                  <LiveResultsContainer key={`${liveResults.gameId}-${liveResults.finalSeed}`}>
                    <FormulaStep $delay="0s">
                      <FormulaLabel>Step 1: Generate Final Seed</FormulaLabel>
                      <AnimatedFormula $delay="0.1s" $hashDelay="0.4s">
                        finalSeed = keccak256(vrfSeed, backendSalt, gameId, VERSION)<br/>
                        <span className="highlight">= {truncateHash(liveResults.finalSeed, 20, 20)}</span>
                      </AnimatedFormula>
                    </FormulaStep>

                    <FormulaStep $delay="0.3s">
                      <FormulaLabel>Step 2: Fisher-Yates Shuffle → Mines at [{liveResults.minePositions.join(', ')}]</FormulaLabel>
                      <LiveMineGrid>
                        {Array.from({ length: liveResults.gridSize }, (_, i) => (
                          <LiveMineTile
                            key={i}
                            $isMine={liveResults.minePositions.includes(i)}
                            $delay={`${0.5 + i * 0.03}s`}
                          >
                            {liveResults.minePositions.includes(i) ? <BombIcon size={16} /> : i}
                          </LiveMineTile>
                        ))}
                      </LiveMineGrid>
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
                  <InputRow>
                    <div style={{ flex: 1 }}>
                      <InputLabel>
                        <FileCode size={14} />
                        Game ID
                      </InputLabel>
                      <StyledInput
                        value={verifyGameId}
                        onChange={(e) => { setVerifyGameId(e.target.value); setVerifyResults(null); }}
                        placeholder="e.g., 2988"
                        style={{ width: '120px' }}
                      />
                    </div>
                    <div>
                      <InputLabel>Grid Size</InputLabel>
                      <StyledInput
                        type="number"
                        value={verifyGridSize}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 25;
                          setVerifyGridSize(val);
                          setSelectedMines(new Set());
                          setVerifyResults(null);
                        }}
                        style={{ width: '70px' }}
                        min={1}
                        max={49}
                      />
                    </div>
                    <div>
                      <InputLabel>Mines</InputLabel>
                      <StyledInput
                        type="number"
                        value={verifyMineCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setVerifyMineCount(val);
                          setSelectedMines(new Set());
                          setVerifyResults(null);
                        }}
                        style={{ width: '70px' }}
                        min={1}
                        max={24}
                      />
                    </div>
                  </InputRow>

                  <div style={{ marginTop: '20px' }}>
                    <InputLabel style={{ marginBottom: '8px' }}>
                      <BombIcon size={14} />
                      Select Mine Positions ({selectedMines.size}/{verifyMineCount})
                    </InputLabel>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      Click tiles to mark them as mines. The positions are pre-filled from the game data.
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.sqrt(verifyGridSize)}, 1fr)`,
                      gap: '6px',
                      maxWidth: '300px',
                      margin: '0 auto'
                    }}>
                      {Array.from({ length: verifyGridSize }, (_, i) => {
                        const isSelected = selectedMines.has(i);
                        const isCorrect = verifyResults?.correctMines?.includes(i);
                        const isWrong = verifyResults?.wrongMines?.includes(i);
                        const isMissed = verifyResults?.missedMines?.includes(i);

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
                            onClick={() => !verifyResults && toggleMineSelection(i)}
                            style={{
                              width: '48px',
                              height: '48px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: bgColor,
                              border: `2px solid ${borderColor}`,
                              borderRadius: '8px',
                              cursor: verifyResults ? 'default' : 'pointer',
                              transition: 'all 0.2s ease',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              color: isSelected || isCorrect || isWrong || isMissed ? 'var(--text-primary)' : 'var(--text-tertiary)'
                            }}
                          >
                            {isSelected || isMissed ? <BombIcon size={20} /> : i}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
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
                      Verify Mine Positions
                    </CalculateButton>
                    {verifyResults && (
                      <Button
                        onClick={() => {
                          setVerifyResults(null);
                          if (verification?.calculatedPositions) {
                            setSelectedMines(new Set(verification.calculatedPositions));
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
                          <span style={{ color: '#16a34a' }}>All Mine Positions Verified Successfully</span>
                        ) : (
                          <span style={{ color: '#dc2626' }}>Verification Failed - Position Mismatch Detected</span>
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
                              {verifyResults.selectedMines.sort((a, b) => a - b).map(pos => (
                                <span key={pos} style={{
                                  padding: '4px 10px',
                                  background: verifyResults.correctMines.includes(pos) ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                                  color: verifyResults.correctMines.includes(pos) ? '#16a34a' : '#dc2626',
                                  borderRadius: '6px',
                                  fontWeight: '600',
                                  fontSize: '0.8rem'
                                }}>
                                  {pos}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Expected:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {verifyResults.expectedMines.sort((a, b) => a - b).map(pos => (
                                <span key={pos} style={{
                                  padding: '4px 10px',
                                  background: 'rgba(105, 48, 195, 0.1)',
                                  color: '#6930c3',
                                  borderRadius: '6px',
                                  fontWeight: '600',
                                  fontSize: '0.8rem'
                                }}>
                                  {pos}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {!verifyResults.allMatch && (
                          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(220, 38, 38, 0.2)' }}>
                            {verifyResults.wrongMines.length > 0 && (
                              <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '8px' }}>
                                <strong>Wrong positions:</strong> {verifyResults.wrongMines.join(', ')} (you selected but not actual mines)
                              </div>
                            )}
                            {verifyResults.missedMines.length > 0 && (
                              <div style={{ color: '#f97316', fontSize: '0.8rem' }}>
                                <strong>Missed positions:</strong> {verifyResults.missedMines.join(', ')} (actual mines you didn't select)
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <strong>Final Seed:</strong> <code style={{ fontSize: '0.7rem' }}>{truncateHash(verifyResults.finalSeed, 16, 16)}</code>
                        </div>
                      </div>

                      {!verifyResults.allMatch && (
                        <WarningBox style={{ marginTop: '16px' }}>
                          <WarningTitle><AlertTriangle size={14} /> Contract Would Reject This</WarningTitle>
                          <SecurityText>
                            If these mine positions were submitted to the smart contract, the transaction would <strong>revert</strong> because the positions don't match the Fisher-Yates shuffle algorithm.
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
                      <ActorBox $bg="rgba(105, 48, 195, 0.1)" $color="#6930c3">CONTRACT</ActorBox>
                      <ActorBox $bg="rgba(139, 92, 246, 0.1)" $color="#8b5cf6">PYTH RNG</ActorBox>
                    </SequenceHeader>
                    <SequenceBody>
                      <SequenceLines>
                        <VerticalLine $color="rgba(37, 99, 235, 0.2)" />
                        <VerticalLine $color="rgba(234, 88, 12, 0.2)" />
                        <VerticalLine $color="rgba(105, 48, 195, 0.2)" />
                        <VerticalLine $color="rgba(139, 92, 246, 0.2)" />
                      </SequenceLines>
                      <SequenceSteps>
                        <SequenceStep>
                          <ArrowCell $from={1} $to={2}>
                            <Arrow $color="#2563eb" />
                            <ArrowLabel><StepNumber $color="#2563eb">1</StepNumber>prepare game</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#ea580c" />
                            <ArrowLabel><StepNumber $color="#ea580c">2</StepNumber>saltHash = keccak256(salt)</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#6930c3" $reverse />
                            <ArrowLabel><StepNumber $color="#6930c3">3</StepNumber>saltHash stored on-chain</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={1} $to={3}>
                            <Arrow $color="#2563eb" />
                            <ArrowLabel><StepNumber $color="#2563eb">4</StepNumber>startGame() + requestVRF()</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={3} $to={4}>
                            <Arrow $color="#6930c3" />
                            <ArrowLabel><StepNumber $color="#6930c3">5</StepNumber>request random</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={3} $to={4}>
                            <Arrow $color="#8b5cf6" $reverse />
                            <ArrowLabel><StepNumber $color="#8b5cf6">6</StepNumber>vrfSeed</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={1} $to={2}>
                            <Arrow $color="var(--text-tertiary)" />
                            <ArrowLabel style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>click tile</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#ea580c" />
                            <ArrowLabel style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>revealTile() tx</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#6930c3" $reverse />
                            <ArrowLabel style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>safe/mine result</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={1} $to={2}>
                            <Arrow $color="var(--text-tertiary)" $reverse />
                            <ArrowLabel style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>tile result</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#ea580c" />
                            <ArrowLabel><StepNumber $color="#ea580c">7</StepNumber>cashout/hit → salt reveal</ArrowLabel>
                          </ArrowCell>
                        </SequenceStep>
                        <SequenceStep>
                          <ArrowCell $from={2} $to={3}>
                            <Arrow $color="#6930c3" $reverse />
                            <ArrowLabel><StepNumber $color="#6930c3">8</StepNumber>verify & payout</ArrowLabel>
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
                    Mine Generation Algorithm
                  </SubTitle>
                  <Formula>
                    <span className="comment">// Step 1: Combine randomness sources with version</span><br/>
                    <span className="highlight">finalSeed</span> = keccak256(vrfSeed, backendSalt, gameId, VERSION)<br/><br/>
                    <span className="comment">// Step 2: Fisher-Yates shuffle to select mine positions</span><br/>
                    for i = 0 to mineCount:<br/>
                    &nbsp;&nbsp;hash = keccak256(<span className="highlight">finalSeed</span>, gameId, "mine", i, VERSION)<br/>
                    &nbsp;&nbsp;j = i + (hash % (gridSize - i))<br/>
                    &nbsp;&nbsp;swap(positions[i], positions[j])<br/><br/>
                    <span className="highlight">mines</span> = positions[0..mineCount-1]
                  </Formula>
                  <SecurityBox>
                    <SecurityTitle><Lock size={14} /> Why Two Seeds?</SecurityTitle>
                    <SecurityText>
                      Using dual-source randomness prevents manipulation by either party:
                      <br/>• <strong>VRF Seed</strong> - Generated by Pyth Network, backend cannot predict it
                      <br/>• <strong>Backend Salt</strong> - Committed before VRF arrives, cannot be changed after
                      <br/>• <strong>Hidden Until Game Ends</strong> - Salt stays secret during gameplay, so even if someone scrapes VRF seeds from on-chain transactions, they cannot calculate mine positions without the unrevealed salt
                    </SecurityText>
                  </SecurityBox>
                </SubSection>

                {/* Security */}
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
                    <SecurityTitle><Check size={14} /> All Tiles Verified On-Chain</SecurityTitle>
                    <SecurityText>
                      When the game ends, the contract recalculates all mine positions using the revealed seeds.
                      Every tile revealed during gameplay is verified - if any claim was wrong, the transaction fails.
                    </SecurityText>
                  </SecurityBox>
                  <SecurityBox>
                    <SecurityTitle><Check size={14} /> Mine Positions Hidden During Play</SecurityTitle>
                    <SecurityText>
                      Mine positions are pre-determined by the algorithm but never revealed until cashout or mine hit.
                      Since the backend salt is secret during gameplay, no one can calculate where the mines are.
                    </SecurityText>
                  </SecurityBox>
                </SubSection>

                {/* What If */}
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
                    </SecurityText>
                  </WarningBox>
                  <WarningBox>
                    <WarningTitle><X size={14} /> Wrong Tile Claims = Transaction Fails</WarningTitle>
                    <SecurityText>
                      Contract recalculates every mine position from the seeds. If backend claimed a tile was safe but it's actually a mine (or vice versa), the transaction reverts.
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
                    <span className="comment">// Contract: completeGame() - Called when cashing out or hitting mine</span><br/>
                    <span className="comment">// This is the actual verification the contract performs</span><br/><br/>

                    <span className="comment">// 1. Verify VRF Commitment (proves VRF seed is authentic)</span><br/>
                    bytes32 expectedCommitment = keccak256(abi.encodePacked(<br/>
                    &nbsp;&nbsp;pythSeed, gameId, <span className="highlight">VERSION</span><br/>
                    ));<br/>
                    <span className="highlight">require(vrfCommitment == expectedCommitment)</span>;<br/><br/>

                    <span className="comment">// 2. Verify Backend Salt (proves salt wasn't changed)</span><br/>
                    <span className="highlight">require(keccak256(backendSalt) == backendSaltHash)</span>;<br/><br/>

                    <span className="comment">// 3. Generate Final Seed (dual-source + gameId + version)</span><br/>
                    bytes32 <span className="highlight">finalSeed</span> = keccak256(abi.encodePacked(<br/>
                    &nbsp;&nbsp;pythSeed, backendSalt, gameId, <span className="highlight">VERSION</span><br/>
                    ));<br/><br/>

                    <span className="comment">// 4. Verify ALL revealed tiles against actual mine positions</span><br/>
                    <span className="comment">// hitMineAt[gameId] stores tile+1 (0 = no mine hit, 1-49 = tile index + 1)</span><br/>
                    uint8 mineHitTile = hitMineAt[gameId];<br/><br/>
                    for (uint8 i = 0; i &lt; gridSize; i++) {'{'}<br/>
                    &nbsp;&nbsp;if (!wasRevealed[i]) continue;<br/>
                    &nbsp;&nbsp;bool actuallyMine = <span className="highlight">_isMine(finalSeed, gameId, gridSize, mineCount, i)</span>;<br/><br/>
                    &nbsp;&nbsp;if (<span className="highlight">mineHitTile == i + 1</span>) {'{'}<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="comment">// This tile was claimed as mine</span><br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="highlight">require(actuallyMine, "Claimed mine but was safe")</span>;<br/>
                    &nbsp;&nbsp;{'}'} else {'{'}<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="comment">// This tile was claimed as safe</span><br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="highlight">require(!actuallyMine, "Claimed safe but was mine")</span>;<br/>
                    &nbsp;&nbsp;{'}'}<br/>
                    {'}'}<br/><br/>

                    <span className="comment">// 5. If ANY check fails → transaction reverts, player keeps bet</span>
                  </Formula>
                  <Formula style={{ marginTop: '12px' }}>
                    <span className="comment">// Contract: _isMine() - Fisher-Yates shuffle for mine positions</span><br/><br/>
                    function <span className="highlight">_isMine</span>(bytes32 finalSeed, uint64 gameId, uint8 gridSize, uint8 mineCount, uint8 tileIndex)<br/>
                    &nbsp;&nbsp;internal pure returns (bool) {'{'}<br/><br/>
                    &nbsp;&nbsp;<span className="comment">// Create position array [0, 1, 2, ..., gridSize-1]</span><br/>
                    &nbsp;&nbsp;uint8[] memory positions = new uint8[](gridSize);<br/>
                    &nbsp;&nbsp;for (uint8 i = 0; i &lt; gridSize; i++) positions[i] = i;<br/><br/>

                    &nbsp;&nbsp;<span className="comment">// Fisher-Yates shuffle first mineCount positions</span><br/>
                    &nbsp;&nbsp;for (uint8 i = 0; i &lt; mineCount; i++) {'{'}<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;bytes32 hash = keccak256(abi.encodePacked(<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;finalSeed, gameId, <span className="highlight">"mine"</span>, i, <span className="highlight">VERSION</span><br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;));<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;uint8 j = i + uint8(uint256(hash) % (gridSize - i));<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;swap(positions[i], positions[j]);<br/>
                    &nbsp;&nbsp;{'}'}<br/><br/>

                    &nbsp;&nbsp;<span className="comment">// Check if tileIndex is in first mineCount positions</span><br/>
                    &nbsp;&nbsp;for (uint8 i = 0; i &lt; mineCount; i++) {'{'}<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;if (positions[i] == tileIndex) return <span className="highlight">true</span>;<br/>
                    &nbsp;&nbsp;{'}'}<br/>
                    &nbsp;&nbsp;return <span className="highlight">false</span>;<br/>
                    {'}'}
                  </Formula>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: '1.6' }}>
                    <strong>Note:</strong> VERSION = keccak256("MINES_V1"). Grid sizes: 25 (5x5), 36 (6x6), 49 (7x7).
                    Mine positions are the first <code>mineCount</code> elements after the shuffle.
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
                    import {'{ keccak256, encodePacked, toBytes }'} from 'viem';<br/><br/>
                    const VERSION = keccak256(toBytes('MINES_V1'));<br/><br/>
                    const finalSeed = keccak256(encodePacked(<br/>
                    &nbsp;&nbsp;['bytes32', 'bytes32', 'uint64', 'bytes32'],<br/>
                    &nbsp;&nbsp;[vrfSeed, backendSalt, gameId, VERSION]<br/>
                    ));<br/><br/>
                    <span className="comment">// Fisher-Yates shuffle for each mine position</span><br/>
                    for (let i = 0; i &lt; mineCount; i++) {'{'}<br/>
                    &nbsp;&nbsp;const hash = keccak256(encodePacked(<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;['bytes32', 'uint64', 'string', 'uint8', 'bytes32'],<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;[finalSeed, gameId, 'mine', i, VERSION]<br/>
                    &nbsp;&nbsp;));<br/>
                    &nbsp;&nbsp;const j = i + (hash % (gridSize - i));<br/>
                    &nbsp;&nbsp;swap(positions[i], positions[j]);<br/>
                    {'}'}
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

export default MinesVerifyPage;
