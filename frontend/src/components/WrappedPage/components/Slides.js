import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import monadImage from '../../../assets/images/monad.png';
import {
  SlideWrapper,
  HeroText,
  SubText,
  BigNumber,
  Label,
  GradientText,
  StatsRow,
  StatItem,
  StatValue,
  StatLabel,
  CalendarContainer,
  CalendarMonth,
  CalendarMonthLabel,
  CalendarWeekRow,
  CalendarDayWrapper,
  MainnetLine,
  CalendarDayDot,
  CalendarLegend,
  LegendItem,
  LegendDot,
  PeakStatsContainer,
  PeakStatCard,
  PeakStatIcon,
  PeakStatLabel,
  PeakStatValue,
  BarChartContainer,
  BarItem,
  Bar,
  BarLabel,
  BarValue,
  GameListContainer,
  GameRow,
  GameName,
  GameMeta,
  GameProfit,
  AchievementCard,
  AchievementLabel,
  AchievementValue,
  NFTCard,
  NFTImage,
  NFTInfo,
  NFTName,
  NFTMeta,
  ShareButton,
  HighlightBox,
} from '../styles';
import {
  formatNumber,
  formatNumberWithCommas,
  formatMON,
  truncateAddress,
  formatHour,
  processCalendarByMonth,
  generateMonthGrid,
  processMonthlyData,
  processDailyData,
  getCasinoGames,
  getCasinoSummary,
  getSpinNarrative,
  getCasinoNarrative,
  getHourNarrative,
  MONTH_NAMES,
} from '../utils';

// LMON image from public folder
const lmonImage = '/images/lmonphoto.png';

// Format LMON (large numbers like 550000 -> 550K)
const formatLMON = (value) => {
  const num = parseFloat(value) || 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toFixed(0);
};

// Animated Counter Hook
const useAnimatedCounter = (targetValue, duration = 1500) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const target = parseFloat(targetValue) || 0;
    if (target === 0) {
      setValue(0);
      return;
    }

    const startTime = Date.now();
    let frame;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(target * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [targetValue, duration]);

  return value;
};

// INTRO SLIDE
export const IntroSlide = ({ data, active }) => {
  const totalTx = useAnimatedCounter(data?.overall?.totalTransactions || 0);
  const discordName = data?.overall?.discord?.globalName;
  const address = truncateAddress(data?.overall?.address);

  return (
    <SlideWrapper $active={active}>
      {discordName ? (
        <Label $delay="0s" $color="#6930c3">Welcome back, {discordName}</Label>
      ) : (
        <Label $delay="0s" $color="#6930c3">{address}</Label>
      )}
      <HeroText $size="80px" $sizeLg="64px" $sizeMd="42px" $delay="0.1s">
        <GradientText>Wrapped 2025</GradientText>
      </HeroText>
      <SubText $delay="0.3s" style={{ marginTop: 16 }}>
        Your year on Monaliens
      </SubText>

      <div style={{ marginTop: 60 }}>
        <Label $delay="0.4s">Total Transactions</Label>
        <BigNumber $delay="0.5s">
          {formatNumberWithCommas(totalTx)}
        </BigNumber>
      </div>

      <SubText $delay="0.7s" style={{ marginTop: 40 }}>
        Press arrow keys or swipe to navigate
      </SubText>
    </SlideWrapper>
  );
};

