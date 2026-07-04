import React from 'react';
import { FeaturesGrid as StyledFeaturesGrid } from '../styles';
import { FeatureItem } from './FeatureItem';
import { useElementOnScreen } from '../hooks/useElementOnScreen';

// Features grid component
export const FeaturesGrid = ({ features, animationDelays }) => {
  // Track visibility for each feature
  const [feature1Ref, isFeature1Visible] = useElementOnScreen({ threshold: 0.1 });
  const [feature2Ref, isFeature2Visible] = useElementOnScreen({ threshold: 0.1 });
  const [feature3Ref, isFeature3Visible] = useElementOnScreen({ threshold: 0.1 });
  const [feature4Ref, isFeature4Visible] = useElementOnScreen({ threshold: 0.1 });

  const refs = [feature1Ref, feature2Ref, feature3Ref, feature4Ref];
  const visibilityStates = [isFeature1Visible, isFeature2Visible, isFeature3Visible, isFeature4Visible];

  return (
    <StyledFeaturesGrid>
      {features.map((feature, index) => (
        <FeatureItem
          key={feature.id}
          feature={feature}
          isVisible={visibilityStates[index]}
          delay={animationDelays[index]}
          elementRef={refs[index]}
        />
      ))}
    </StyledFeaturesGrid>
  );
}; 