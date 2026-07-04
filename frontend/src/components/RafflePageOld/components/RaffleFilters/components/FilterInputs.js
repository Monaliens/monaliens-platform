import React from 'react';
import { 
  FiltersGrid, 
  FilterGroup, 
  SearchInput, 
  SelectInput, 
  ClearButton 
} from '../styles';
import { 
  filterLabels, 
  statusOptions, 
  prizeTypeOptions 
} from '../data/filterContent';
import { STRINGS } from '../../../utils/constants';

// Component for main filter input fields
const FilterInputs = ({
  localFilters,
  handleInputChange,
  handleClearFilters,
  hasActiveFilters,
  loading = false
}) => {
  return (
    <FiltersGrid>
      <FilterGroup>
        <label>{filterLabels.search}</label>
        <SearchInput
          type="text"
          placeholder={STRINGS.SEARCH_RAFFLES}
          value={localFilters.search}
          onChange={(e) => handleInputChange('search', e.target.value)}
          disabled={loading}
        />
      </FilterGroup>

      <FilterGroup>
        <label>{filterLabels.status}</label>
        <SelectInput
          value={localFilters.status}
          onChange={(e) => handleInputChange('status', e.target.value)}
          disabled={loading}
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterGroup>

      <FilterGroup>
        <label>{filterLabels.prizeType}</label>
        <SelectInput
          value={localFilters.prizeType}
          onChange={(e) => handleInputChange('prizeType', e.target.value)}
          disabled={loading}
        >
          {prizeTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterGroup>

      {hasActiveFilters && (
        <ClearButton onClick={handleClearFilters} disabled={loading}>
          {filterLabels.clearAll}
        </ClearButton>
      )}
    </FiltersGrid>
  );
};

export default FilterInputs; 