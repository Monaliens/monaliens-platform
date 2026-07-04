import React from 'react';
import {
  LargeOfferCard,
  MainVisualArea,
  CardContent,
  TimerSection,
  AssetSection,
  SectionTitle,
  AssetList,
  CardFooter,
  LoadingSkeleton
} from '../styles';

const OfferCardSkeleton = ({ index = 0 }) => {
  return (
    <LargeOfferCard $index={index} style={{ cursor: 'default', pointerEvents: 'none' }}>
      {/* Main Visual Skeleton */}
      <MainVisualArea style={{ background: '#f0f0f0' }}>
        <LoadingSkeleton $height="100%" style={{ margin: 0, borderRadius: '12px 12px 0 0' }} />
      </MainVisualArea>

      {/* Content Skeleton */}
      <CardContent>
        {/* Timer Skeleton */}
        <TimerSection>
          <LoadingSkeleton $height="14px" style={{ width: '80px' }} />
          <LoadingSkeleton $height="20px" style={{ width: '100px' }} />
        </TimerSection>

        {/* Offering Section Skeleton */}
        <AssetSection>
          <SectionTitle>
            <LoadingSkeleton $height="14px" style={{ width: '70px' }} />
          </SectionTitle>
          <AssetList>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
              <LoadingSkeleton $height="40px" style={{ width: '40px', borderRadius: '6px' }} />
              <div style={{ flex: 1 }}>
                <LoadingSkeleton $height="14px" style={{ width: '120px', marginBottom: '6px' }} />
                <LoadingSkeleton $height="12px" style={{ width: '90px' }} />
              </div>
            </div>
          </AssetList>
        </AssetSection>

        {/* Requesting Section Skeleton */}
        <AssetSection>
          <SectionTitle>
            <LoadingSkeleton $height="14px" style={{ width: '80px' }} />
          </SectionTitle>
          <AssetList>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
              <LoadingSkeleton $height="40px" style={{ width: '40px', borderRadius: '6px' }} />
              <div style={{ flex: 1 }}>
                <LoadingSkeleton $height="14px" style={{ width: '130px', marginBottom: '6px' }} />
                <LoadingSkeleton $height="12px" style={{ width: '100px' }} />
              </div>
            </div>
          </AssetList>
        </AssetSection>

        {/* Footer Skeleton */}
        <CardFooter>
          <LoadingSkeleton $height="12px" style={{ width: '140px' }} />
        </CardFooter>
      </CardContent>
    </LargeOfferCard>
  );
};

export default OfferCardSkeleton;
