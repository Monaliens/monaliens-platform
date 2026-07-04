import React, { memo, useMemo, useCallback } from 'react';
import { renderIcon } from '../utils/iconRenderer';
import {
  RightPanel,
  AttributeTabsContainer,
  AttributeTabsBar,
  AttributeTabIndicator,
  AttributeTab,
  AttributeGrid,
  AttributeOption,
  AttributeImage,
  AttributeLabel
} from '../styles';

// Optimized attribute tabs component - prevent re-renders and runtime calculations
export const AttributeTabs = memo(({
  activeTab,
  setActiveTab,
  availableAttributes,
  selectedAttributes,
  selectAttribute
}) => {
  // Static tab configuration - never changes to prevent re-renders
  const tabs = useMemo(() => [
    { type: 'head', label: 'Head', shortLabel: 'Head' },
    { type: 'eyes', label: 'Eyes', shortLabel: 'Eyes' },
    { type: 'mouth', label: 'Mouth', shortLabel: 'Mouth' },
    { type: 'clothes', label: 'Clothes', shortLabel: 'Clothes' },
    { type: 'hands', label: 'Hands', shortLabel: 'Hands' },
    { type: 'background', label: 'Background', shortLabel: 'BG' }
  ], []);

  // Memoized active tab index calculation
  const activeTabIndex = useMemo(() => 
    Math.max(0, tabs.findIndex(tab => tab.type === activeTab))
  , [tabs, activeTab]);

  // Static layer order - never changes
  const layerOrder = useMemo(() => ({
    head: 7,
    eyes: 6,
    mouth: 5,
    clothes: 4,
    body: 3,
    hands: 2,
    background: 1
  }), []);

  // Optimized tab selection handler
  const handleTabSelect = useCallback((tabType) => {
    setActiveTab(tabType);
  }, [setActiveTab]);

  // Optimized keyboard navigation
  const handleTabKeyDown = useCallback((e, tabType) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabSelect(tabType);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const currentIndex = tabs.findIndex(tab => tab.type === tabType);
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      const newIndex = (currentIndex + direction + tabs.length) % tabs.length;
      const newTab = tabs[newIndex];
      handleTabSelect(newTab.type);
      
      // Focus management
      setTimeout(() => {
        const newTabElement = document.querySelector(`[data-tab="${newTab.type}"]`);
        if (newTabElement) newTabElement.focus();
      }, 0);
    }
  }, [tabs, handleTabSelect]);

  // Optimized attribute selection with performance enhancement
  const handleAttributeSelect = useCallback((attributeType, item, event) => {
    selectAttribute(attributeType, item);
    
    // Optimized visual feedback - no DOM queries during selection
    const element = event.currentTarget;
    element.style.transition = 'all 0.3s ease';
    element.style.transform = 'scale(0.98) translateZ(0)';
    element.style.backgroundColor = '#e0d4ff';
    element.style.borderColor = '#a855f7';
    
    setTimeout(() => {
      element.style.transform = 'scale(1) translateZ(0)';
      element.style.backgroundColor = '';
      element.style.borderColor = '';
    }, 600);
  }, [selectAttribute]);

  // PERFORMANCE FIX: CSS classname instead of prop-based styling
  const renderAttributeTab = useCallback((tab, index) => (
    <AttributeTab 
      key={tab.type}
      className={activeTab === tab.type ? 'active' : ''}
      onClick={() => handleTabSelect(tab.type)}
      onKeyDown={(e) => handleTabKeyDown(e, tab.type)}
      role="tab"
      tabIndex={activeTab === tab.type ? 0 : -1}
      aria-selected={activeTab === tab.type}
      aria-controls={`tabpanel-${tab.type}`}
      data-tab={tab.type}
      title={`Switch to ${tab.label} selection`}
    >
      <div aria-hidden="true">
        {renderIcon(tab.type)}
      </div>
      {/* Use CSS for responsive text instead of JS */}
      <span className="tab-text-full">{tab.label}</span>
      <span className="tab-text-short">{tab.shortLabel}</span>
    </AttributeTab>
  ), [activeTab, handleTabSelect, handleTabKeyDown]);

  // Heavily optimized attribute options renderer
  const renderAttributeOptions = useMemo(() => {
    const attributeType = activeTab;
    
    if (!availableAttributes[attributeType]) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: '40px 20px'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📦</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '5px' }}>
            No {attributeType} available
          </div>
          <div style={{ fontSize: '14px' }}>
            Assets for this category haven't been loaded yet.
          </div>
        </div>
      );
    }

    return availableAttributes[attributeType].map((item, index) => {
      const isSelected = selectedAttributes[attributeType] === item.path;
      const showBodyBase = (attributeType !== 'background' && attributeType !== 'body') && selectedAttributes.body;
      
      return (
        <AttributeOption
          key={`${item.path}-${index}`}
          className={isSelected ? 'selected' : ''}
          onClick={(e) => handleAttributeSelect(attributeType, item, e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleAttributeSelect(attributeType, item, e);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Select ${item.name} for ${attributeType}`}
          aria-pressed={isSelected}
          title={`${item.name} - Click to select`}
        >
          <AttributeImage>
            {/* Optimized body base rendering */}
            {showBodyBase && (
              <img 
                className="body-base" 
                src={selectedAttributes.body} 
                alt="Character body"
                style={{ 
                  zIndex: layerOrder.body,
                  opacity: 0.8
                }}
                loading="lazy"
                aria-hidden="true"
              />
            )}
            <img 
              className={attributeType === 'background' ? 'background-img' : 'attribute-img'} 
              src={item.path} 
              alt={item.name}
              style={{ zIndex: layerOrder[attributeType] || 1 }}
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
                console.warn(`Failed to load image: ${item.name}`);
              }}
            />
          </AttributeImage>
          <AttributeLabel 
            title={item.name}
          >
            {item.name}
          </AttributeLabel>
        </AttributeOption>
      );
    });
  }, [activeTab, availableAttributes, selectedAttributes, layerOrder, handleAttributeSelect]);

  return (
    <RightPanel role="region" aria-label="Character attribute selection">
      {/* Optimized Tab Bar */}
      <AttributeTabsContainer>
        <AttributeTabsBar 
          role="tablist" 
          aria-label="Character attribute categories"
          aria-orientation="horizontal"
          style={{
            '--tab-position': `calc(4px + ${activeTabIndex} * (100% - 8px) / 6)`,
            '--tab-position-mobile': `calc(3px + ${activeTabIndex} * (100% - 6px) / 6)`
          }}
        >
          <AttributeTabIndicator 
            aria-hidden="true"
          />
          {tabs.map((tab, index) => renderAttributeTab(tab, index))}
        </AttributeTabsBar>
      </AttributeTabsContainer>
      
      {/* Optimized Selection grid */}
      <AttributeGrid
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        aria-label={`${activeTab} selection options`}
      >
        {renderAttributeOptions}
      </AttributeGrid>
    </RightPanel>
  );
});

AttributeTabs.displayName = 'AttributeTabs'; 