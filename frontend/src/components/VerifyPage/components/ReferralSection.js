import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Copy, Check, Users, Gift, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

// Animations
const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

// Styled Components
const ReferralCard = styled.div`
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 2px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 4px 15px var(--shadow-color);
  overflow: hidden;
  animation: ${fadeInUp} 0.6s ease-out forwards;
  opacity: 0;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 2px solid var(--border-light);

  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const CardTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const TitleIcon = styled.div`
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--border-light) 0%, var(--border-light) 100%);
  border: 2px solid var(--input-border);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  font-family: var(--font-primary);
`;

const StatsBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--success-bg);
  border: 2px solid var(--accent-green);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  color: var(--accent-green);

  svg {
    width: 16px;
    height: 16px;
  }
`;

const CardBody = styled.div`
  padding: 24px 32px;

  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const Section = styled.div`
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionLabel = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CodeContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const CodeBox = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--input-bg);
  border: 2px solid var(--input-border);
  border-radius: 10px;
  font-family: 'Courier New', monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-primary);
  letter-spacing: 2px;

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const CopyButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: ${props => props.$copied ? 'var(--success-bg)' : 'var(--accent-primary-light)'};
  color: ${props => props.$copied ? 'var(--accent-green)' : 'var(--accent-primary)'};
  border: 2px solid ${props => props.$copied ? 'var(--accent-green)' : 'var(--input-border)'};
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.$copied ? 'var(--accent-green-light)' : 'var(--input-border)'};
    transform: scale(1.05);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const CustomCodeBadge = styled.span`
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-primary);
  background: var(--accent-primary-light);
  padding: 4px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const InputRow = styled.div`
  display: flex;
  gap: 12px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Input = styled.input`
  flex: 1;
  padding: 14px 16px;
  border: 2px solid ${props => props.$error ? 'rgba(220, 38, 38, 0.5)' : 'var(--input-border)'};
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-primary);
  background: var(--input-bg);
  color: var(--text-primary);
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
  }

  &::placeholder {
    color: var(--placeholder-color);
  }

  &:disabled {
    background: var(--disabled-bg);
    cursor: not-allowed;
  }
`;

const Button = styled.button`
  padding: 14px 24px;
  background: ${props => props.$variant === 'secondary' ? 'transparent' : 'var(--accent-primary)'};
  color: ${props => props.$variant === 'secondary' ? 'var(--accent-primary)' : 'white'};
  border: 2px solid ${props => props.$variant === 'secondary' ? 'var(--accent-primary)' : 'transparent'};
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-primary);
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: ${props => props.$variant === 'secondary' ? 'var(--accent-primary-light)' : 'var(--accent-primary-hover)'};
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const Spinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--bg-glass);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
  margin-right: 8px;
`;

const ErrorMessage = styled.div`
  margin-top: 8px;
  padding: 10px 14px;
  background: var(--error-bg);
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: 8px;
  color: var(--accent-red);
  font-size: 13px;
  font-weight: 600;
`;

const WarningMessage = styled.div`
  margin-top: 12px;
  padding: 12px 14px;
  background: var(--warning-bg);
  border: 1px solid rgba(234, 88, 12, 0.25);
  border-radius: 8px;
  color: var(--accent-orange);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SuccessMessage = styled.div`
  margin-top: 8px;
  padding: 10px 14px;
  background: var(--success-bg);
  border: 1px solid rgba(22, 163, 74, 0.2);
  border-radius: 8px;
  color: var(--accent-green);
  font-size: 13px;
  font-weight: 600;
`;

const Divider = styled.div`
  height: 2px;
  background: var(--border-light);
  margin: 24px 0;
`;

const ReferralListToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: transparent;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;

  &:hover {
    background: var(--accent-primary-light);
    border-color: var(--border-color-hover);
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const ReferralList = styled.div`
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ReferralItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-glass-hover);
  border: 2px solid var(--border-light);
  border-radius: 10px;
  animation: ${fadeInUp} 0.4s ease-out forwards;
  animation-delay: ${props => props.$index * 0.05}s;
  opacity: 0;
