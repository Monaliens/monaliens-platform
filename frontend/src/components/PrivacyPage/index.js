import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 40px 20px 80px;
  max-width: 900px;
  margin: 0 auto;
  animation: ${fadeIn} 0.5s ease-out;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 30px;
  transition: color 0.2s ease;

  &:hover {
    color: var(--accent-primary);
  }
`;

const Title = styled.h1`
  font-size: 42px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;

  @media (max-width: 768px) {
    font-size: 32px;
  }
`;

const LastUpdated = styled.p`
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 40px;
`;

const Content = styled.div`
  background: var(--bg-glass);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 40px;

  @media (max-width: 768px) {
    padding: 24px;
  }
`;

const Section = styled.section`
  margin-bottom: 32px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h2`
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light);
`;

const SubTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 20px 0 12px;
`;

const Paragraph = styled.p`
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin-bottom: 16px;
`;

const List = styled.ul`
  margin: 12px 0 16px 20px;

  li {
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }
`;

const Highlight = styled.div`
  background: var(--bg-secondary);
  border-left: 3px solid var(--accent-primary);
  padding: 16px;
  margin: 16px 0;
  border-radius: 0 8px 8px 0;

  p {
    margin: 0;
    font-weight: 500;
  }
`;

const WarningBox = styled.div`
  background: rgba(234, 88, 12, 0.1);
  border: 1px solid rgba(234, 88, 12, 0.3);
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;

  p {
    margin: 0;
    color: #ea580c;
    font-weight: 600;
  }
