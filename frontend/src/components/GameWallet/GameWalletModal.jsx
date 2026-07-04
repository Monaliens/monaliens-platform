import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { X, DollarSign, ArrowUpRight, Clock, Gamepad2, Key, Copy, Check, AlertTriangle } from 'lucide-react';
import { useGameWallet } from '../../context';
import { useReownWallet } from '../../hooks/useReownWallet';
import { parseEther, formatEther } from 'viem';
import { http, createPublicClient } from 'viem';
import { monadMainnet } from '../../config/reownConfig';
import { useSendTransaction } from 'wagmi';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(4px) scale(0.99); }
  to { transform: translateY(0) scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 0.15s ease-out;
`;

const Modal = styled.div`
  background: var(--apkt-tokens-theme-backgroundPrimary, #202020);
  border-radius: 24px;
  max-width: 370px;
  width: 100%;
  margin: 16px;
  box-shadow: 0 0 0 1px var(--apkt-tokens-theme-foregroundPrimary, #2a2a2a),
              0 2px 8px rgba(0, 0, 0, 0.05);
  animation: ${slideUp} 0.15s ease-out;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0 16px;
`;

const CloseButton = styled.button`
  background: var(--apkt-tokens-theme-foregroundPrimary, #2a2a2a);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--apkt-tokens-theme-iconDefault, #9A9A9A);
  transition: all 0.15s ease;

  &:hover {
    background: var(--apkt-tokens-theme-foregroundSecondary, #363636);
    color: var(--apkt-tokens-theme-textPrimary, #fff);
  }
`;

const AvatarSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 20px 16px;
`;

const Avatar = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #7c3aed;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;

  svg {
    width: 32px;
    height: 32px;
  }
`;

const AddressDisplay = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: var(--apkt-tokens-theme-textPrimary, #fff);
`;

const BalanceDisplay = styled.div`
  display: flex;
  align-items: baseline;
  gap: 4px;
`;

const BalanceMain = styled.span`
  font-size: 32px;
  font-weight: 600;
  color: var(--apkt-tokens-theme-textPrimary, #fff);
`;

const BalanceDecimal = styled.span`
  font-size: 32px;
  font-weight: 600;
  color: var(--apkt-tokens-theme-textSecondary, #9A9A9A);
`;

const BalanceSymbol = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--apkt-tokens-theme-textPrimary, #fff);
  margin-left: 4px;
`;

const MenuList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px 12px;
`;

const MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--apkt-tokens-theme-textPrimary, #fff);

  &:hover {
    background: var(--apkt-tokens-theme-foregroundPrimary, #2a2a2a);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MenuIconBox = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--apkt-tokens-theme-foregroundPrimary, #2a2a2a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.$color || 'inherit'};

  svg {
    width: 20px;
    height: 20px;
  }
`;

const MenuText = styled.span`
  flex: 1;
  text-align: left;
  font-size: 16px;
  font-weight: 500;
`;

const ChevronRight = styled.span`
  color: var(--apkt-tokens-theme-iconDefault, #9A9A9A);
`;

const Panel = styled.div`
  padding: 16px;
`;

const InputGroup = styled.div`
  margin-bottom: 16px;
`;

const InputLabel = styled.label`
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--apkt-tokens-theme-textSecondary, #9A9A9A);
  margin-bottom: 8px;
  text-transform: uppercase;
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: center;
  background: var(--apkt-tokens-theme-foregroundPrimary, #2a2a2a);
  border-radius: 12px;
  padding: 12px;
  gap: 8px;
`;

const Input = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 18px;
  font-weight: 600;
  color: var(--apkt-tokens-theme-textPrimary, #fff);

  &::placeholder {
    color: var(--apkt-tokens-theme-textSecondary, #9A9A9A);
  }
`;

const InputSuffix = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--apkt-tokens-theme-textSecondary, #9A9A9A);
`;

const QuickAmounts = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
`;

const QuickButton = styled.button`
  flex: 1;
  padding: 8px;
  background: var(--apkt-tokens-theme-foregroundPrimary, #2a2a2a);
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--apkt-tokens-theme-textSecondary, #9A9A9A);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--apkt-tokens-theme-foregroundSecondary, #363636);
    color: var(--apkt-tokens-theme-textPrimary, #fff);
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 14px;
  background: #7c3aed;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: #6d28d9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--apkt-tokens-theme-textSecondary, #9A9A9A);
  font-size: 14px;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: var(--apkt-tokens-theme-textPrimary, #fff);
  }
`;

const AvailableBalance = styled.div`
  font-size: 12px;
  color: var(--apkt-tokens-theme-textSecondary, #9A9A9A);
  margin-top: 8px;
`;

const WarningBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: 12px;
  margin-bottom: 16px;

  svg {
    flex-shrink: 0;
    color: #eab308;
  }
`;

const WarningText = styled.p`
  font-size: 13px;
  color: var(--apkt-tokens-theme-textSecondary, #9A9A9A);
  margin: 0;
  line-height: 1.4;
`;

const PrivateKeyBox = styled.div`
  position: relative;
  background: var(--apkt-tokens-theme-foregroundPrimary, #2a2a2a);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 16px;
`;

const PrivateKeyText = styled.code`
  display: block;
  font-size: 11px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  color: var(--apkt-tokens-theme-textPrimary, #fff);
  word-break: break-all;
  line-height: 1.5;
  user-select: all;
`;

const CopyButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: var(--apkt-tokens-theme-foregroundPrimary, #2a2a2a);
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--apkt-tokens-theme-textPrimary, #fff);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--apkt-tokens-theme-foregroundSecondary, #363636);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const GameWalletModal = ({ isOpen, onClose }) => {
  const { address, balance, displayAddress, refreshBalance, gameWallet, sendTransaction, isTeeMode } = useGameWallet();
  const { walletAddress } = useReownWallet();
  const [view, setView] = useState('main');
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [mainWalletBalance, setMainWalletBalance] = useState('0');

  const publicClient = createPublicClient({
    chain: monadMainnet,
    transport: http()
  });

  const { sendTransactionAsync } = useSendTransaction();

  React.useEffect(() => {
    if (walletAddress && isOpen) {
      publicClient.getBalance({ address: walletAddress }).then(bal => {
        setMainWalletBalance(formatEther(bal));
      });
    }
  }, [walletAddress, isOpen]);

  // Reset view when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setView('main');
      setAmount('');
      setCopied(false);
      setShowKey(false);
      setCountdown(3);
    }
  }, [isOpen]);

  // Countdown timer for export view
  React.useEffect(() => {
    if (view === 'export' && !showKey && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [view, showKey, countdown]);

  // Reset export state when leaving export view
  React.useEffect(() => {
    if (view !== 'export') {
      setShowKey(false);
      setCountdown(3);
    }
  }, [view]);

  const handleFund = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setIsLoading(true);
    try {
      await sendTransactionAsync({
        to: address,
        value: parseEther(amount)
      });

      await refreshBalance();
      const newMainBal = await publicClient.getBalance({ address: walletAddress });
      setMainWalletBalance(formatEther(newMainBal));

      setAmount('');
      setView('main');
    } catch (err) {
      console.error('Fund failed:', err);
    }
    setIsLoading(false);
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (!gameWallet) {
      console.error('Game wallet not available');
      return;
    }

    setIsLoading(true);
    try {
      // TEE mode: use sendTransaction from context
      // Local mode: use sendTransaction from context (handles both)
      await sendTransaction({
        to: walletAddress,
        value: parseEther(amount)
      });

      await refreshBalance();
      const newMainBal = await publicClient.getBalance({ address: walletAddress });
      setMainWalletBalance(formatEther(newMainBal));

      setAmount('');
      setView('main');
    } catch (err) {
      console.error('Withdraw failed:', err);
    }
    setIsLoading(false);
  };

  const setQuickAmount = (percentage, sourceBalance) => {
    const bal = parseFloat(sourceBalance);
    const amt = (bal * percentage / 100).toFixed(4);
    setAmount(amt);
  };

  const handleCopyPrivateKey = async () => {
    if (!gameWallet?.privateKey) return;
    try {
      await navigator.clipboard.writeText(gameWallet.privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (!isOpen) return null;

  const balanceParts = parseFloat(balance).toFixed(3).split('.');
  const mainBalanceParts = parseFloat(mainWalletBalance).toFixed(3).split('.');

  const modalContent = (
    <Overlay onClick={onClose}>
      <Modal onClick={e => e.stopPropagation()}>
        <Header>
          {view !== 'main' ? (
            <BackButton onClick={() => setView('main')}>
              ← Back
            </BackButton>
          ) : (
            <div />
          )}
          <CloseButton onClick={onClose}>
            <X size={16} />
          </CloseButton>
        </Header>

        {view === 'main' && (
          <>
            <AvatarSection>
              <Avatar>
                <Gamepad2 />
              </Avatar>
              <AddressDisplay>{displayAddress}</AddressDisplay>
              <BalanceDisplay>
                <BalanceMain>{balanceParts[0]}</BalanceMain>
                <BalanceDecimal>.{balanceParts[1]}</BalanceDecimal>
                <BalanceSymbol>MON</BalanceSymbol>
              </BalanceDisplay>
            </AvatarSection>

            <MenuList>
              <MenuItem onClick={() => setView('fund')}>
                <MenuIconBox $color="#7c3aed">
                  <DollarSign />
                </MenuIconBox>
                <MenuText>Fund Game Wallet</MenuText>
                <ChevronRight>›</ChevronRight>
              </MenuItem>

              <MenuItem onClick={() => setView('withdraw')}>
                <MenuIconBox>
                  <ArrowUpRight />
                </MenuIconBox>
                <MenuText>Withdraw to Main</MenuText>
                <ChevronRight>›</ChevronRight>
              </MenuItem>

              <MenuItem disabled>
                <MenuIconBox>
                  <Clock />
                </MenuIconBox>
                <MenuText>Activity</MenuText>
                <ChevronRight>›</ChevronRight>
              </MenuItem>

              {!isTeeMode && (
                <MenuItem onClick={() => setView('export')}>
                  <MenuIconBox $color="#eab308">
                    <Key />
                  </MenuIconBox>
                  <MenuText>Export Private Key</MenuText>
                  <ChevronRight>›</ChevronRight>
                </MenuItem>
              )}
            </MenuList>
          </>
        )}

        {view === 'fund' && (
          <Panel>
            <AvatarSection style={{ padding: '8px 0 16px' }}>
              <BalanceDisplay>
                <BalanceMain>{mainBalanceParts[0]}</BalanceMain>
                <BalanceDecimal>.{mainBalanceParts[1]}</BalanceDecimal>
                <BalanceSymbol>MON</BalanceSymbol>
              </BalanceDisplay>
              <AvailableBalance>Available in Main Wallet</AvailableBalance>
            </AvatarSection>

            <InputGroup>
              <InputLabel>Amount to Fund</InputLabel>
              <InputWrapper>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  step="0.01"
                />
                <InputSuffix>MON</InputSuffix>
              </InputWrapper>
            </InputGroup>

            <QuickAmounts>
              <QuickButton onClick={() => setQuickAmount(25, mainWalletBalance)}>25%</QuickButton>
              <QuickButton onClick={() => setQuickAmount(50, mainWalletBalance)}>50%</QuickButton>
              <QuickButton onClick={() => setQuickAmount(75, mainWalletBalance)}>75%</QuickButton>
              <QuickButton onClick={() => setQuickAmount(100, mainWalletBalance)}>MAX</QuickButton>
            </QuickAmounts>

            <SubmitButton onClick={handleFund} disabled={isLoading || !amount}>
              {isLoading ? 'Funding...' : 'Fund Game Wallet'}
            </SubmitButton>
          </Panel>
        )}

        {view === 'withdraw' && (
          <Panel>
            <AvatarSection style={{ padding: '8px 0 16px' }}>
              <BalanceDisplay>
                <BalanceMain>{balanceParts[0]}</BalanceMain>
                <BalanceDecimal>.{balanceParts[1]}</BalanceDecimal>
                <BalanceSymbol>MON</BalanceSymbol>
              </BalanceDisplay>
              <AvailableBalance>Available in Game Wallet</AvailableBalance>
            </AvatarSection>

            <InputGroup>
              <InputLabel>Amount to Withdraw</InputLabel>
              <InputWrapper>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  step="0.01"
                />
                <InputSuffix>MON</InputSuffix>
              </InputWrapper>
            </InputGroup>

            <QuickAmounts>
              <QuickButton onClick={() => setQuickAmount(25, balance)}>25%</QuickButton>
              <QuickButton onClick={() => setQuickAmount(50, balance)}>50%</QuickButton>
              <QuickButton onClick={() => setQuickAmount(75, balance)}>75%</QuickButton>
              <QuickButton onClick={() => setQuickAmount(100, balance)}>MAX</QuickButton>
            </QuickAmounts>

            <SubmitButton onClick={handleWithdraw} disabled={isLoading || !amount}>
              {isLoading ? 'Withdrawing...' : 'Withdraw to Main Wallet'}
            </SubmitButton>
          </Panel>
        )}

        {view === 'export' && (
          <Panel>
            <WarningBox>
              <AlertTriangle size={20} />
              <WarningText>
                <strong>Never share your private key with anyone!</strong>
                <br /><br />
                Anyone with access to this key can steal all funds in your game wallet.
                Monaliens team will never ask for your private key.
                <br /><br />
                <em>This key is only for this game wallet, not your main wallet.</em>
              </WarningText>
            </WarningBox>

            {!showKey ? (
              <SubmitButton
                onClick={() => setShowKey(true)}
                disabled={countdown > 0}
                style={{ background: countdown > 0 ? '#4b5563' : '#dc2626' }}
              >
                {countdown > 0
                  ? `I understand the risks (${countdown}s)`
                  : 'I understand, show my private key'
                }
              </SubmitButton>
            ) : (
              <>
                <InputGroup>
                  <InputLabel>Private Key</InputLabel>
                  <PrivateKeyBox>
                    <PrivateKeyText>
                      {gameWallet?.privateKey || 'Not available'}
                    </PrivateKeyText>
                  </PrivateKeyBox>
                </InputGroup>

                <CopyButton onClick={handleCopyPrivateKey}>
                  {copied ? (
                    <>
                      <Check />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy />
                      Copy to Clipboard
                    </>
                  )}
                </CopyButton>
              </>
            )}
          </Panel>
        )}
      </Modal>
    </Overlay>
  );

  return createPortal(modalContent, document.body);
};

export default GameWalletModal;
