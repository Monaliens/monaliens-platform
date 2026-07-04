import React from 'react';
import { 
  QuickFiltersSection, 
  QuickFiltersLabel, 
  QuickFilters as QuickFiltersContainer, 
  QuickFilterChip 
} from '../styles';
import { filterLabels, quickFilterChips } from '../data/filterContent';

// Component for quick filter chips section
const QuickFilters = ({
  localFilters,
  handleQuickFilter,
  loading = false
}) => {
  return (
    <QuickFiltersSection>
      <QuickFiltersLabel>{filterLabels.quickFilters}</QuickFiltersLabel>
      <QuickFiltersContainer>
        {quickFilterChips.map(chip => (
          <QuickFilterChip
            key={chip.id}
            $active={localFilters[chip.filterType] === chip.value}
            onClick={() => handleQuickFilter(chip.filterType, chip.value)}
            disabled={loading}
          >
            {chip.label}
          </QuickFilterChip>
        ))}
      </QuickFiltersContainer>
    </QuickFiltersSection>
  );
};

export default QuickFilters; 