import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { COLOR_CONFIG } from '../data/modalConfig';

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
`;

const TabButtons = styled.div`
  display: flex;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  position: relative;
`;

const TabButton = styled.button`
  flex: 1;
  padding: 14px 16px;
  background: transparent;
  border: none;
  color: ${props => props.$active ? COLOR_CONFIG.primary : '#6b7280'};
  font-weight: ${props => props.$active ? '600' : '500'};
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  position: relative;
  z-index: 2;
  
  &:hover {
    color: ${props => props.$active ? COLOR_CONFIG.primary : '#374151'};
  }
`;

const TabIndicator = styled.div`
  position: absolute;
  bottom: 0;
  left: ${props => props.$activeTab * 50}%;
  width: 50%;
  height: 2px;
  background: ${COLOR_CONFIG.primary};
  transition: left 0.3s ease;
  z-index: 1;
`;

const TabContent = styled.div`
  padding: 20px;
  min-height: 300px;
  max-height: 39rem;
  overflow-y: auto;
  animation: ${props => props.$direction === 'right' ? slideInFromRight : slideInFromLeft} 0.3s ease-out;
`;

const SlidingTabs = ({ tabs, defaultTab = 0 }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [direction, setDirection] = useState('right');

  const handleTabChange = (newTab) => {
    if (newTab !== activeTab) {
      // Fix animation direction: 
      // Going from Info (0) to Participants (1) should slide left -> right
      // Going from Participants (1) to Info (0) should slide right -> left
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
        <TabIndicator $activeTab={activeTab} />
      </TabButtons>
      
      <TabContent $direction={direction} key={activeTab}>
        {tabs[activeTab]?.content}
      </TabContent>
    </TabContainer>
  );
};

export default SlidingTabs;