// SPIN TOTAL SLIDE
export const SpinTotalSlide = ({ data, active }) => {
  const mainnet = data?.spin?.mainnet;
  const testnet = data?.spin?.testnet;
  const totalSpins = (data?.overall?.totalSpinsMainnet || 0) + (data?.overall?.totalSpinsTestnet || 0);
  const animatedSpins = useAnimatedCounter(active ? totalSpins : 0);
  const narrative = getSpinNarrative(totalSpins);

  const mainnetSpins = data?.overall?.totalSpinsMainnet || 0;
  const testnetSpins = data?.overall?.totalSpinsTestnet || 0;

  return (
    <SlideWrapper $active={active}>
      <HeroText $size="48px" $sizeLg="40px" $sizeMd="28px" $delay="0s">
        You spun the wheel.
      </HeroText>
      <SubText $size="28px" $sizeMd="18px" $delay="0.15s">
        {narrative}
      </SubText>

      <div style={{ marginTop: 50 }}>
        <Label $delay="0.3s">Total Spins</Label>
        <BigNumber $size="120px" $sizeLg="90px" $sizeMd="60px" $delay="0.4s">
          {formatNumberWithCommas(animatedSpins)}
        </BigNumber>
      </div>

      <StatsRow $delay="0.5s" style={{ gap: '80px' }}>
        {/* Testnet Stats */}
        {testnetSpins > 0 && (
          <StatItem style={{ alignItems: 'center' }}>
            <StatLabel style={{ marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>Testnet</StatLabel>
            <StatValue $size="28px">{formatNumber(testnetSpins)} spins</StatValue>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img src={monadImage} alt="MON" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                <StatLabel>{formatMON(testnet?.totalRewardsMon)} MON</StatLabel>
              </div>
              {parseFloat(testnet?.totalRewardsLmon) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img src={lmonImage} alt="LMON" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                  <StatLabel>{formatLMON(testnet?.totalRewardsLmon)} LMON</StatLabel>
                </div>
              )}
            </div>
          </StatItem>
        )}

        {/* Mainnet Stats */}
        {mainnetSpins > 0 && (
          <StatItem style={{ alignItems: 'center' }}>
            <StatLabel style={{ marginBottom: '8px', color: '#6930c3', fontSize: '14px' }}>Mainnet</StatLabel>
            <StatValue $size="28px">{formatNumber(mainnetSpins)} spins</StatValue>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
              <img src={monadImage} alt="MON" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
              <StatLabel>{formatMON(mainnet?.totalRewardsMon)} MON</StatLabel>
            </div>
          </StatItem>
        )}
      </StatsRow>
    </SlideWrapper>
  );
};

// Merge calendar data from mainnet and testnet
const mergeCalendars = (mainnetCalendar, testnetCalendar) => {
  const merged = { ...mainnetCalendar };

  if (testnetCalendar) {
    Object.entries(testnetCalendar).forEach(([date, data]) => {
      if (merged[date]) {
        merged[date] = {
          spins: (merged[date].spins || 0) + (data.spins || 0),
          rewardsMon: (parseFloat(merged[date].rewardsMon) || 0) + (parseFloat(data.rewardsMon) || 0),
          winRate: merged[date].winRate, // Keep mainnet win rate
        };
      } else {
        merged[date] = data;
      }
    });
  }

  return merged;
};

// SPIN CALENDAR SLIDE
export const SpinCalendarSlide = ({ data, active }) => {
  const mainnetData = data?.spin?.mainnet;
  const testnetData = data?.spin?.testnet;

  // Merge calendars from both networks
  const mergedCalendar = useMemo(
    () => mergeCalendars(mainnetData?.calendar || {}, testnetData?.calendar || {}),
    [mainnetData?.calendar, testnetData?.calendar]
  );

  const { monthlyData, maxSpins } = useMemo(
    () => processCalendarByMonth(mergedCalendar),
    [mergedCalendar]
  );

  // Combined stats
  const totalActiveDays = (mainnetData?.activeDays || 0) + (testnetData?.activeDays || 0);
  const longestStreak = Math.max(mainnetData?.longestStreak || 0, testnetData?.longestStreak || 0);

  // Show ALL 12 months
  const allMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <SlideWrapper $active={active} style={{ justifyContent: 'flex-start', paddingTop: '140px', overflow: 'hidden' }}>
      <HeroText $size="48px" $sizeLg="40px" $sizeMd="28px" $delay="0s">
        You built consistency.
      </HeroText>
      <SubText $size="28px" $sizeMd="18px" $delay="0.15s">
        And had an incredible run.
      </SubText>

      <StatsRow $delay="0.3s" $marginTop="20px">
        <StatItem>
          <StatValue $size="40px">{totalActiveDays}</StatValue>
          <StatLabel>Days Used</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue $size="40px">{longestStreak}d</StatValue>
          <StatLabel>Longest Streak</StatLabel>
        </StatItem>
      </StatsRow>

      <CalendarContainer $delay="0.5s" style={{ marginTop: '30px' }}>
        {allMonths.map((month, monthIdx) => (
          <CalendarMonth key={month}>
            <CalendarMonthLabel>{MONTH_NAMES[month]}</CalendarMonthLabel>
            {generateMonthGrid(month, monthlyData[month] || {}, maxSpins).map((week, weekIdx) => (
              <CalendarWeekRow key={weekIdx}>
                {week.map((day, dayIdx) => {
                  // Mainnet launch: November 24, 2025 (month 10, day 24)
                  const isMainnetLaunch = month === 10 && day?.day === 24;
                  // Staggered animation: base delay + month offset + day offset
                  const baseDelay = 0.6;
                  const dayDelay = baseDelay + (monthIdx * 0.08) + (weekIdx * 0.02) + (dayIdx * 0.01);

                  // Empty day - render invisible placeholder for alignment
                  if (!day) {
                    return <CalendarDayWrapper key={dayIdx} style={{ visibility: 'hidden' }}>
                      <CalendarDayDot $intensity={0} $hasData={false} $active={false} />
                    </CalendarDayWrapper>;
                  }

                  return (
                    <CalendarDayWrapper key={dayIdx}>
                      {isMainnetLaunch && <MainnetLine $active={active} />}
                      <CalendarDayDot
                        key={active ? 'active' : 'inactive'}
                        $intensity={day?.intensity || 0}
                        $hasData={day?.spins > 0}
                        $active={active}
                        $animDelay={`${dayDelay}s`}
                        title={day?.spins ? `${day.spins} spins` : isMainnetLaunch ? 'Mainnet Launch!' : ''}
                      />
                    </CalendarDayWrapper>
                  );
                })}
              </CalendarWeekRow>
            ))}
          </CalendarMonth>
        ))}
      </CalendarContainer>

      <CalendarLegend>
        <LegendItem>
          <LegendDot $color="rgba(105, 48, 195, 0.1)" />
          <span>No activity</span>
        </LegendItem>
        <LegendItem>
          <LegendDot $color="rgba(105, 48, 195, 0.4)" />
          <span>Low</span>
        </LegendItem>
        <LegendItem>
          <LegendDot $color="#6930c3" />
          <span>Medium</span>
        </LegendItem>
        <LegendItem>
          <LegendDot $color="#ea580c" />
          <span>High</span>
        </LegendItem>
        <LegendItem>
          <LegendDot $color="#8b5cf6" style={{ width: '4px', borderRadius: '2px' }} />
          <span>Mainnet Launch</span>
        </LegendItem>
      </CalendarLegend>
    </SlideWrapper>
  );
};

