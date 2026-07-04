import React, { memo } from 'react';
import { AttributeTabs } from './components/AttributeTabs';
import { AttributeSelector } from './components/AttributeSelector';
import { PreviewCanvas } from './components/PreviewCanvas';
import { LoadingSpinner, ErrorState } from './components/LoadingSpinner';
import { useAssetLoader } from './hooks/useAssetLoader';
import { useBuildState } from './hooks/useBuildState';
import { BuildContainer, BuildInterface } from './styles';

/**
 * BuildPage Component - Character builder with asset selection and preview
 * Ultra optimized version with minimal re-renders
 */
const BuildPage = memo(() => {
  // Asset loading with progress tracking and error handling
  const { 
    availableAttributes, 
    bodyPath, 
    isLoading, 
    error, 
    loadingProgress,
    loadingMessage,
    retryLoad
  } = useAssetLoader();

  // Build state management with optimized updates
  const {
    selectedAttributes,
    activeTab,
    setActiveTab,
    selectAttribute,
    resetSelections,
    randomizeSelections,
    getSelectedName
  } = useBuildState(availableAttributes, bodyPath);

  // Loading state - show spinner during asset loading
  if (isLoading) {
    return (
      <BuildContainer className="build-page-optimized">
        <LoadingSpinner 
          progress={loadingProgress}
          message={loadingMessage}
          subMessage="Loading character assets..."
        />
      </BuildContainer>
    );
  }

  // Error state - show error with retry option
  if (error) {
    return (
      <BuildContainer className="build-page-optimized">
        <ErrorState 
          error={error} 
          onRetry={retryLoad}
        />
      </BuildContainer>
    );
  }

  return (
    <BuildContainer className="build-page-optimized stable-render">
      <div role="main" aria-label="Character Builder">
        <BuildInterface>
          {/* Left Panel - Attribute Selector */}
          <section aria-label="Selected Attributes and Actions">
            <AttributeSelector
              selectedAttributes={selectedAttributes}
              getSelectedName={getSelectedName}
              resetSelections={resetSelections}
              randomizeSelections={randomizeSelections}
            />
          </section>

          {/* Center - Preview Canvas */}
          <section aria-label="Character Preview">
            <PreviewCanvas selectedAttributes={selectedAttributes} />
          </section>

          {/* Right Panel - Attribute Tabs */}
          <section aria-label="Attribute Selection">
            <AttributeTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              availableAttributes={availableAttributes}
              selectedAttributes={selectedAttributes}
              selectAttribute={selectAttribute}
            />
          </section>
        </BuildInterface>
      </div>
    </BuildContainer>
  );
});

BuildPage.displayName = 'BuildPage';

export default BuildPage; 