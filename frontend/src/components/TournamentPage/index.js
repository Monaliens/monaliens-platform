import React, { useState, useEffect } from 'react';
import {
  PageContainer,
  ContentWrapper,
  TournamentHeader,
  TournamentTitle,
  TournamentDate,
  CountdownContainer,
  CountdownEndsIn,
  CountdownRow,
  CountdownItem,
  CountdownValue,
  CountdownLabel,
  CountdownSeparator,
  CountdownNote,
  MainLeaderboard,
  GamesGrid,
  GamePanelWrapper
} from './styles';
import LeaderboardPanel from './components/LeaderboardPanel';

const GAMES = [
  { id: 'flip', title: 'Flip' },
  { id: 'dice', title: 'Dice' },
  { id: 'limbo', title: 'Limbo' },
  { id: 'hilo', title: 'HiLo' },
  { id: 'keno', title: 'Keno' },
  { id: 'plinko', title: 'Plinko' },
  { id: 'mines', title: 'Mines' },
  { id: 'blackjack', title: 'Blackjack' }
];

// Tournament dates (UTC)
const TOURNAMENT_START = new Date('2026-05-16T12:00:00Z').getTime();
const TOURNAMENT_END = new Date('2026-05-23T11:39:00Z').getTime();

const TournamentPage = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [hasStarted, setHasStarted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();

      // Check if tournament has ended
      if (now >= TOURNAMENT_END) {
        setHasEnded(true);
        setHasStarted(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      // Check if tournament has started
      if (now < TOURNAMENT_START) {
        // Not started yet - count down to start
        setHasEnded(false);
        setHasStarted(false);
        const difference = TOURNAMENT_START - now;
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / (1000 * 60)) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        // Started - count down to end
        setHasEnded(false);
        setHasStarted(true);
        const difference = TOURNAMENT_END - now;

        if (difference > 0) {
          setTimeLeft({
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((difference / (1000 * 60)) % 60),
            seconds: Math.floor((difference / 1000) % 60)
          });
        } else {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        }
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <PageContainer>
      <ContentWrapper>
        <TournamentHeader>
          <TournamentTitle>MINI GAMES TOURNAMENT</TournamentTitle>
          
          <TournamentDate>16 MAY - 23 MAY</TournamentDate>
          {hasEnded ? (
            <CountdownContainer>
              <CountdownEndsIn style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.95)', letterSpacing: '2px' }}>
                Tournament Ended
              </CountdownEndsIn>
              <CountdownNote style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', letterSpacing: '1px' }}>
                Final Results
              </CountdownNote>
            </CountdownContainer>
          ) : (
            <>
              <CountdownContainer>
                <CountdownEndsIn>{hasStarted ? 'Ends in' : 'Starts in'}</CountdownEndsIn>
                <CountdownRow>
                  <CountdownItem>
                    <CountdownValue>{String(timeLeft.days).padStart(2, '0')}</CountdownValue>
                    <CountdownLabel>Days</CountdownLabel>
                  </CountdownItem>
                  <CountdownSeparator>:</CountdownSeparator>
                  <CountdownItem>
                    <CountdownValue>{String(timeLeft.hours).padStart(2, '0')}</CountdownValue>
                    <CountdownLabel>Hours</CountdownLabel>
                  </CountdownItem>
                  <CountdownSeparator>:</CountdownSeparator>
                  <CountdownItem>
                    <CountdownValue>{String(timeLeft.minutes).padStart(2, '0')}</CountdownValue>
                    <CountdownLabel>Mins</CountdownLabel>
                  </CountdownItem>
                  <CountdownSeparator>:</CountdownSeparator>
                  <CountdownItem>
                    <CountdownValue>{String(timeLeft.seconds).padStart(2, '0')}</CountdownValue>
                    <CountdownLabel>Secs</CountdownLabel>
                  </CountdownItem>
                </CountdownRow>
              </CountdownContainer>
              {!hasStarted && (
                <CountdownNote>The leaderboard will be reset when the tournament starts.</CountdownNote>
              )}
            </>
          )}
        </TournamentHeader>

        <MainLeaderboard>
          <LeaderboardPanel game="total" title="All Games" />
        </MainLeaderboard>

        <GamesGrid>
          {GAMES.map((game) => (
            <GamePanelWrapper key={game.id}>
              <LeaderboardPanel game={game.id} title={game.title} />
            </GamePanelWrapper>
          ))}
        </GamesGrid>
      </ContentWrapper>
    </PageContainer>
  );
};

export default TournamentPage;
