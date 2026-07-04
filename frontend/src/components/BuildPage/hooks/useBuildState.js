import { useState, useEffect, useCallback, useMemo } from 'react';

// Optimized build state management hook - minimize re-renders
export const useBuildState = (availableAttributes, bodyPath) => {
  // Stable initial state to prevent unnecessary re-renders
  const initialState = useMemo(() => ({
    background: '',
    head: '',
    eyes: '',
    mouth: '',
    clothes: '',
    hands: '',
    body: '',
  }), []);

  const [selectedAttributes, setSelectedAttributes] = useState(initialState);

  const [activeTab, setActiveTab] = useState('head'); // Fixed initial tab

  // Optimized initialization - reduce state updates
  useEffect(() => {
    if (availableAttributes.background?.length > 0 && bodyPath && !selectedAttributes.body) {
      // Single state update instead of multiple
      setSelectedAttributes(prev => ({
        ...prev,
        background: availableAttributes.background[0]?.path || '',
        body: bodyPath
      }));
    }
  }, [availableAttributes.background, bodyPath, selectedAttributes.body]);

  // Memoized select function to prevent re-creation
  const selectAttribute = useCallback((attribute, item) => {
    if (attribute === 'body') return;
    
    setSelectedAttributes(prev => ({
      ...prev,
      [attribute]: item.path
    }));
  }, []);

  // Memoized reset function
  const resetSelections = useCallback(() => {
    setSelectedAttributes({
      background: availableAttributes.background?.[0]?.path || '',
      head: '',
      eyes: '',
      mouth: '',
      clothes: '',
      hands: '',
      body: bodyPath,
    });
  }, [availableAttributes.background?.[0]?.path, bodyPath]); // PERFORMANCE FIX: Only depend on first background path, not full array

  // Memoized randomize function
  const randomizeSelections = useCallback(() => {
    const getRandomItem = (items) => {
      if (!items?.length) return '';
      return items[Math.floor(Math.random() * items.length)].path;
    };

    setSelectedAttributes({
      background: getRandomItem(availableAttributes.background),
      head: getRandomItem(availableAttributes.head),
      eyes: getRandomItem(availableAttributes.eyes),
      mouth: getRandomItem(availableAttributes.mouth),
      clothes: getRandomItem(availableAttributes.clothes),
      hands: getRandomItem(availableAttributes.hands),
      body: bodyPath,
    });
  }, [availableAttributes, bodyPath]);

  // Memoized name getter to prevent re-calculation
  const getSelectedName = useCallback((attribute) => {
    if (attribute === 'body') return 'Default Body';
    if (!selectedAttributes[attribute]) return 'None';
    
    const selected = availableAttributes[attribute]?.find(
      item => item.path === selectedAttributes[attribute]
    );
    
    return selected?.name || 'None';
  }, [selectedAttributes, availableAttributes]);

  // Memoized stable tab setter
  const stableSetActiveTab = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  return {
    selectedAttributes,
    activeTab,
    setActiveTab: stableSetActiveTab,
    selectAttribute,
    resetSelections,
    randomizeSelections,
    getSelectedName
  };
}; 