`;

const PrivacyPage = () => {
  return (
    <PageContainer>
      <BackLink to="/">
        <ArrowLeft size={18} />
        Back to Home
      </BackLink>

      <Title>Privacy Policy</Title>
      <LastUpdated>Last Updated: January 7, 2026</LastUpdated>

      <Content>
        <Section>
          <SectionTitle>Overview</SectionTitle>
          <Paragraph>
            At Monaliens (referred to as "we," "our," or "the Company"), protecting your privacy is paramount. This privacy policy explains how we handle information collected through our website monaliens.xyz and associated applications (collectively referred to as the "Platform"). This policy works in conjunction with our Terms of Service to govern your interaction with our Platform.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>Scope</SectionTitle>
          <Paragraph>This privacy policy governs information collection through:</Paragraph>
          <List>
            <li>The Platform itself</li>
            <li>Communications between you and the Platform</li>
            <li>Mobile and desktop applications connected to the Platform</li>
            <li>Interactions with our advertisements and applications on third-party platforms</li>
            <li>Any other Platform-related activities</li>
          </List>
          <Paragraph>This policy excludes:</Paragraph>
          <List>
            <li>Information collected through other Company websites or offline channels</li>
            <li>Information collected by third parties, even if linked from our Platform</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>Age Restrictions</SectionTitle>
          <Paragraph>
            Our Platform is designed for users aged <strong>18 and older</strong>. We strictly prohibit users under 18 from providing personal information or using our Services, particularly our gaming features. If we discover we've inadvertently collected information from someone under 18, we'll promptly delete it.
          </Paragraph>
          <Paragraph>
            Please notify us at <strong>monaliensmonad@gmail.com</strong> if you believe we have information from a minor.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>Information Collection</SectionTitle>

          <SubTitle>Types of Information</SubTitle>
          <Paragraph>We gather various information, including:</Paragraph>
          <List>
            <li><strong>Wallet Information:</strong> Public wallet addresses connected to the Platform</li>
            <li><strong>Device Information:</strong> Operating system, browser details, network information</li>
            <li><strong>Technical Identifiers:</strong> IP address, device fingerprints</li>
            <li><strong>Usage Data:</strong> Pages visited, games played, transaction history, timestamps</li>
            <li><strong>Geographic Location:</strong> For geo-blocking and compliance purposes</li>
            <li><strong>Platform Interaction Data:</strong> Game results, betting history, NFT activities</li>
          </List>

          <SubTitle>Blockchain Data</SubTitle>
          <Highlight>
            <Paragraph>
              All blockchain transactions on Monad are publicly visible. Your wallet address and on-chain transaction history are inherently public and not controlled by us.
            </Paragraph>
          </Highlight>

          <SubTitle>Collection Methods</SubTitle>
          <Paragraph>We obtain information through:</Paragraph>
          <List>
            <li>Wallet connection (when you connect your Web3 wallet)</li>
            <li>Automated collection (cookies, tracking technologies)</li>
            <li>Platform transactions and gaming activities</li>
            <li>Customer service interactions</li>
            <li>Search queries and browsing behavior</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>Automatic Data Collection</SectionTitle>

          <SubTitle>Technologies Used</SubTitle>
          <Paragraph>We employ various tracking technologies:</Paragraph>
          <List>
            <li>Browser cookies</li>
            <li>Web beacons and pixels</li>
            <li>Local storage</li>
            <li>Device fingerprinting</li>
            <li>Server logs</li>
          </List>

          <Paragraph>These technologies help us:</Paragraph>
          <List>
            <li>Enable Platform functionality</li>
            <li>Prevent fraud and abuse</li>
            <li>Enforce geo-restrictions</li>
            <li>Analyze performance</li>
            <li>Enhance user experience</li>
            <li>Measure usage patterns</li>
            <li>Ensure gaming integrity</li>
          </List>

          <SubTitle>Analytics and Third-Party Tools</SubTitle>
          <Paragraph>
            We utilize analytics services to analyze Platform usage. These services may collect your IP address and other data for their own purposes. For Google Analytics, you can opt out at <a href="https://tools.google.com/dlpage/gaoptout/" target="_blank" rel="noopener noreferrer">https://tools.google.com/dlpage/gaoptout/</a>.
          </Paragraph>

          <SubTitle>Do Not Track Settings</SubTitle>
          <Paragraph>
            We respect Do Not Track (DNT) browser settings to the extent technically possible. When DNT is enabled, certain tracking technologies may become inactive, potentially affecting some Platform features.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>Information Usage</SectionTitle>
          <Paragraph>We use collected information to:</Paragraph>
          <List>
            <li>Operate and improve the Platform</li>
            <li>Process gaming transactions and payouts</li>
            <li>Verify game outcomes (provably fair)</li>
            <li>Enforce Terms of Service and geo-restrictions</li>
            <li>Prevent fraud, cheating, and abuse</li>
            <li>Provide customer support</li>
            <li>Analyze usage patterns</li>
            <li>Comply with legal obligations</li>
            <li>Communicate important updates</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>Information Sharing</SectionTitle>
          <Highlight>
            <Paragraph><strong>We do NOT sell your personal information.</strong></Paragraph>
          </Highlight>
          <Paragraph>We may share information:</Paragraph>
          <List>
            <li>With service providers (hosting, analytics, security)</li>
            <li>During corporate transactions (mergers, acquisitions)</li>
            <li>For legal compliance and law enforcement requests</li>
            <li>To protect our rights, safety, or property</li>
            <li>To enforce our Terms of Service</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>Data Retention</SectionTitle>
          <Paragraph>We retain data as long as necessary to:</Paragraph>
          <List>
            <li>Provide our Services</li>
            <li>Comply with legal obligations</li>
            <li>Maintain game verification records</li>
            <li>Resolve disputes</li>
            <li>Enforce our agreements</li>
          </List>
          <Paragraph>
            Gaming history is retained for provably fair verification purposes.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>Security Measures</SectionTitle>
          <Paragraph>
            We implement reasonable security measures to protect your information. However, no internet transmission is completely secure. You should:
          </Paragraph>
          <List>
            <li>Protect your wallet private keys</li>
            <li>Use secure network connections</li>
            <li>Be cautious of phishing attempts</li>
            <li>Never share your seed phrase with anyone</li>
          </List>
          <WarningBox>
            <Paragraph>We will NEVER ask for your private keys or seed phrase.</Paragraph>
          </WarningBox>
        </Section>

        <Section>
          <SectionTitle>Your Rights</SectionTitle>
          <Paragraph>Depending on your jurisdiction, you may have the right to:</Paragraph>
          <List>
            <li>Access your personal data</li>
            <li>Request deletion of your data</li>
            <li>Opt out of certain data collection</li>
            <li>Request data portability</li>
          </List>
          <Paragraph>
            Contact us at <strong>monaliensmonad@gmail.com</strong> for any data-related requests.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>International Users</SectionTitle>
          <Paragraph>
            Our Services are not available in restricted jurisdictions (see Terms of Service). By using our Services from permitted locations, you consent to data processing in accordance with this policy.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>Policy Updates</SectionTitle>
          <Paragraph>
            We may update this policy periodically. Changes will be posted on this page with an updated "Last Updated" date. Your continued use of the Platform after changes indicates acceptance of the updated policy.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>Contact Information</SectionTitle>
          <Paragraph>
            For questions about this policy, contact us at: <strong>monaliensmonad@gmail.com</strong>
          </Paragraph>
        </Section>

        <Highlight>
          <Paragraph>
            <strong>By using Monaliens, you acknowledge that you have read and agree to this Privacy Policy.</strong>
          </Paragraph>
        </Highlight>
      </Content>
    </PageContainer>
  );
};

export default PrivacyPage;
