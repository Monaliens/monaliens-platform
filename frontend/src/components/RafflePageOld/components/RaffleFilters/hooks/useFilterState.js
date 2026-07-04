import { useState, useCallback } from 'react';
import { initialFilters, SEARCH_DEBOUNCE_MS } from '../data/filterContent';

// Custom hook for managing filter state and handlers
export const useFilterState = (filters = {}, onFilterChange) => {
  const [localFilters, setLocalFilters] = useState({
    ...initialFilters,
    ...filters
  });

  // Handle input field changes with search debouncing
  const handleInputChange = useCallback((field, value) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    
    if (field === 'search') {
      // Debounce search input
      const timeoutId = setTimeout(() => {
        onFilterChange(newFilters);
      }, SEARCH_DEBOUNCE_MS);
      return () => clearTimeout(timeoutId);
    } else {
      // Immediate update for select inputs
      onFilterChange(newFilters);
    }
  }, [localFilters, onFilterChange]);

  // Handle quick filter chip toggle
  const handleQuickFilter = useCallback((filterType, value) => {
    const newFilters = { 
      ...localFilters, 
      [filterType]: localFilters[filterType] === value ? '' : value 
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  }, [localFilters, onFilterChange]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    const clearedFilters = { ...initialFilters };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  }, [onFilterChange]);

  // Check if any filters are active
  const hasActiveFilters = Object.values(localFilters).some(value => value && value !== '');

  return {
    localFilters,
    handleInputChange,
    handleQuickFilter,
    handleClearFilters,
    hasActiveFilters
  };
}; 