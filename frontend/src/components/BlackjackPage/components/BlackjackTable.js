import React from 'react';
import styled, { keyframes } from 'styled-components';
import Card from './Card';
import Deck from './Deck';
import { calculateHandTotal } from '../utils/constants';

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 20px var(--shadow-color); }
  50% { box-shadow: 0 0 40px var(--border-color); }
`;

// Styled Components
const TableContainer = styled.div`
  background: linear-gradient(145deg, #1a472a 0%, #0d2818 50%, #0a1f14 100%);
  border: 8px solid #8b4513;
  border-radius: 200px 200px 20px 20px;
  padding: 30px 40px 40px;
  position: relative;
  min-height: 450px;
  box-shadow:
    inset 0 0 100px rgba(0, 0, 0, 0.3),
    0 10px 40px rgba(0, 0, 0, 0.4);

  &::before {
    content: '';
    position: absolute;
    top: 15px;
    left: 15px;
    right: 15px;
    bottom: 15px;
    border: 2px solid rgba(255, 215, 0, 0.2);
    border-radius: 190px 190px 15px 15px;
    pointer-events: none;
  }

  @media (max-width: 768px) {
    border-radius: 100px 100px 20px 20px;
    padding: 20px 15px 30px;
    min-height: 380px;
    border-width: 5px;

    &::before {
      border-radius: 90px 90px 15px 15px;
    }
  }
`;

const TableLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 20px;
  height: 100%;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 15px;
  }
`;

const GameArea = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 30px;

  @media (max-width: 768px) {
    gap: 20px;
  }
`;

const DeckArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 10px;

  @media (max-width: 768px) {
    position: absolute;
    top: 20px;
    right: 20px;
    padding: 0;
  }
`;

const HandArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ${fadeIn} 0.5s ease-out;
`;

const HandLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;

  @media (max-width: 768px) {
    font-size: 11px;
  }
`;

const CardsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  padding: 10px 20px;

  @media (max-width: 768px) {
    min-height: 100px;
    padding: 5px 10px;
  }
`;

const HandTotal = styled.div`
  background: ${props => {
    if (props.$status === 'blackjack') return 'linear-gradient(135deg, var(--accent-orange) 0%, #f59e0b 100%)';
    if (props.$status === 'busted') return 'linear-gradient(135deg, var(--accent-red) 0%, #dc2626 100%)';
    if (props.$status === 'standing') return 'linear-gradient(135deg, var(--accent-primary) 0%, #5e2db8 100%)';
    return 'rgba(0, 0, 0, 0.5)';
  }};
  color: var(--text-light);
  font-size: 18px;
  font-weight: 700;
  padding: 6px 16px;
  border-radius: 20px;
  margin-top: 10px;
  min-width: 50px;
  text-align: center;
  animation: ${props => props.$status === 'blackjack' ? pulseGlow : 'none'} 1.5s ease-in-out infinite;

  @media (max-width: 768px) {
    font-size: 16px;
    padding: 5px 12px;
  }
`;

const SplitHandsContainer = styled.div`
  display: flex;
  gap: 40px;
  justify-content: center;

  @media (max-width: 768px) {
    gap: 20px;
  }
`;

const SplitHand = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border-radius: 12px;
  background: ${props => props.$active ? 'var(--border-light)' : 'transparent'};
  border: 2px solid ${props => props.$active ? 'var(--border-color)' : 'transparent'};
  transition: all 0.3s ease;
`;

const EmptySlot = styled.div`
  width: 80px;
  height: 112px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;

  @media (max-width: 768px) {
    width: 65px;
    height: 91px;
    font-size: 10px;
  }
`;

const StatusBadge = styled.span`
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 8px;
  background: ${props => {
    if (props.$status === 'blackjack') return 'var(--accent-orange)';
    if (props.$status === 'busted') return 'var(--accent-red)';
    if (props.$status === 'standing') return 'var(--accent-primary)';
    if (props.$status === 'surrendered') return 'var(--text-secondary)';
    return 'transparent';
  }};
  color: var(--text-light);
  text-transform: uppercase;
  font-weight: 600;
`;

const BlackjackTable = ({
  playerHands = [{ cards: [], status: 'active' }],
  activeHandIndex = 0,
  dealerCards = { upCard: null, holeCard: null, hitCards: [] },
  gamePhase = 'idle',
  isDealing = false,
  dealingToHandIndex = null,
  gameId
}) => {
  const showDealerHole = gamePhase === 'dealer_turn' || gamePhase === 'completed';

  // Only animate player cards during player actions, not during dealer turn
  const isPlayerDealing = isDealing && (gamePhase === 'waiting_vrf' || gamePhase === 'player_turn');
  // Only animate dealer cards during dealer turn
  const isDealerDealing = isDealing && gamePhase === 'dealer_turn';
  const allDealerCards = [
    dealerCards.upCard,
    ...(showDealerHole && dealerCards.holeCard ? [dealerCards.holeCard] : []),
    ...dealerCards.hitCards
  ].filter(Boolean);

  const dealerTotal = calculateHandTotal(allDealerCards);
  const cardsDealt = playerHands.reduce((sum, h) => sum + (h.cards?.length || 0), 0) + allDealerCards.length;

  return (
    <TableContainer>
      <TableLayout>
        <GameArea>
          {/* Dealer Area */}
          <HandArea>
            <HandLabel>
              Dealer
              {dealerCards.upCard && !showDealerHole && (
                <StatusBadge $status="active">Shows {calculateHandTotal([dealerCards.upCard]).total}</StatusBadge>
              )}
            </HandLabel>
            <CardsRow>
              {dealerCards.upCard ? (
                <>
                  <Card
                    value={dealerCards.upCard}
                    gameId={gameId}
                    cardIndex={2}
                    index={0}
                    isDealer
                  />
                  {dealerCards.holeCard ? (
                    <Card
                      value={showDealerHole && dealerCards.holeCard !== 'facedown' ? dealerCards.holeCard : null}
                      gameId={gameId}
                      cardIndex={3}
                      faceDown={!showDealerHole || dealerCards.holeCard === 'facedown'}
                      shake={!showDealerHole && gamePhase === 'player_turn'}
                      revealing={showDealerHole && gamePhase === 'dealer_turn'}
                      isNew={dealerCards.holeCard === 'facedown'}
                      index={1}
                      isDealer
                    />
                  ) : null}
                  {dealerCards.hitCards.map((card, i) => (
                    <Card
                      key={`dealer-hit-${i}-${card}`}
                      value={card}
                      gameId={gameId}
                      cardIndex={4 + i}
                      isNew={i === dealerCards.hitCards.length - 1 && isDealerDealing}
                      index={2 + i}
                      isDealer
                    />
                  ))}
                </>
              ) : (
                <EmptySlot>Dealer</EmptySlot>
              )}
            </CardsRow>
            {allDealerCards.length > 0 && showDealerHole && (() => {
              const showSoft = dealerTotal.isSoft && dealerTotal.total <= 21;
              return (
                <HandTotal $status={dealerTotal.total > 21 ? 'busted' : 'active'}>
                  {showSoft ? `${dealerTotal.total - 10}/${dealerTotal.total}` : dealerTotal.total}
                  {dealerTotal.total > 21 && ' BUST'}
                </HandTotal>
              );
            })()}
          </HandArea>

          {/* Player Area */}
          <HandArea>
            <HandLabel>Your Hand</HandLabel>
            {playerHands.length === 1 ? (
              <>
                <CardsRow>
                  {playerHands[0].cards.length > 0 ? (
                    playerHands[0].cards.map((card, i) => (
                      <Card
                        key={i}
                        value={card}
                        gameId={gameId}
                        cardIndex={i}
                        isNew={i === playerHands[0].cards.length - 1 && isPlayerDealing}
                        highlight={playerHands[0].status === 'blackjack'}
                        index={i}
                      />
                    ))
                  ) : (
                    <EmptySlot>Your cards</EmptySlot>
                  )}
                </CardsRow>
                {playerHands[0].cards.length > 0 && (() => {
                  const handResult = calculateHandTotal(playerHands[0].cards);
                  // Only show soft notation if hand is still active (can still hit)
                  const showSoft = handResult.isSoft && handResult.total <= 21 && playerHands[0].status === 'active';
                  return (
                    <HandTotal $status={playerHands[0].status}>
                      {showSoft ? `${handResult.total - 10}/${handResult.total}` : handResult.total}
                      {playerHands[0].status === 'blackjack' && ' BJ!'}
                      {playerHands[0].status === 'busted' && ' BUST'}
                    </HandTotal>
                  );
                })()}
              </>
            ) : (
              <SplitHandsContainer>
                {playerHands.map((hand, handIdx) => {
                  const handTotal = calculateHandTotal(hand.cards);
                  const isActiveHand = handIdx === activeHandIndex;
                  const isDealingToThisHand = isPlayerDealing && dealingToHandIndex === handIdx;
                  // Only show soft notation if hand is still active (can still hit)
                  const showSoft = handTotal.isSoft && handTotal.total <= 21 && hand.status === 'active';
                  return (
                    <SplitHand key={handIdx} $active={isActiveHand}>
                      <HandLabel>Hand {handIdx + 1}</HandLabel>
                      <CardsRow>
                        {hand.cards.map((card, i) => (
                          <Card
                            key={i}
                            value={card}
                            gameId={gameId}
                            cardIndex={handIdx * 10 + i}
                            size="small"
                            index={i}
                            isNew={i === hand.cards.length - 1 && isDealingToThisHand}
                          />
                        ))}
                      </CardsRow>
                      <HandTotal $status={hand.status}>
                        {showSoft ? `${handTotal.total - 10}/${handTotal.total}` : handTotal.total}
                        {hand.status === 'busted' && ' BUST'}
                      </HandTotal>
                    </SplitHand>
                  );
                })}
              </SplitHandsContainer>
            )}
          </HandArea>
        </GameArea>

        {/* Deck Area */}
        <DeckArea>
          <Deck dealing={isDealing} cardsDealt={cardsDealt} />
        </DeckArea>
      </TableLayout>
    </TableContainer>
  );
};

export default BlackjackTable;
