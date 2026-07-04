import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { io } from 'socket.io-client';
import monadIcon from '../../assets/images/monad.png';
import {
  PageContainer,
  ContentWrapper,
  Header,
  MonthSwitcher,
  SwitchButton,
  MonthLabel,
  ActiveMonth,
  ActiveYear,
  AnimatedContent,
  RevenueScene,
  RevenueTopline,
  FlowMetric,
  FlowLabel,
  FlowValue,
  MainRevenue,
  RevenueLabel,
  RevenueValue,
  RevenueUnit,
  RevenueDivider,
  RevenueFooter,
  FooterMetric,
  FooterLabel,
  FooterValue,
  BreakdownSection,
  BreakdownHeader,
  BreakdownTitle,
  MetaText,
  BreakdownList,
  GameRow,
  GameIdentity,
  GameRank,
  GameName,
  GameProfit,
  BarTrack,
  BarFill,
  GameMetrics,
  RowMetric,
  RowMetricLabel,
  RowMetricValue,
  AmountGroup,
  AmountIcon,
  StateBox,
  RetryButton,
} from './styles';

const API_BASE_URL = process.env.API_URL || 'https://your-api-url';
const API_URL = `${API_BASE_URL}/api/games/pnl`;
const pnlCache = new Map();
let pnlSocket = null;
let pnlSocketSubscribers = 0;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const getCurrentPeriod = () => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
};

const shiftPeriod = (period, direction) => {
  const date = new Date(period.year, period.month - 1 + direction, 1);
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
};

const getPeriodCacheKey = ({ year, month }) => `${year}-${month}`;

const getPnlSocket = () => {
  if (!pnlSocket) {
    pnlSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
    });
  }
  return pnlSocket;
};

const formatSideMonth = (period, selectedYear) => {
  const label = MONTH_NAMES[period.month - 1].toLowerCase();
  return period.year === selectedYear ? label : `${label} ${period.year}`;
};

const shouldShowYear = (period, currentPeriod) => period.year !== currentPeriod.year;

const GAME_ROUTES = {
  flip: '/flip',
  hilo: '/hilo',
  dice: '/dice',
  blackjack: '/blackjack',
  mines: '/mines',
  limbo: '/limbo',
  keno: '/keno',
  plinko: '/plinko',
};

const formatGameName = (game) => {
  if (!game) return 'Unknown';
  if (game === 'hilo') return 'Hi-Lo';
  return game.charAt(0).toUpperCase() + game.slice(1);
};

const getGameRoute = (game) => GAME_ROUTES[String(game || '').toLowerCase()];

const parseAmount = (value) => {
  const parsed = Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatWholeNumber = (value) => {
  const parsed = Number.parseFloat(value || '0');
  if (!Number.isFinite(parsed)) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(parsed));
};

const getGameCount = (game) => {
  return game?.games ?? game?.gameCount ?? game?.totalGames ?? 0;
};

const getPnlTone = (value) => {
  const amount = parseAmount(value);
  if (amount > 0) return 'profit';
  if (amount < 0) return 'loss';
  return 'neutral';
};

const formatUpdatedAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const MonAmount = ({ value, size = 'md' }) => (
  <AmountGroup $size={size}>
    <span>{formatWholeNumber(value)}</span>
    <AmountIcon src={monadIcon} alt="MON" $size={size} />
  </AmountGroup>
);

const fetchPnl = async ({ month, year, signal }) => {
  const cacheKey = getPeriodCacheKey({ year, month });
  if (pnlCache.has(cacheKey)) {
    return pnlCache.get(cacheKey);
  }

  const params = new URLSearchParams({
    month: String(month),
    year: String(year),
  });
  const response = await fetch(`${API_URL}?${params.toString()}`, { signal });
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || 'Failed to load profits data');
  }

  pnlCache.set(cacheKey, data);
  return data;
};

const prefetchPnl = ({ month, year }) => {
  const cacheKey = getPeriodCacheKey({ year, month });
  if (pnlCache.has(cacheKey)) return;
  fetchPnl({ month, year }).catch(() => {});
};