// SPIN WHEN SLIDE
export const SpinWhenSlide = ({ data, active }) => {
  const mainnetData = data?.spin?.mainnet;
  const testnetData = data?.spin?.testnet;

  // Merge calendars from both networks for monthly data
  const mergedCalendar = useMemo(
    () => mergeCalendars(mainnetData?.calendar || {}, testnetData?.calendar || {}),
    [mainnetData?.calendar, testnetData?.calendar]
  );

  const monthlyData = useMemo(
    () => processMonthlyData(mergedCalendar),
    [mergedCalendar]
  );

  // Merge daily distributions
  const mergedDailyDistribution = useMemo(() => {
    const mainnetDaily = mainnetData?.dailyDistribution || {};
    const testnetDaily = testnetData?.dailyDistribution || {};
    const merged = { ...mainnetDaily };
    Object.entries(testnetDaily).forEach(([day, count]) => {
      merged[day] = (merged[day] || 0) + count;
    });
    return merged;
  }, [mainnetData?.dailyDistribution, testnetData?.dailyDistribution]);

  const dailyData = useMemo(
    () => processDailyData(mergedDailyDistribution),
    [mergedDailyDistribution]
  );

  const peakMonth = monthlyData.reduce((max, m) => m.count > max.count ? m : max, { count: 0 });
  const peakDay = dailyData.reduce((max, d) => d.count > max.count ? d : max, { count: 0 });

  // Get peak hour from both networks (use the one with more data)
  const mainnetPeakHour = mainnetData?.peakHour;
  const testnetPeakHour = testnetData?.peakHour;
  const peakHour = (mainnetPeakHour?.count || 0) >= (testnetPeakHour?.count || 0)
    ? mainnetPeakHour?.hour
    : testnetPeakHour?.hour;

  // Icons for each stat
  const CalendarIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  const DayIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );

  const ClockIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );

  return (
    <SlideWrapper $active={active}>
      <HeroText $size="42px" $sizeLg="36px" $sizeMd="26px" $delay="0s">
        Your Peak Playing Times
      </HeroText>
      <SubText $size="20px" $sizeMd="14px" $delay="0.1s">
        Here's when you showed up most
      </SubText>

      <PeakStatsContainer $delay="0.2s">
        <PeakStatCard $animDelay="0.3s" key={active ? 'month-active' : 'month'}>
          <PeakStatIcon><CalendarIcon /></PeakStatIcon>
          <PeakStatLabel>Month</PeakStatLabel>
          <PeakStatValue>{peakMonth.name || '—'}</PeakStatValue>
        </PeakStatCard>
        <PeakStatCard $animDelay="0.45s" key={active ? 'day-active' : 'day'}>
          <PeakStatIcon><DayIcon /></PeakStatIcon>
          <PeakStatLabel>Day</PeakStatLabel>
          <PeakStatValue>{peakDay.day?.slice(0, 3) || '—'}</PeakStatValue>
        </PeakStatCard>
        <PeakStatCard $animDelay="0.6s" key={active ? 'hour-active' : 'hour'}>
          <PeakStatIcon><ClockIcon /></PeakStatIcon>
          <PeakStatLabel>Hour</PeakStatLabel>
          <PeakStatValue>{peakHour !== undefined ? formatHour(peakHour) : '—'}</PeakStatValue>
        </PeakStatCard>
      </PeakStatsContainer>

      <BarChartContainer $delay="0.5s" $height="160px">
        {monthlyData.map((m, i) => {
          const isHighlight = m.count === peakMonth.count && m.count > 0;
          const barDelay = 0.8 + (i * 0.05);
          const valueDelay = barDelay + 0.6; // Show value after bar animation completes
          return (
            <BarItem key={i}>
              <BarValue
                $highlight={isHighlight}
                $visible={m.count > 0}
                $animate={active}
                $animDelay={`${valueDelay}s`}
                key={active ? `value-${i}-active` : `value-${i}`}
              >
                {m.count > 0 ? formatNumber(m.count) : ''}
              </BarValue>
              <Bar
                $height={`${m.percentage}%`}
                $highlight={isHighlight}
                $animate={active}
                $animDelay={`${barDelay}s`}
                key={active ? `bar-${i}-active` : `bar-${i}`}
              />
              <BarLabel $highlight={isHighlight}>{m.name}</BarLabel>
            </BarItem>
          );
        })}
      </BarChartContainer>

      {peakHour !== undefined && (
        <HighlightBox>
          {getHourNarrative(peakHour)}
        </HighlightBox>
      )}
    </SlideWrapper>
  );
};

// SPIN BIGGEST WIN SLIDE
export const SpinBiggestSlide = ({ data, active }) => {
  const mainnetData = data?.spin?.mainnet;
  const testnetData = data?.spin?.testnet;

  // Compare biggest wins from both networks
  const mainnetBiggest = parseFloat(mainnetData?.biggestWin?.amountMon || 0);
  const testnetBiggest = parseFloat(testnetData?.biggestWin?.amountMon || 0);

  const spinData = mainnetBiggest >= testnetBiggest ? mainnetData : testnetData;
  const biggestWin = spinData?.biggestWin;
  const animatedAmount = useAnimatedCounter(active ? parseFloat(biggestWin?.amountMon || 0) : 0);

  // Use favorite NFT from either network (prefer the one with more spins)
  const mainnetFavorite = mainnetData?.favoriteNft;
  const testnetFavorite = testnetData?.favoriteNft;
  const favoriteNft = (mainnetFavorite?.spins || 0) >= (testnetFavorite?.spins || 0)
    ? mainnetFavorite
    : testnetFavorite;

  // NFT image URL
  const nftImageUrl = favoriteNft?.nftId
    ? `${process.env.API_URL || "https://your-api-url"}/api/image/monaliens/${favoriteNft.nftId}`
    : null;

  return (
    <SlideWrapper $active={active}>
      <HeroText $size="48px" $sizeLg="40px" $sizeMd="28px" $delay="0s">
        Your biggest win.
      </HeroText>
      <SubText $size="28px" $sizeMd="18px" $delay="0.15s">
        A moment to remember.
      </SubText>

      <AchievementCard $delay="0.3s">
        <AchievementLabel>Jackpot</AchievementLabel>
        <AchievementValue style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {formatNumberWithCommas(animatedAmount)} MON
          <img
            src={monadImage}
            alt="MON"
            style={{ width: '56px', height: '56px', borderRadius: '50%' }}
          />
        </AchievementValue>
      </AchievementCard>

      {favoriteNft && nftImageUrl && (
        <NFTCard $delay="0.5s">
          <NFTImage src={nftImageUrl} alt={`Monalien #${favoriteNft.nftId}`} />
          <NFTInfo>
            <NFTName>Monalien #{favoriteNft.nftId}</NFTName>
            <NFTMeta>{favoriteNft.spins} spins with this NFT</NFTMeta>
          </NFTInfo>
        </NFTCard>
      )}
    </SlideWrapper>
  );
};

