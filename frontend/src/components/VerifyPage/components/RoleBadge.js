import React from 'react';
import styled, { keyframes } from 'styled-components';

const fadeInScale = keyframes`
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-primary);
  background: ${props => props.$color || 'var(--text-secondary)'};
  color: #ffffff;
  border: 2px solid var(--bg-glass);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  transition: all 0.2s ease;
  cursor: default;
  animation: ${fadeInScale} 0.4s ease-out forwards;
  animation-delay: ${props => props.$index * 0.1}s;
  opacity: 0;

  &:hover {
    transform: translateY(-1px) scale(1.02);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
    border-color: var(--bg-glass-hover);
  }
`;

const RolesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
`;

/**
 * RoleBadge Component
 * Displays Discord roles with custom colors
 *
 * @param {Object} props - Component props
 * @param {Array} props.roles - Array of role objects with roleName and color
 */
const RoleBadges = ({ roles }) => {
  if (!roles || roles.length === 0) {
    return null;
  }

  return (
    <RolesContainer>
      {roles.map((role, index) => (
        <Badge key={index} $color={role.color} $index={index}>
          {role.roleName}
        </Badge>
      ))}
    </RolesContainer>
  );
};

export default RoleBadges;
