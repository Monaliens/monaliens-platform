import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const SearchWrapper = styled.div`
  position: relative;
  height: ${props => props.$compact ? '34px' : '40px'};
  display: inline-flex;
  align-items: center;
`;

const SearchDock = styled.form`
  height: ${props => props.$compact ? '34px' : '40px'};
  width: ${props => props.$compact ? (props.$open ? '210px' : '44px') : (props.$open ? '330px' : '42px')};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  overflow: hidden;
  border: 2px solid ${props => props.$open ? 'var(--accent-primary)' : props.$active ? 'var(--accent-primary)' : 'var(--border-light)'};
  border-radius: ${props => props.$compact && !props.$open ? '12px' : '999px'};
  background: ${props => props.$open
    ? 'var(--bg-card)'
    : props.$active ? 'linear-gradient(135deg, var(--accent-primary) 0%, #8e44ad 100%)' : 'transparent'};
  box-shadow: ${props => props.$open ? '0 8px 22px rgba(124, 58, 237, 0.18)' : 'none'};
  transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  transform-origin: right center;

  @media (max-width: 768px) {
    width: ${props => props.$compact ? (props.$open ? 'min(100%, 210px)' : '44px') : (props.$open ? 'min(100%, 320px)' : '42px')};
  }
`;

const SearchInput = styled.input`
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: ${props => props.$compact ? '0 0.2rem 0 0.65rem' : '0 0.35rem 0 0.9rem'};
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: ${props => props.$compact ? '0.72rem' : '0.82rem'};
  font-family: monospace;
  outline: none;
  opacity: ${props => props.$open ? 1 : 0};
  pointer-events: ${props => props.$open ? 'auto' : 'none'};
  transition: opacity 0.18s ease;

  &::placeholder {
    color: var(--placeholder-color);
  }
`;

const SearchIconButton = styled.button`
  width: ${props => props.$compact ? (props.$open ? '34px' : '40px') : '40px'};
  height: ${props => props.$compact ? '34px' : '40px'};
  border-radius: 50%;
  border: none;
  background: transparent;
  color: ${props => props.$active && !props.$open ? 'white' : 'var(--accent-primary)'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.2s ease, color 0.2s ease, background 0.2s ease;

  &:hover {
    transform: scale(1.06);
    background: ${props => props.$open ? 'var(--border-light)' : 'transparent'};
  }

  svg {
    width: ${props => props.$compact ? '16px' : '18px'};
    height: ${props => props.$compact ? '16px' : '18px'};
  }
`;

const SearchedAddressPill = styled.div`
  height: ${props => props.$compact ? '34px' : '40px'};
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px 0 12px;
  border: 2px solid var(--accent-primary);
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.14) 0%, rgba(142, 68, 173, 0.08) 100%);
  color: var(--text-primary);
  box-shadow: 0 8px 22px rgba(124, 58, 237, 0.14);
  animation: ${fadeIn} 0.18s ease-out;
`;

const SearchedAddressText = styled.button`
  border: none;
  padding: 0;
  background: transparent;
  color: var(--accent-primary);
  font-family: monospace;
  font-size: ${props => props.$compact ? '0.72rem' : '0.82rem'};
  font-weight: 700;
  cursor: pointer;
`;

const ClearSearchButton = styled.button`
  width: ${props => props.$compact ? '22px' : '26px'};
  height: ${props => props.$compact ? '22px' : '26px'};
  border-radius: 50%;
  border: none;
  background: var(--border-light);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  line-height: 1;
  transition: background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.16);
    color: var(--accent-red);
    transform: scale(1.06);
  }
`;

const ErrorText = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  color: var(--accent-red);
  font-size: 0.76rem;
  text-align: right;
  white-space: nowrap;
  z-index: 2;
`;

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <line x1="16.65" y1="16.65" x2="21" y2="21" />
  </svg>
);

const defaultFormatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const HistoryAddressSearch = ({ active, searchedAddress, onSearch, onClear, formatAddress = defaultFormatAddress, onOpenChange, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const openSearch = () => {
    setInput(searchedAddress || '');
    setError('');
    setIsOpen(true);
  };

  const submitSearch = (event) => {
    event.preventDefault();

    if (!isOpen) {
      openSearch();
      return;
    }

    const nextAddress = input.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(nextAddress)) {
      setError('Enter a valid wallet address.');
      return;
    }

    setError('');
    setIsOpen(false);
    setInput(nextAddress);
    onSearch(nextAddress);
  };

  const clearSearch = () => {
    setInput('');
    setError('');
    setIsOpen(false);
    onClear();
  };

  if (active && searchedAddress && !isOpen) {
    return (
      <SearchedAddressPill $compact={compact}>
        <SearchedAddressText $compact={compact} type="button" title={searchedAddress} onClick={openSearch}>
          {formatAddress(searchedAddress)}
        </SearchedAddressText>
        <ClearSearchButton $compact={compact} type="button" aria-label="Clear address search" onClick={clearSearch}>
          ×
        </ClearSearchButton>
      </SearchedAddressPill>
    );
  }

  return (
    <SearchWrapper $compact={compact}>
      <SearchDock onSubmit={submitSearch} $open={isOpen} $active={active} $compact={compact}>
        <SearchInput
          ref={inputRef}
          $open={isOpen}
          $compact={compact}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Wallet address (0x...)"
          autoComplete="off"
          spellCheck="false"
        />
        <SearchIconButton
          type={isOpen ? 'submit' : 'button'}
          $open={isOpen}
          $active={active}
          $compact={compact}
          aria-label={isOpen ? 'Search games' : 'Open address search'}
          title={isOpen ? 'Search' : 'Search by address'}
          onClick={() => {
            if (!isOpen) openSearch();
          }}
        >
          <SearchIcon />
        </SearchIconButton>
      </SearchDock>
      {error && <ErrorText>{error}</ErrorText>}
    </SearchWrapper>
  );
};

export default HistoryAddressSearch;