`;

const ReferralAvatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--input-border);
`;

const ReferralAvatarPlaceholder = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--border-light) 0%, var(--border-light) 100%);
  border: 2px solid var(--input-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--accent-primary);
`;

const ReferralInfo = styled.div`
  flex: 1;
`;

const ReferralName = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
`;

const ReferralDate = styled.div`
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
`;

const LoadingBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
`;

const LoadingSpinner = styled.div`
  width: 24px;
  height: 24px;
  border: 3px solid rgba(105, 48, 195, 0.1);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
  margin-right: 12px;
`;

/**
 * ReferralSection Component
 * Displays referral code, custom code creation, apply code, and stats
 */
const ReferralSection = ({
  referralCode,
  isCustomCode,
  isLoadingCode,
  hasUsedReferral,
  usedCode,
  stats,
  isLoadingStats,
  createCustomCode,
  applyCode,
  isCreatingCustom,
  isApplyingCode,
  error,
  clearError,
  primaryWallet,
}) => {
  const [copied, setCopied] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [applyCodeInput, setApplyCodeInput] = useState('');
  const [showReferrals, setShowReferrals] = useState(false);
  const [localError, setLocalError] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);

  // Auto-apply referral code from /ref/:code redirect
  useEffect(() => {
    const pending = localStorage.getItem('pendingReferralCode');
    if (pending && !hasUsedReferral && !isLoadingCode && !autoApplying) {
      localStorage.removeItem('pendingReferralCode');
      setAutoApplying(true);

      applyCode(pending)
        .then(() => {
          toast.success('Referral code applied!');
          setApplySuccess(true);
        })
        .catch((err) => {
          setLocalError(err.message);
          setApplyCodeInput(pending); // Show in input if failed
        })
        .finally(() => {
          setAutoApplying(false);
        });
    }
  }, [hasUsedReferral, isLoadingCode, applyCode, autoApplying]);

  // Copy referral code to clipboard
  const handleCopy = () => {
    if (!referralCode) return;

    const referralLink = `${window.location.origin}/ref/${referralCode}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied!');

    setTimeout(() => setCopied(false), 2000);
  };

  // Handle custom code creation
  const handleCreateCustom = async () => {
    if (!customCodeInput.trim()) {
      setLocalError('Please enter a custom code');
      return;
    }

    // Validate: 3-20 chars, alphanumeric + -/_
    const codeRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!codeRegex.test(customCodeInput)) {
      setLocalError('Code must be 3-20 characters (letters, numbers, - or _)');
      return;
    }

    setLocalError('');
    try {
      await createCustomCode(customCodeInput);
      toast.success('Custom code created!');
      setCustomCodeInput('');
    } catch (err) {
      setLocalError(err.message);
    }
  };

  // Handle apply referral code
  const handleApplyCode = async () => {
    if (!applyCodeInput.trim()) {
      setLocalError('Please enter a referral code');
      return;
    }

    setLocalError('');
    setApplySuccess(false);
    try {
      await applyCode(applyCodeInput);
      setApplySuccess(true);
      toast.success('Referral code applied!');
      setApplyCodeInput('');
    } catch (err) {
      setLocalError(err.message);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoadingCode || autoApplying) {
    return (
      <ReferralCard>
        <CardBody>
          <LoadingBox>
            <LoadingSpinner />
            {autoApplying ? 'Applying referral code...' : 'Loading referral data...'}
          </LoadingBox>
        </CardBody>
      </ReferralCard>
    );
  }

  return (
    <ReferralCard>
      <CardHeader>
        <CardTitle>
          <TitleIcon>
            <Gift size={20} />
          </TitleIcon>
          <Title>Referrals</Title>
        </CardTitle>
        <StatsBadge>
          <Users size={16} />
          {stats.totalReferrals} invited
        </StatsBadge>
      </CardHeader>

      <CardBody>
        {/* Your Referral Code */}
        <Section>
          <SectionLabel>Your Referral Code</SectionLabel>
          <CodeContainer>
            <CodeBox>
              <span>{referralCode || '---'}</span>
              {isCustomCode && <CustomCodeBadge>Custom</CustomCodeBadge>}
            </CodeBox>
            <CopyButton onClick={handleCopy} $copied={copied} disabled={!referralCode}>
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </CopyButton>
          </CodeContainer>
          {!primaryWallet && (
            <WarningMessage>
              <AlertTriangle size={16} />
              Set a primary wallet in the Wallets tab to earn referral rewards.
            </WarningMessage>
          )}
        </Section>

        {/* Create Custom Code (only if not already custom) */}
        {!isCustomCode && (
          <Section>
            <SectionLabel>Create Custom Code</SectionLabel>
            <InputRow>
              <Input
                type="text"
                placeholder="e.g. monaliens, alien123"
                value={customCodeInput}
                onChange={(e) => {
                  setCustomCodeInput(e.target.value.toLowerCase());
                  setLocalError('');
                  clearError?.();
                }}
                maxLength={20}
                disabled={isCreatingCustom}
              />
              <Button
                onClick={handleCreateCustom}
                disabled={isCreatingCustom || !customCodeInput.trim()}
              >
                {isCreatingCustom && <Spinner />}
                {isCreatingCustom ? 'Creating...' : 'Create'}
              </Button>
            </InputRow>
          </Section>
        )}

        <Divider />

        {/* Apply Referral Code */}
        <Section>
          <SectionLabel>
            {hasUsedReferral ? 'Used Referral Code' : 'Got a Referral Code?'}
          </SectionLabel>
          {hasUsedReferral ? (
            <SuccessMessage>
              You used code <strong>{usedCode}</strong>
            </SuccessMessage>
          ) : (
            <>
              <InputRow>
                <Input
                  type="text"
                  placeholder="Enter referral code"
                  value={applyCodeInput}
                  onChange={(e) => {
                    setApplyCodeInput(e.target.value);
                    setLocalError('');
                    setApplySuccess(false);
                    clearError?.();
                  }}
                  disabled={isApplyingCode}
                  $error={!!localError}
                />
                <Button
                  $variant="secondary"
                  onClick={handleApplyCode}
                  disabled={isApplyingCode || !applyCodeInput.trim()}
                >
                  {isApplyingCode && <Spinner />}
                  {isApplyingCode ? 'Applying...' : 'Apply'}
                </Button>
              </InputRow>
              {applySuccess && (
                <SuccessMessage>Referral code applied successfully!</SuccessMessage>
              )}
            </>
          )}
        </Section>

        {/* Error Display */}
        {(localError || error) && (
          <ErrorMessage>{localError || error}</ErrorMessage>
        )}

        {/* Referral List */}
        {stats.totalReferrals > 0 && (
          <>
            <Divider />
            <ReferralListToggle onClick={() => setShowReferrals(!showReferrals)}>
              {showReferrals ? <ChevronUp /> : <ChevronDown />}
              {showReferrals ? 'Hide' : 'Show'} invited users ({stats.totalReferrals})
            </ReferralListToggle>

            {showReferrals && (
              <ReferralList>
                {isLoadingStats ? (
                  <LoadingBox>
                    <LoadingSpinner />
                    Loading...
                  </LoadingBox>
                ) : (
                  stats.referrals.map((referral, index) => (
                    <ReferralItem key={referral.discordId} $index={index}>
                      {referral.avatarUrl ? (
                        <ReferralAvatar src={referral.avatarUrl} alt={referral.globalName || referral.username} />
                      ) : (
                        <ReferralAvatarPlaceholder>
                          {(referral.globalName || referral.username || '?')[0].toUpperCase()}
                        </ReferralAvatarPlaceholder>
                      )}
                      <ReferralInfo>
                        <ReferralName>{referral.globalName || referral.username}</ReferralName>
                        <ReferralDate>Joined {formatDate(referral.usedAt)}</ReferralDate>
                      </ReferralInfo>
                    </ReferralItem>
                  ))
                )}
              </ReferralList>
            )}
          </>
        )}
      </CardBody>
    </ReferralCard>
  );
};

export default ReferralSection;
