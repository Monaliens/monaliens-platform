import React from 'react';
import { FiltersContainer } from './styles';
import { useFilterState } from './hooks/useFilterState';
import FilterInputs from './components/FilterInputs';
import QuickFilters from './components/QuickFilters';

// Main RaffleFilters component - composition only
const RaffleFilters = ({ 
  filters = {}, 
  onFilterChange, 
  resultCount = 0,
  loading = false 
}) => {
  // Get filter state and handlers from custom hook
  const {
    localFilters,
    handleInputChange,
    handleQuickFilter,
    handleClearFilters,
    hasActiveFilters
  } = useFilterState(filters, onFilterChange);

  return (
    <FiltersContainer>
      <FilterInputs
        localFilters={localFilters}
        handleInputChange={handleInputChange}
        handleClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
      />
      
      <QuickFilters
        localFilters={localFilters}
        handleQuickFilter={handleQuickFilter}
        loading={loading}
      />
    </FiltersContainer>
  );
};

export default RaffleFilters; 