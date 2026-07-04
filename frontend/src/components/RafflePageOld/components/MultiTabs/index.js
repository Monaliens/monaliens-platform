import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';

// Animations
const slideInFromRight = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideInFromLeft = keyframes`
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

// Styled Components
const TabContainer = styled.div`
  width: 100%;
  background: #f8fafc;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const TabButtons = styled.div`
  display: flex;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  position: relative;
  overflow-x: auto;
  
  @media (max-width: 768px) {
    flex-wrap: nowrap;
    overflow-x: scroll;
    scrollbar-width: none;
    -ms-overflow-style: none;
    
    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

const TabButton = styled.button`
  flex: 1;
  min-width: 120px;
  padding: 14px 16px;
  background: transparent;
  border: none;
  color: ${props => props.$active ? '#6930c3' : '#6b7280'};
  font-weight: ${props => props.$active ? '600' : '500'};
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  position: relative;
  z-index: 2;
  white-space: nowrap;
  
  &:hover {
    color: ${props => props.$active ? '#6930c3' : '#374151'};
  }
  
  @media (max-width: 768px) {
    font-size: 12px;
    padding: 12px 8px;
    min-width: 100px;
  }
`;

const TabIndicator = styled.div`
  position: absolute;
  bottom: 0;
  left: ${props => (props.$activeTab / props.$totalTabs) * 100}%;
  width: ${props => 100 / props.$totalTabs}%;
  height: 2px;
  background: #6930c3;
  transition: left 0.3s ease;
  z-index: 1;
`;

const TabContent = styled.div`
  padding: 20px;
  min-height: 400px;
  max-height: 80vh;
  overflow-y: auto;
  animation: ${props => props.$direction === 'right' ? slideInFromRight : slideInFromLeft} 0.3s ease-out;
  
  @media (max-width: 768px) {
    padding: 16px;
    max-height: 70vh;
  }
`;

const MultiTabs = ({ tabs, defaultTab = 0 }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [direction, setDirection] = useState('right');

  const handleTabChange = (newTab) => {
    if (newTab !== activeTab) {
      setDirection(newTab > activeTab ? 'left' : 'right');
      setActiveTab(newTab);
    }
  };

  return (
    <TabContainer>
      <TabButtons>
        {tabs.map((tab, index) => (
          <TabButton
            key={index}
            $active={activeTab === index}
            onClick={() => handleTabChange(index)}
          >
            {tab.label}
          </TabButton>
        ))}
        <TabIndicator $activeTab={activeTab} $totalTabs={tabs.length} />
      </TabButtons>
      
      <TabContent $direction={direction} key={activeTab}>
        {tabs[activeTab]?.content}
      </TabContent>
    </TabContainer>
  );
};

export default MultiTabs;