// CASINO TOTAL SLIDE
export const CasinoTotalSlide = ({ data, active }) => {
  const casinoSummary = useMemo(() => getCasinoSummary(data?.casino), [data?.casino]);
  const animatedGames = useAnimatedCounter(active ? casinoSummary?.totalGames || 0 : 0);
  const narrative = getCasinoNarrative(casinoSummary);

  if (!casinoSummary) return null;

  // Icons
  const TrophyIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );

  const ChartIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );

  const TargetIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );

  return (
    <SlideWrapper $active={active}>
      <HeroText $size="48px" $sizeLg="40px" $sizeMd="28px" $delay="0s">
        You played the mini games.
      </HeroText>
      <SubText $size="28px" $sizeMd="18px" $delay="0.15s">
        {narrative}
      </SubText>

      <div style={{ marginTop: 30 }}>
        <Label $delay="0.3s">Games Played</Label>
        <BigNumber $size="120px" $sizeLg="90px" $sizeMd="64px" $delay="0.4s">
          {formatNumberWithCommas(animatedGames)}
        </BigNumber>
      </div>

      <PeakStatsContainer $delay="0.5s" style={{ marginTop: 20 }}>
        <PeakStatCard $animDelay="0.7s" key={active ? 'profit-active' : 'profit'}>
          <PeakStatIcon style={{
            background: casinoSummary.isProfit
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.25) 100%)'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.25) 100%)',
            color: casinoSummary.isProfit ? '#16a34a' : '#dc2626'
          }}>
            <ChartIcon />
          </PeakStatIcon>
          <PeakStatLabel>Profit/Loss</PeakStatLabel>
          <PeakStatValue style={{
            color: casinoSummary.isProfit ? '#22c55e' : '#ef4444',
            fontSize: '24px'
          }}>
            {casinoSummary.isProfit ? '+' : ''}{formatMON(casinoSummary.totalProfit)}
          </PeakStatValue>
        </PeakStatCard>

        <PeakStatCard $animDelay="0.85s" key={active ? 'wins-active' : 'wins'}>
          <PeakStatIcon style={{
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(202, 138, 4, 0.25) 100%)',
            color: '#ca8a04'
          }}>
            <TrophyIcon />
          </PeakStatIcon>
          <PeakStatLabel>Total Wins</PeakStatLabel>
          <PeakStatValue style={{ fontSize: '28px' }}>
            {formatNumberWithCommas(casinoSummary.totalWins)}
          </PeakStatValue>
        </PeakStatCard>

        <PeakStatCard $animDelay="1s" key={active ? 'wagered-active' : 'wagered'}>
          <PeakStatIcon style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(29, 78, 216, 0.25) 100%)',
            color: '#2563eb'
          }}>
            <TargetIcon />
          </PeakStatIcon>
          <PeakStatLabel>Total Wagered</PeakStatLabel>
          <PeakStatValue style={{ fontSize: '24px', color: '#2563eb' }}>
            {formatNumberWithCommas(Math.floor(casinoSummary.totalWagered))}
          </PeakStatValue>
        </PeakStatCard>
      </PeakStatsContainer>
    </SlideWrapper>
  );
};

