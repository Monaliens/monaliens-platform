import styled from 'styled-components';

// Main container
export const FiltersContainer = styled.div`
  background: white;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    padding: 1.5rem;
    border-radius: 15px;
  }
`;

// Grid layout
export const FiltersGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 1rem;
  align-items: end;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1rem;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

// Form components
export const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  
  label {
    font-family: 'Lexend', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }
`;

export const SearchInput = styled.input`
  font-family: 'Lexend', sans-serif;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  background: #f9fafb;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #6930c3;
    background: white;
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
  }
  
  &::placeholder {
    color: #9ca3af;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const SelectInput = styled.select`
  font-family: 'Lexend', sans-serif;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  background: #f9fafb;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #6930c3;
    background: white;
    box-shadow: 0 0 0 3px rgba(105, 48, 195, 0.1);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const ClearButton = styled.button`
  font-family: 'Lexend', sans-serif;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  height: fit-content;
  align-self: end;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// Quick filters section
export const QuickFiltersSection = styled.div`
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
`;

export const QuickFiltersLabel = styled.div`
  font-family: 'Lexend', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 1rem;
`;

export const QuickFilters = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    justify-content: center;
  }
`;

export const QuickFilterChip = styled.button`
  font-family: 'Lexend', sans-serif;
  padding: 0.5rem 1rem;
  background: ${props => props.$active ? 'linear-gradient(135deg, #6930c3 0%, #8e44ad 100%)' : '#f3f4f6'};
  color: ${props => props.$active ? 'white' : '#6b7280'};
  border: none;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover:not(:disabled) {
    ${props => !props.$active && `
      background: #e5e7eb;
      color: #374151;
    `}
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`; 