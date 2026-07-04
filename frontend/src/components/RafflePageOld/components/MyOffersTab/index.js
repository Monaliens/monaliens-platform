import React from 'react';
import styled from 'styled-components';

const TabContainer = styled.div`
  font-family: 'Lexend', sans-serif;
  text-align: center;
  padding: 40px 20px;
`;

const Title = styled.h3`
  font-family: 'Lexend', sans-serif;
  color: #6930c3;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 16px;
`;

const Description = styled.p`
  font-family: 'Lexend', sans-serif;
  color: #6b7280;
  font-size: 16px;
  line-height: 1.6;
  max-width: 500px;
  margin: 0 auto;
`;

const ComingSoonBadge = styled.div`
  font-family: 'Lexend', sans-serif;
  display: inline-block;
  background: linear-gradient(135deg, #6930c3 0%, #8b5cf6 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 20px;
`;

const MyOffersTab = () => {
  return (
    <TabContainer>
      <Title>My Offers</Title>
      <Description>
        Track and manage all your created raffles in one place. See their status, 
        participants, and earnings.
      </Description>
      <ComingSoonBadge>Coming Soon</ComingSoonBadge>
    </TabContainer>
  );
};

export default MyOffersTab;