const usePnlData = (period) => {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    periodKey: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const retry = useCallback(() => {
    pnlCache.delete(getPeriodCacheKey({ month: period.month, year: period.year }));
    setRefreshKey((value) => value + 1);
  }, [period.month, period.year]);

  useEffect(() => {
    const controller = new AbortController();
    const cacheKey = getPeriodCacheKey(period);
    const cachedData = pnlCache.get(cacheKey);

    setState((current) => ({
      data: cachedData || (current.periodKey === cacheKey ? current.data : null),
      loading: !cachedData,
      error: null,
      periodKey: cacheKey,
    }));

    if (cachedData) return () => controller.abort();

    fetchPnl({ ...period, signal: controller.signal })
      .then((data) => {
        setState({ data, loading: false, error: null, periodKey: cacheKey });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState((current) => ({
          data: current.data,
          loading: false,
          error: error.message || 'Failed to load profits data',
          periodKey: cacheKey,
        }));
      });

    return () => controller.abort();
  }, [period.month, period.year, refreshKey]);

  return { ...state, retry };
};

const useAnimatedNumber = (value, duration = 650) => {
  const targetValue = parseAmount(value);
  const [displayValue, setDisplayValue] = useState(targetValue);
  const previousValueRef = useRef(targetValue);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const difference = targetValue - startValue;

    if (difference === 0) {
      setDisplayValue(targetValue);
      return undefined;
    }

    let frameId;
    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + difference * eased;

      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        previousValueRef.current = targetValue;
        setDisplayValue(targetValue);
      }
    };

    frameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameId);
      previousValueRef.current = targetValue;
    };
  }, [duration, targetValue]);

  return displayValue;
};