// CASINO GAMES SLIDE
export const CasinoGamesSlide = ({ data, active }) => {
  const games = useMemo(() => getCasinoGames(data?.casino), [data?.casino]);
  const casinoSummary = useMemo(() => getCasinoSummary(data?.casino), [data?.casino]);

  if (!games.length) return null;

  // Format profit with sign and rounded
  const formatProfit = (value) => {
    const num = parseFloat(value) || 0;
    const rounded = Math.round(num);
    if (rounded >= 0) return `+${formatNumberWithCommas(rounded)}`;
    return formatNumberWithCommas(rounded);
  };

  return (
    <SlideWrapper $active={active} style={{ justifyContent: 'flex-start', paddingTop: '140px', overflow: 'hidden' }}>
      <HeroText $size="48px" $sizeLg="40px" $sizeMd="24px" $delay="0s">
        Your game breakdown.
      </HeroText>
      {casinoSummary?.favoriteGame && (
        <SubText $delay="0.15s" $sizeMd="14px">
          {casinoSummary.favoriteGame.displayName} was your favorite.
        </SubText>
      )}

      <GameListContainer $delay="0.3s">
        {games.slice(0, 6).map((game, i) => {
          const isFavorite = casinoSummary?.favoriteGame?.name === game.name;
          const winRate = game.totalGames > 0 ? (game.wins / game.totalGames) * 100 : 0;

          return (
            <GameRow
              key={game.name}
              $animDelay={`${0.4 + i * 0.1}s`}
              style={{
                background: isFavorite ? 'rgba(105, 48, 195, 0.08)' : 'var(--bg-card)',
                border: isFavorite ? '2px solid rgba(105, 48, 195, 0.3)' : 'none',
              }}
            >
              {/* Game Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <GameName style={{ color: isFavorite ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    {game.displayName}
                  </GameName>
                  {isFavorite && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      color: '#6930c3',
                      background: 'rgba(105, 48, 195, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Favorite
                    </span>
                  )}
                </div>

                {/* Win Rate Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '6px',
                }}>
                  <div style={{
                    flex: 1,
                    height: '6px',
                    background: 'rgba(0, 0, 0, 0.08)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${winRate}%`,
                      height: '100%',
                      background: winRate >= 50
                        ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
                        : 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
                      borderRadius: '3px',
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: winRate >= 50 ? '#16a34a' : '#ea580c',
                    minWidth: '42px',
                  }}>
                    {winRate.toFixed(0)}%
                  </span>
                </div>

                <GameMeta style={{ marginTop: '4px' }}>
                  {formatNumberWithCommas(game.totalGames)} games · {game.wins}W / {game.losses}L
                </GameMeta>
              </div>

              {/* Profit/Loss */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <GameProfit $positive={game.profitLoss >= 0} style={{ fontSize: '18px' }}>
                  {formatProfit(game.profitLoss)}
                </GameProfit>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  MON
                </div>
              </div>
            </GameRow>
          );
        })}
      </GameListContainer>
    </SlideWrapper>
  );
};

// RAFFLE SLIDE
export const RaffleSlide = ({ data, active }) => {
  const mainnet = data?.raffle?.mainnet;
  const testnet = data?.raffle?.testnet;
  const totalTickets = (mainnet?.totalTickets || 0) + (testnet?.totalTickets || 0);
  const totalParticipated = (mainnet?.rafflesParticipated || 0) + (testnet?.rafflesParticipated || 0);
  const totalWon = (mainnet?.rafflesWon || 0) + (testnet?.rafflesWon || 0);
  const animatedTickets = useAnimatedCounter(active ? totalTickets : 0);

  return (
    <SlideWrapper $active={active}>
      <HeroText $size="48px" $sizeLg="40px" $sizeMd="28px" $delay="0s">
        You tried your luck.
      </HeroText>
      <SubText $size="28px" $sizeMd="18px" $delay="0.15s">
        {totalWon > 0 ? "And won!" : "Every ticket counts."}
      </SubText>

      <div style={{ marginTop: 60 }}>
        <Label $delay="0.3s">Tickets Used</Label>
        <BigNumber $size="140px" $sizeLg="100px" $sizeMd="72px" $delay="0.4s" $color="#f97316">
          {formatNumberWithCommas(animatedTickets)}
        </BigNumber>
      </div>

      <StatsRow $delay="0.6s">
        <StatItem>
          <StatValue>{totalParticipated}</StatValue>
          <StatLabel>Raffles Joined</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue $color={totalWon > 0 ? '#22c55e' : undefined}>{totalWon}</StatValue>
          <StatLabel>Raffles Won</StatLabel>
        </StatItem>
      </StatsRow>

      {totalWon > 0 && (
        <HighlightBox>
          Raffle Winner!
        </HighlightBox>
      )}
    </SlideWrapper>
  );
};

// Convert image URL to base64 for SVG embedding
const useImageBase64 = (url) => {
  const [base64, setBase64] = useState(null);

  useEffect(() => {
    if (!url) return;

    setBase64(null); // Reset when URL changes

    const tryLoadImage = (imageUrl, isFallback = false) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 200;
        canvas.height = img.height || 200;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try {
          setBase64(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error('Canvas toDataURL failed:', e);
          if (!isFallback) {
            // Try fallback image
            tryLoadImage(process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/image/monaliens/1` : 'https://your-api-url/api/image/monaliens/1', true);
          }
        }
      };
      img.onerror = () => {
        console.error('Image load failed:', imageUrl);
        if (!isFallback) {
          // Try fallback image (ID 1 always exists)
          tryLoadImage(process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/image/monaliens/1` : 'https://your-api-url/api/image/monaliens/1', true);
        }
      };
      img.src = imageUrl;
    };

    tryLoadImage(url);
  }, [url]);

  return base64;
};

// SHARE CARD COMPONENT
const ShareCard = ({ data }) => {
  const cardRef = useRef(null);
  const discord = data?.overall?.discord;
  const totalTx = data?.overall?.totalTransactions || 0;
  const totalNFTs = data?.overall?.totalNFTs || 0;
  const nftIds = data?.overall?.nftIds || [];
  const testnetSpins = data?.overall?.totalSpinsTestnet || 0;
  const mainnetSpins = data?.overall?.totalSpinsMainnet || 0;
  const testnetMon = parseFloat(data?.spin?.testnet?.totalRewardsMon) || 0;
  const mainnetMon = parseFloat(data?.spin?.mainnet?.totalRewardsMon) || 0;

  // Use getCasinoSummary like other slides
  const casinoSummary = useMemo(() => getCasinoSummary(data?.casino), [data?.casino]);
  const casinoGames = casinoSummary?.totalGames || 0;
  const casinoProfit = casinoSummary?.totalProfit || 0;
  const casinoWinRate = casinoSummary?.winRate || 0;
  const favoriteGame = casinoSummary?.favoriteGame?.displayName || null;
  const favoriteGameCount = casinoSummary?.favoriteGame?.totalGames || 0;

  // Get avatar URL: Discord > User's NFT > Random Monaliens (1-1666)
  const [randomNftId] = useState(() => Math.floor(Math.random() * 1666) + 1);
  const avatarUrl = useMemo(() => {
    if (discord?.avatarUrl) return discord.avatarUrl;
    if (nftIds.length > 0) {
      return `${process.env.API_URL || "https://your-api-url"}/api/image/monaliens/${nftIds[0]}`;
    }
    return `${process.env.API_URL || "https://your-api-url"}/api/image/monaliens/${randomNftId}`;
  }, [discord?.avatarUrl, nftIds, randomNftId]);

  const avatarBase64 = useImageBase64(avatarUrl);

  const cardWidth = 759;
  const cardHeight = 1350;

  return (
    <div ref={cardRef} style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }}>
      <svg
        id="share-card-svg"
        viewBox={`0 0 ${cardWidth} ${cardHeight}`}
        style={{ width: '100%', height: 'auto', borderRadius: '20px', boxShadow: '0 20px 60px rgba(75, 45, 143, 0.4)' }}
      >
        <defs>
          {/* Purple gradient background */}
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4B2D8F" />
            <stop offset="50%" stopColor="#2D1B69" />
            <stop offset="100%" stopColor="#1a1033" />
          </linearGradient>

          {/* Diagonal stripe pattern */}
          <pattern id="stripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
          </pattern>

          {/* Card glow gradient - blue */}
          <linearGradient id="cardGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(60, 140, 255, 0.2)" />
            <stop offset="100%" stopColor="rgba(40, 100, 200, 0.1)" />
          </linearGradient>

          {/* Pink card gradient for mini games */}
          <linearGradient id="pinkCardGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(200, 50, 150, 0.25)" />
            <stop offset="100%" stopColor="rgba(150, 30, 100, 0.15)" />
          </linearGradient>

          {/* Avatar glow */}
          <radialGradient id="avatarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(150, 100, 255, 0.5)" />
          </radialGradient>

          {/* Name underline gradient */}
          <linearGradient id="underlineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(100, 150, 255, 0.8)" />
            <stop offset="100%" stopColor="rgba(100, 150, 255, 0.2)" />
          </linearGradient>

          {/* Blue glow filter for Transactions/NFTs */}
          <filter id="blueGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
            <feFlood floodColor="#4488ff" floodOpacity="1" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Green glow filter for Spin Wheel */}
          <filter id="greenGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
            <feFlood floodColor="#33FFB0" floodOpacity="1" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Pink/Red glow filter for Mini Games */}
          <filter id="pinkGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
            <feFlood floodColor="#ff3399" floodOpacity="1" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <clipPath id="avatarClip">
            <circle cx="68" cy="68" r="68" />
          </clipPath>
        </defs>

        {/* Background */}
        <rect width={cardWidth} height={cardHeight} fill="url(#bgGradient)" />
        <rect width={cardWidth} height={cardHeight} fill="url(#stripes)" />

        {/* Header: MONALIENS */}
        <text x="61" y="100" fill="#A192BD" fontSize="22" fontWeight="500" fontFamily="Vilane, sans-serif" letterSpacing="4">
          MONALIENS
        </text>

        {/* WRAPPED 2025 */}
        <text x="61" y="165" fill="white" fontSize="57" fontWeight="500" fontFamily="Vilane, sans-serif">
          WRAPPED 2025
        </text>

        {/* Avatar Section */}
        <g transform="translate(59, 198)">
          {/* Outer glow rings */}
          <circle cx="87" cy="87" r="87" fill="url(#avatarGlow)" />
          <circle cx="87" cy="87" r="78" fill="none" stroke="rgba(150, 100, 255, 0.3)" strokeWidth="2" />
          <circle cx="87" cy="87" r="68" fill="none" stroke="rgba(150, 100, 255, 0.5)" strokeWidth="2" />

          {/* Avatar image */}
          <g transform="translate(19, 19)">
            {avatarBase64 && avatarBase64.startsWith('data:') ? (
              <image href={avatarBase64} x="0" y="0" width="136" height="136" clipPath="url(#avatarClip)" preserveAspectRatio="xMidYMid slice" />
            ) : (
              <>
                <circle cx="68" cy="68" r="68" fill="rgba(150, 100, 255, 0.2)" />
                <text x="68" y="75" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="14" fontFamily="Vilane, sans-serif">
                  Loading...
                </text>
              </>
            )}
          </g>
        </g>

        {/* Name & Address */}
        <text x="277" y="280" fill="white" fontSize="50" fontWeight="400" fontFamily="Vilane, sans-serif">
          {(() => {
            const name = discord?.globalName || discord?.username || truncateAddress(data?.overall?.address);
            return name && name.length > 16 ? name.slice(0, 14) + '...' : name;
          })()}
        </text>
        <rect x="274" y="287" width="425" height="5" rx="2.5" fill="url(#underlineGradient)" />
        {discord && (
          <text x="277" y="323" fill="#A192BD" fontSize="20" fontFamily="Vilane, sans-serif">
            {truncateAddress(data?.overall?.address)}
          </text>
        )}

        {/* Transaction Card - BLUE glow */}
        <g transform="translate(59, 460)">
          <rect x="0" y="0" width="292" height="165" rx="16" fill="none" stroke="rgba(68, 136, 255, 0.9)" strokeWidth="3" filter="url(#blueGlow)" />
          <rect x="0" y="0" width="292" height="165" rx="16" fill="url(#cardGlow)" />
          <rect x="0" y="0" width="292" height="165" rx="16" fill="none" stroke="rgba(68, 136, 255, 0.6)" strokeWidth="2" />
          <text x="20" y="43" fill="#A192BD" fontSize="17" fontFamily="Vilane, sans-serif" letterSpacing="2">
            TRANSACTIONS
          </text>
          <text x="20" y="112" fill="white" fontSize="57" fontWeight="400" fontFamily="Vilane, sans-serif">
            {formatNumberWithCommas(totalTx)}
          </text>
          <text x="20" y="142" fill="#A192BD" fontSize="13" fontFamily="Vilane, sans-serif">
            on Monaliens
          </text>
        </g>

        {/* NFTs Card - BLUE glow */}
        <g transform="translate(407, 460)">
          <rect x="0" y="0" width="292" height="165" rx="16" fill="none" stroke="rgba(68, 136, 255, 0.9)" strokeWidth="3" filter="url(#blueGlow)" />
          <rect x="0" y="0" width="292" height="165" rx="16" fill="url(#cardGlow)" />
          <rect x="0" y="0" width="292" height="165" rx="16" fill="none" stroke="rgba(68, 136, 255, 0.6)" strokeWidth="2" />
          <text x="24" y="43" fill="#A192BD" fontSize="17" fontFamily="Vilane, sans-serif" letterSpacing="2">
            NFTS HELD
          </text>
          <text x="24" y="112" fill="white" fontSize="57" fontWeight="400" fontFamily="Vilane, sans-serif">
            {totalNFTs}
          </text>
          <text x="24" y="142" fill="#A192BD" fontSize="13" fontFamily="Vilane, sans-serif">
            Monaliens collection
          </text>
        </g>

        {/* Spin Wheel Card - GREEN glow */}
        <g transform="translate(60, 678)">
          <rect x="0" y="0" width="639" height="180" rx="16" fill="none" stroke="rgba(51, 255, 176, 0.9)" strokeWidth="3" filter="url(#greenGlow)" />
          <rect x="0" y="0" width="639" height="180" rx="16" fill="url(#cardGlow)" />
          <rect x="0" y="0" width="639" height="180" rx="16" fill="none" stroke="rgba(51, 255, 176, 0.6)" strokeWidth="2" />

          <text x="91" y="40" fill="#A192BD" fontSize="17" fontFamily="Vilane, sans-serif" letterSpacing="2">
            SPIN WHEEL
          </text>

          {/* Testnet Row */}
          <g transform="translate(19, 63)">
            <rect x="0" y="0" width="95" height="28" rx="14" fill="rgba(255, 80, 180, 0.85)" />
            <text x="47" y="19" textAnchor="middle" fill="white" fontSize="16" fontWeight="500" fontFamily="Vilane, sans-serif">
              TESTNET
            </text>
            <text x="118" y="21" fill="white" fontSize="40" fontWeight="400" fontFamily="Vilane, sans-serif">
              {formatNumberWithCommas(testnetSpins)}
            </text>
            <text x={138 + (formatNumberWithCommas(testnetSpins).toString().length * 20)} y="21" fill="#A192BD" fontSize="16" fontFamily="Vilane, sans-serif">
              spins
            </text>
            <text x="370" y="21" fill="#33FFB0" fontSize="40" fontWeight="400" fontFamily="Vilane, sans-serif">
              +{formatNumberWithCommas(Math.round(testnetMon))} MON
            </text>
          </g>

          {/* Mainnet Row */}
          <g transform="translate(19, 121)">
            <rect x="0" y="0" width="95" height="29" rx="14" fill="rgba(50, 200, 120, 0.85)" />
            <text x="47" y="20" textAnchor="middle" fill="white" fontSize="16" fontWeight="500" fontFamily="Vilane, sans-serif">
              MAINNET
            </text>
            <text x="118" y="21" fill="white" fontSize="40" fontWeight="400" fontFamily="Vilane, sans-serif">
              {formatNumberWithCommas(mainnetSpins)}
            </text>
            <text x={138 + (formatNumberWithCommas(mainnetSpins).toString().length * 20)} y="21" fill="#A192BD" fontSize="16" fontFamily="Vilane, sans-serif">
              spins
            </text>
            <text x="370" y="21" fill="#33FFB0" fontSize="40" fontWeight="400" fontFamily="Vilane, sans-serif">
              +{formatNumberWithCommas(Math.round(mainnetMon))} MON
            </text>
          </g>
        </g>

        {/* Mini Games Card - PINK/RED glow */}
        <g transform="translate(60, 914)">
          <rect x="0" y="0" width="639" height="217" rx="16" fill="none" stroke="rgba(255, 51, 153, 0.9)" strokeWidth="3" filter="url(#pinkGlow)" />
          <rect x="0" y="0" width="639" height="217" rx="16" fill="url(#pinkCardGlow)" />
          <rect x="0" y="0" width="639" height="217" rx="16" fill="none" stroke="rgba(255, 51, 153, 0.6)" strokeWidth="2" />

          <text x="90" y="44" fill="#A192BD" fontSize="17" fontFamily="Vilane, sans-serif" letterSpacing="2">
            MINI GAMES
          </text>

          {/* Stats Row */}
          <g transform="translate(22, 48)">
            {/* Games Played */}
            <text x="0" y="52" fill="white" fontSize="40" fontWeight="400" fontFamily="Vilane, sans-serif">
              {formatNumberWithCommas(casinoGames)}
            </text>
            <text x="0" y="78" fill="#A192BD" fontSize="16" fontFamily="Vilane, sans-serif">
              games played
            </text>

            {/* Win Rate */}
            <text x="173" y="52" fill="#33FFB0" fontSize="40" fontWeight="400" fontFamily="Vilane, sans-serif">
              {typeof casinoWinRate === 'number' ? casinoWinRate.toFixed(1) : casinoWinRate}%
            </text>
            <text x="173" y="78" fill="#A192BD" fontSize="16" fontFamily="Vilane, sans-serif">
              win rate
            </text>

            {/* Profit/Loss */}
            <text x="346" y="52" fill={casinoProfit >= 0 ? "#33FFB0" : "#FF3398"} fontSize="40" fontWeight="400" fontFamily="Vilane, sans-serif">
              {casinoProfit >= 0 ? '+' : ''}{formatNumberWithCommas(Math.round(casinoProfit))} MON
            </text>
            <text x="346" y="78" fill="#A192BD" fontSize="16" fontFamily="Vilane, sans-serif">
              {casinoProfit >= 0 ? 'earned' : 'lost'}
            </text>
          </g>

          {/* Favorite Game Bar */}
          <g transform="translate(21, 138)">
            <rect x="0" y="0" width="599" height="46" rx="12" fill="rgba(255, 100, 180, 0.7)" />
            <text x="16" y="30" fill="#860D49" fontSize="16" fontFamily="Vilane, sans-serif">
              Your Favorite Game
            </text>
            <text x="255" y="32" fill="white" fontSize="29" fontWeight="500" fontFamily="Vilane, sans-serif">
              {favoriteGame?.toUpperCase() || 'N/A'}
            </text>
            {favoriteGameCount > 0 && (
              <text x="583" y="30" textAnchor="end" fill="#860D49" fontSize="16" fontFamily="Vilane, sans-serif">
                {formatNumberWithCommas(favoriteGameCount)} played
              </text>
            )}
          </g>
        </g>

        {/* Footer */}
        <text x={cardWidth / 2} y="1265" textAnchor="middle" fill="#A192BD" fontSize="16" fontFamily="Vilane, sans-serif">
          Get yours at
        </text>
        <text x={cardWidth / 2} y="1308" textAnchor="middle" fill="white" fontSize="28" fontWeight="400" fontFamily="Vilane, sans-serif">
          monaliens.xyz/wrapped
        </text>
      </svg>
    </div>
  );
};

