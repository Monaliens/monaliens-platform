import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

const FooterContainer = styled.footer`
  padding: 40px 20px;
  margin-top: 60px;
  border-top: 1px solid var(--border-light);
`;

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`;

const Logo = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
`;

const LinksRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 24px;

  @media (max-width: 480px) {
    gap: 16px;
  }
`;

const FooterLink = styled(Link)`
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s ease;

  &:hover {
    color: var(--accent-primary);
  }
`;

const ExternalLink = styled.a`
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s ease;

  &:hover {
    color: var(--accent-primary);
  }
`;

const Divider = styled.div`
  width: 100%;
  max-width: 600px;
  height: 1px;
  background: var(--border-light);
`;

const Copyright = styled.p`
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
`;

const Footer = () => {
  return (
    <FooterContainer>
      <FooterContent>
        <Logo>
          Monaliens
        </Logo>

        <LinksRow>
          <FooterLink to="/terms">Terms of Service</FooterLink>
          <FooterLink to="/privacy">Privacy Policy</FooterLink>
          <ExternalLink href="mailto:monaliensmonad@gmail.com">
            Contact
          </ExternalLink>
          <ExternalLink href="https://twitter.com/monaliens" target="_blank" rel="noopener noreferrer">
            Twitter
          </ExternalLink>
          <ExternalLink href="https://discord.gg/monaliens" target="_blank" rel="noopener noreferrer">
            Discord
          </ExternalLink>
        </LinksRow>

        <Divider />

        <Copyright>
          © 2026 Monaliens. All rights reserved. For entertainment purposes only.
        </Copyright>
      </FooterContent>
    </FooterContainer>
  );
};

export default Footer;