const ProfitsPage = () => {
  const currentPeriod = useMemo(() => getCurrentPeriod(), []);
  const [period, setPeriod] = useState(currentPeriod);
  const [slideDirection, setSlideDirection] = useState(0);
  const previousBreakdownRef = useRef({ periodKey: null, values: new Map() });
  const [rowAnimations, setRowAnimations] = useState({});
  const { data, loading, error, retry } = usePnlData(period);

  const isCurrentOrFuture =
    period.year > currentPeriod.year ||
    (period.year === currentPeriod.year && period.month >= currentPeriod.month);
  const previousPeriod = useMemo(() => shiftPeriod(period, -1), [period]);
  const nextPeriod = useMemo(() => shiftPeriod(period, 1), [period]);

  const moveMonth = useCallback((direction) => {
    setSlideDirection(direction);
    setPeriod((current) => shiftPeriod(current, direction));
  }, []);

  useEffect(() => {
    prefetchPnl(previousPeriod);
    if (!isCurrentOrFuture) {
      prefetchPnl(nextPeriod);
    }
  }, [isCurrentOrFuture, nextPeriod, previousPeriod]);

  useEffect(() => {
    const socket = getPnlSocket();
    pnlSocketSubscribers += 1;

    const handlePnlUpdate = (event) => {
      const eventMonth = Number(event?.period?.month);
      const eventYear = Number(event?.period?.year);

      if (!Number.isFinite(eventMonth) || !Number.isFinite(eventYear)) return;

      pnlCache.delete(getPeriodCacheKey({ month: eventMonth, year: eventYear }));

      if (eventMonth === period.month && eventYear === period.year) {
        retry();
      }
    };

    socket.on('stats:pnl:update', handlePnlUpdate);

    return () => {
      socket.off('stats:pnl:update', handlePnlUpdate);
      pnlSocketSubscribers = Math.max(0, pnlSocketSubscribers - 1);

      if (pnlSocketSubscribers === 0) {
        socket.disconnect();
        pnlSocket = null;
      }
    };
  }, [period.month, period.year, retry]);

  const sortedGames = useMemo(() => {
    const games = Array.isArray(data?.byGame) ? data.byGame : [];
    return games
      .sort((a, b) => parseAmount(b.housePnl) - parseAmount(a.housePnl));
  }, [data?.byGame]);

  const maxHousePnl = useMemo(() => {
    return sortedGames.reduce((max, game) => Math.max(max, Math.abs(parseAmount(game.housePnl))), 0);
  }, [sortedGames]);

  const updatedAt = formatUpdatedAt(data?.updatedAt);
  const total = data?.total || {};
  const animatedHousePnl = useAnimatedNumber(total.housePnl);
  const animatedWagered = useAnimatedNumber(total.wagered);
  const animatedPayout = useAnimatedNumber(total.payout);
  const animatedFee = useAnimatedNumber(total.fee);
  const animatedGames = useAnimatedNumber(total.games);
  const hasTotalActivity =
    parseAmount(total.housePnl) !== 0 ||
    parseAmount(total.wagered) !== 0 ||
    parseAmount(total.payout) !== 0 ||
    Number(getGameCount(total)) > 0;
  const hasBreakdownActivity = sortedGames.some((game) => (
    parseAmount(game.housePnl) !== 0 ||
    parseAmount(game.wagered) !== 0 ||
    parseAmount(game.payout) !== 0 ||
    Number(getGameCount(game)) > 0
  ));

  useEffect(() => {
    if (!data?.period || !Array.isArray(data?.byGame)) return;

    const dataPeriodKey = getPeriodCacheKey(data.period);
    const nextValues = new Map(
      data.byGame.map((game) => [game.game, parseAmount(game.housePnl)])
    );
    const previous = previousBreakdownRef.current;

    if (previous.periodKey !== dataPeriodKey) {
      previousBreakdownRef.current = { periodKey: dataPeriodKey, values: nextValues };
      setRowAnimations({});
      return;
    }

    const nextAnimations = {};

    nextValues.forEach((nextValue, game) => {
      const previousValue = previous.values.get(game);
      if (previousValue === undefined || previousValue === nextValue) return;

      nextAnimations[game] = {
        id: `${Date.now()}-${game}`,
        trend: nextValue > previousValue ? 'up' : 'down',
      };
    });

    previousBreakdownRef.current = { periodKey: dataPeriodKey, values: nextValues };
    setRowAnimations(nextAnimations);
  }, [data]);

  return (
    <PageContainer>
      <ContentWrapper>
        <Header>
          <MonthSwitcher aria-label="Profit month selector">
            <SwitchButton type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">
              <ChevronLeft />
              {formatSideMonth(previousPeriod, period.year)}
            </SwitchButton>
            <MonthLabel>
              <ActiveMonth>{MONTH_NAMES[period.month - 1]}</ActiveMonth>
              {shouldShowYear(period, currentPeriod) && <ActiveYear>{period.year}</ActiveYear>}
            </MonthLabel>
            <SwitchButton
              type="button"
              onClick={() => moveMonth(1)}
              disabled={isCurrentOrFuture}
              aria-label="Next month"
              $align="right"
            >
              {formatSideMonth(nextPeriod, period.year)}
              <ChevronRight />
            </SwitchButton>
          </MonthSwitcher>
        </Header>

        {loading && !data ? (
          <StateBox>Loading profits...</StateBox>
        ) : error && !data ? (
          <StateBox>
            <div>{error}</div>
            <RetryButton type="button" onClick={retry}>Retry</RetryButton>
          </StateBox>
        ) : (
          <AnimatedContent key={`${period.year}-${period.month}`} $direction={slideDirection}>
            <RevenueScene aria-busy={loading}>
              <RevenueTopline>
                <FlowMetric>
                  <FlowLabel>Wagered</FlowLabel>
                  <FlowValue><MonAmount value={animatedWagered} size="flow" /></FlowValue>
                </FlowMetric>

                <MainRevenue>
                  <RevenueLabel>Revenue</RevenueLabel>
                  <RevenueValue><MonAmount value={animatedHousePnl} size="hero" /></RevenueValue>
                  <RevenueUnit>net house position</RevenueUnit>
                </MainRevenue>

                <FlowMetric $align="right">
                  <FlowLabel>Payout</FlowLabel>
                  <FlowValue><MonAmount value={animatedPayout} size="flow" /></FlowValue>
                </FlowMetric>
              </RevenueTopline>

              <RevenueDivider />

              <RevenueFooter>
                <FooterMetric>
                  <FooterLabel>Fees</FooterLabel>
                  <FooterValue><MonAmount value={animatedFee} size="footer" /></FooterValue>
                </FooterMetric>
                <FooterMetric>
                  <FooterLabel>Game Count</FooterLabel>
                  <FooterValue>{formatWholeNumber(animatedGames)}</FooterValue>
                </FooterMetric>
              </RevenueFooter>
            </RevenueScene>

            <BreakdownSection>
              <BreakdownHeader>
                <BreakdownTitle>Game Breakdown</BreakdownTitle>
                <MetaText>
                  {loading ? 'Loading latest data...' : updatedAt ? `Updated ${updatedAt}` : ''}
                </MetaText>
              </BreakdownHeader>

              {error && (
                <StateBox>
                  <div>{error}</div>
                  <RetryButton type="button" onClick={retry}>Retry</RetryButton>
                </StateBox>
              )}

              {!error && sortedGames.length === 0 && !loading && (
                <StateBox>No breakdown data</StateBox>
              )}

              {!error && sortedGames.length > 0 && hasTotalActivity && !hasBreakdownActivity && (
                <StateBox>Game breakdown is not available from the API for this period.</StateBox>
              )}

              {!error && sortedGames.length > 0 && (!hasTotalActivity || hasBreakdownActivity) && (
                <BreakdownList>
                  {sortedGames.map((game, index) => {
                    const housePnl = parseAmount(game.housePnl);
                    const pnlTone = getPnlTone(game.housePnl);
                    const rowAnimation = rowAnimations[game.game];
                    const barWidth = maxHousePnl > 0 ? Math.round((Math.abs(housePnl) / maxHousePnl) * 100) : 0;
                    const gameRoute = getGameRoute(game.game);

                    return (
                      <GameRow
                        as={gameRoute ? Link : 'div'}
                        {...(gameRoute ? { to: gameRoute } : {})}
                        key={`${game.game}-${rowAnimation?.id || 'stable'}`}
                        $trend={rowAnimation?.trend}
                      >
                        <GameIdentity>
                          <GameRank>{String(index + 1).padStart(2, '0')}</GameRank>
                          <GameName>{formatGameName(game.game)}</GameName>
                        </GameIdentity>

                        <GameProfit $tone={pnlTone}>
                          <MonAmount value={game.housePnl} size="game" />
                          <BarTrack>
                            <BarFill $width={barWidth} $tone={pnlTone} />
                          </BarTrack>
                        </GameProfit>

                        <GameMetrics>
                          <RowMetric>
                            <RowMetricLabel>Games</RowMetricLabel>
                            <RowMetricValue>{formatWholeNumber(getGameCount(game))}</RowMetricValue>
                          </RowMetric>
                          <RowMetric>
                            <RowMetricLabel>Wagered</RowMetricLabel>
                            <RowMetricValue><MonAmount value={game.wagered} size="row" /></RowMetricValue>
                          </RowMetric>
                          <RowMetric>
                            <RowMetricLabel>Payout</RowMetricLabel>
                            <RowMetricValue><MonAmount value={game.payout} size="row" /></RowMetricValue>
                          </RowMetric>
                          <RowMetric>
                            <RowMetricLabel>Fee</RowMetricLabel>
                            <RowMetricValue><MonAmount value={game.fee} size="row" /></RowMetricValue>
                          </RowMetric>
                        </GameMetrics>
                      </GameRow>
                    );
                  })}
                </BreakdownList>
              )}
            </BreakdownSection>
          </AnimatedContent>
        )}
      </ContentWrapper>
    </PageContainer>
  );
};

export default ProfitsPage;
