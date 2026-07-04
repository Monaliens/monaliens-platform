import React from 'react';
import { MarketplaceButtons as MarketplaceButtonsContainer, MarketplaceButton, SocialButton, SocialButtonsGroup } from '../styles';
import { heroContent } from '../data/heroContent';
import xIcon from '../../../assets/images/x-twitter.svg';
import discordIcon from '../../../assets/images/discord.svg';

// Icon mapping for social media
const iconMap = {
  X: xIcon,
  Discord: discordIcon
};

// Component for displaying marketplace buttons/links
const MarketplaceButtons = () => {
  return (
    <>
      {/* Collection buttons (centered) */}
      <MarketplaceButtonsContainer>
        {heroContent.marketplaceLinks.map((link) => (
          <MarketplaceButton
            key={link.id}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={link.logo} alt={link.alt} />
            {link.label.split('\n').map((line, index, array) => (
              <React.Fragment key={index}>
                {line}
                {index < array.length - 1 && <br />}
              </React.Fragment>
            ))}
          </MarketplaceButton>
        ))}
      </MarketplaceButtonsContainer>

      {/* Social media buttons (right side, icon only) */}
      <SocialButtonsGroup>
        {heroContent.socialLinks.map((link) => {
          const iconSrc = iconMap[link.icon];
          return (
            <SocialButton
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.alt}
              $iconType={link.id}
            >
              {iconSrc && <img src={iconSrc} alt={link.alt} />}
            </SocialButton>
          );
        })}
      </SocialButtonsGroup>
    </>
  );
};

export default MarketplaceButtons;