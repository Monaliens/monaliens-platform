import React from 'react';
import {
  LoadingGrid,
  LoadingCard,
  LoadingSkeleton
} from '../styles';
import { LOADING_CONFIG } from '../data/raffleConfig';

const LoadingState = () => {
  const { skeletonCount, heights, widths } = LOADING_CONFIG;

  return (
    <LoadingGrid>
      {[...Array(skeletonCount)].map((_, index) => (
        <LoadingCard key={index}>
          <LoadingSkeleton 
            height={heights.image} 
            $marginBottom="1rem" 
          />
          <LoadingSkeleton 
            height={heights.title} 
            width={widths.title} 
            $marginBottom="0.5rem" 
          />
          <LoadingSkeleton 
            height={heights.description} 
            width={widths.description} 
            $marginBottom="1rem" 
          />
          <LoadingSkeleton 
            height={heights.info} 
            width={widths.shortInfo} 
            $marginBottom="0.5rem" 
          />
          <LoadingSkeleton 
            height={heights.info} 
            width={widths.mediumInfo} 
            $marginBottom="1rem" 
          />
          <LoadingSkeleton 
            height={heights.progress} 
            $marginBottom="0.5rem" 
          />
          <LoadingSkeleton 
            height={heights.button} 
          />
        </LoadingCard>
      ))}
    </LoadingGrid>
  );
};

export default LoadingState; 