// SUMMARY SLIDE
export const SummarySlide = ({ data, active }) => {
  const handleDownloadCard = useCallback(async () => {
    const svgElement = document.querySelector('#share-card-svg');
    if (!svgElement) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 759;
      canvas.height = 1350;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          const link = document.createElement('a');
          link.download = 'monaliens-wrapped-2025.png';
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }, 'image/png');
      };
      img.src = url;
    } catch (err) {
      console.error('Failed to download card:', err);
    }
  }, []);

  const [isSharing, setIsSharing] = useState(false);

  const handleShareTwitter = useCallback(async () => {
    const svgElement = document.querySelector('#share-card-svg');
    if (!svgElement || isSharing) return;

    setIsSharing(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 759;
      canvas.height = 1350;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();

      img.onload = async () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const base64 = canvas.toDataURL('image/png');

        try {
          const res = await fetch(process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/wrapped/share` : 'https://your-api-url/api/wrapped/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64,
              address: data?.overall?.address
            })
          });

          const result = await res.json();

          if (result.shareUrl) {
            const text = `My @monaliens Wrapped 2025`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(result.shareUrl)}`, '_blank');
          } else {
            // Fallback if upload fails
            const text = `My @monaliens Wrapped 2025\n\nGet yours at monaliens.xyz/wrapped`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
          }
        } catch (err) {
          console.error('Failed to upload card:', err);
          const text = `My @monaliens Wrapped 2025\n\nGet yours at monaliens.xyz/wrapped`;
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
        }

        setIsSharing(false);
      };

      img.onerror = () => {
        setIsSharing(false);
        const text = `My @monaliens Wrapped 2025\n\nGet yours at monaliens.xyz/wrapped`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
      };

      img.src = url;
    } catch (err) {
      console.error('Failed to share:', err);
      setIsSharing(false);
    }
  }, [data?.overall?.address, isSharing]);

  return (
    <SlideWrapper $active={active} style={{ justifyContent: 'flex-start', paddingTop: window.innerWidth <= 768 ? '85px' : '130px', gap: '4px', overflow: 'hidden' }}>
      <HeroText $size="36px" $sizeLg="32px" $sizeMd="22px" $delay="0s">
        Your 2025 Wrapped
      </HeroText>

      {/* Share Card Preview */}
      <div style={{ marginTop: window.innerWidth <= 768 ? '12px' : '24px', width: '100%', maxWidth: '420px' }}>
        <ShareCard data={data} />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <ShareButton onClick={handleDownloadCard} style={{ background: '#6930c3' }}>
          Download Card
        </ShareButton>
        <ShareButton
          onClick={handleShareTwitter}
          disabled={isSharing}
          style={{
            background: 'transparent',
            border: '2px solid #6930c3',
            color: '#6930c3',
            opacity: isSharing ? 0.6 : 1,
            cursor: isSharing ? 'wait' : 'pointer'
          }}
        >
          {isSharing ? 'Uploading...' : 'Share on X'}
        </ShareButton>
      </div>
    </SlideWrapper>
  );
};

// Export all slides with their keys
export const slideComponents = {
  'intro': IntroSlide,
  'spin-total': SpinTotalSlide,
  'spin-calendar': SpinCalendarSlide,
  'spin-when': SpinWhenSlide,
  'spin-biggest': SpinBiggestSlide,
  'casino-total': CasinoTotalSlide,
  'casino-games': CasinoGamesSlide,
  'raffle': RaffleSlide,
  'summary': SummarySlide,
};
