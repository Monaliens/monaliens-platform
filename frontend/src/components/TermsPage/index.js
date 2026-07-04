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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 14px;

  th, td {
    padding: 12px;
    text-align: left;
    border: 1px solid var(--border-light);
  }

  th {
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-weight: 600;
  }

  td {
    color: var(--text-secondary);
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

const TermsPage = () => {
  return (
    <PageContainer>
      <BackLink to="/">
        <ArrowLeft size={18} />
        Back to Home
      </BackLink>

      <Title>Terms of Service</Title>
      <LastUpdated>Last Updated: January 7, 2026</LastUpdated>

      <Content>
        <Section>
          <Paragraph>
            Welcome to Monaliens (monaliens.xyz), a decentralized Web3 entertainment platform. By accessing or using our platform, you agree to these Terms of Service ("Terms"). If you do not agree, do not use our Services.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>1. What is Monaliens?</SectionTitle>
          <Paragraph>
            Monaliens is a Web3 entertainment platform on the Monad blockchain offering:
          </Paragraph>
          <List>
            <li><strong>NFT Services:</strong> Collecting, trading, staking, auctions, and raffles</li>
            <li><strong>Gaming Services:</strong> Provably fair games including Blackjack, Mines, Dice, Limbo, HiLo, Coin Flip, and Spin Wheel</li>
            <li><strong>P2P Trading:</strong> Peer-to-peer NFT and MON trading</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>2. Eligibility</SectionTitle>
          <Paragraph>
            You must be <strong>18 years or older</strong> to use our Services.
          </Paragraph>
          <Highlight>
            <Paragraph>
              <strong>You may NOT use our Services if you are:</strong>
            </Paragraph>
          </Highlight>
          <List>
            <li>A resident of the United States of America</li>
            <li>Located in Cuba, Iran, North Korea, Syria, Crimea, or other sanctioned regions</li>
            <li>Subject to any economic sanctions or on any prohibited persons list</li>
            <li>Prohibited by your local laws from using cryptocurrency or gaming services</li>
          </List>
          <Paragraph>
            By using our Services, you confirm you meet these requirements. We use geo-blocking technology to restrict access from prohibited jurisdictions. Circumventing these restrictions (via VPN or otherwise) is a breach of these Terms and may result in account termination and forfeiture of funds.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>3. Gaming Services</SectionTitle>

          <SubTitle>3.1 Nature of Games</SubTitle>
          <Paragraph>
            Our games are <strong>games of chance</strong>. Outcomes are random and cannot be predicted or influenced.
          </Paragraph>

          <SubTitle>3.2 Provably Fair</SubTitle>
          <Paragraph>
            All games use a dual-source randomness system combining on-chain VRF (Verifiable Random Function) seeds and backend cryptographic salt. You can verify any game outcome at /[game]/verify. We don't cheat. You can prove it.
          </Paragraph>

          <SubTitle>3.3 House Edge</SubTitle>
          <Paragraph>Our games have the following approximate house edges:</Paragraph>
          <Table>
            <thead>
              <tr>
                <th>Game</th>
                <th>House Edge</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Blackjack</td><td>2.5%</td></tr>
              <tr><td>Mines</td><td>2.5%</td></tr>
              <tr><td>Dice</td><td>2.5%</td></tr>
              <tr><td>Limbo</td><td>2.5%</td></tr>
              <tr><td>HiLo</td><td>2.5%</td></tr>
              <tr><td>Coin Flip</td><td>2.5%</td></tr>
              <tr><td>Spin Wheel</td><td>Variable (see game rules)</td></tr>
            </tbody>
          </Table>

          <SubTitle>3.4 Risk Acknowledgment</SubTitle>
          <Highlight>
            <Paragraph>
              <strong>YOU ACKNOWLEDGE THAT:</strong> You may lose all funds you wager. There is no strategy that guarantees winning. Games are for entertainment, not income. Past results do not predict future outcomes.
            </Paragraph>
          </Highlight>

          <SubTitle>3.5 Responsible Gaming</SubTitle>
          <List>
            <li>Only gamble what you can afford to lose</li>
            <li>Set personal limits on time and money</li>
            <li>If you have a gambling problem, visit <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer">begambleaware.org</a></li>
          </List>
        </Section>

        <Section>
          <SectionTitle>4. NFT Services</SectionTitle>

          <SubTitle>4.1 Ownership</SubTitle>
          <Paragraph>When you own a Monaliens NFT:</Paragraph>
          <List>
            <li>You own the token on the blockchain</li>
            <li>You have a personal license to display the artwork</li>
            <li>You do NOT own the underlying intellectual property unless explicitly stated</li>
          </List>

          <SubTitle>4.2 Staking</SubTitle>
          <List>
            <li>Staking rewards are distributed via smart contract</li>
            <li>Reward rates may change</li>
            <li>Smart contract risks apply (see Section 7)</li>
          </List>

          <SubTitle>4.3 P2P Trading, Auctions & Raffles</SubTitle>
          <List>
            <li>All trades are final and on-chain</li>
            <li>Verify all details before confirming transactions</li>
            <li>We are not responsible for user error or failed transactions</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>5. Your Responsibilities</SectionTitle>
          <Paragraph>You agree NOT to:</Paragraph>
          <List>
            <li>Use bots, hacks, or exploits</li>
            <li>Attempt to manipulate games or markets</li>
            <li>Violate any applicable laws</li>
            <li>Harass other users</li>
            <li>Circumvent geo-restrictions</li>
            <li>Use the platform for money laundering or illegal activities</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>6. Intellectual Property</SectionTitle>
          <Paragraph>
            All content, design, logos, and code are owned by Monaliens. You may not copy, modify, or distribute our content without permission.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>7. Blockchain & Smart Contract Risks</SectionTitle>
          <Highlight>
            <Paragraph><strong>You understand and accept:</strong></Paragraph>
          </Highlight>
          <List>
            <li>Transactions are irreversible</li>
            <li>Smart contracts may contain bugs</li>
            <li>Network issues may affect transactions</li>
            <li>Private key loss = permanent fund loss</li>
            <li>Cryptocurrency values are volatile</li>
            <li>We cannot reverse blockchain transactions</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>8. Disclaimers</SectionTitle>
          <Paragraph>
            THE SERVICES ARE PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.
          </Paragraph>
          <Paragraph>We do not guarantee:</Paragraph>
          <List>
            <li>Uninterrupted service</li>
            <li>Error-free operation</li>
            <li>Any specific outcomes</li>
            <li>Protection from all security threats</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>9. Limitation of Liability</SectionTitle>
          <Paragraph>
            <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong>
          </Paragraph>
          <Paragraph>We are NOT liable for:</Paragraph>
          <List>
            <li>Any losses from using our Services</li>
            <li>Gaming losses</li>
            <li>Smart contract failures</li>
            <li>Third-party actions</li>
            <li>Network issues</li>
            <li>Loss of funds, NFTs, or any digital assets</li>
            <li>Any direct, indirect, incidental, or consequential damages</li>
          </List>
          <Highlight>
            <Paragraph>
              You use the platform entirely at your own risk. We shall not be liable for any damages whatsoever.
            </Paragraph>
          </Highlight>
        </Section>

        <Section>
          <SectionTitle>10. Indemnification</SectionTitle>
          <Paragraph>
            You agree to indemnify and hold harmless Monaliens and its team from any claims arising from your use of the Services or violation of these Terms.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>11. Dispute Resolution</SectionTitle>
          <SubTitle>11.1 Informal Resolution First</SubTitle>
          <Paragraph>Contact us first. We'll try to resolve issues within 30 days.</Paragraph>

          <SubTitle>11.2 Arbitration</SubTitle>
          <Paragraph>
            Unresolved disputes will be settled by binding arbitration under JAMS rules. Arbitration will be conducted in English.
          </Paragraph>

          <SubTitle>11.3 No Class Actions</SubTitle>
          <Paragraph>
            You waive the right to participate in class actions. All disputes must be brought individually.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>12. Changes to Terms</SectionTitle>
          <Paragraph>
            We may update these Terms. Continued use after changes constitutes acceptance. Check this page periodically.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>13. Termination</SectionTitle>
          <Paragraph>
            We may suspend or terminate your access at any time for any reason, including Terms violations.
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>14. Contact</SectionTitle>
          <Paragraph>
            Questions? Contact us at: <strong>monaliensmonad@gmail.com</strong>
          </Paragraph>
        </Section>

        <Section>
          <SectionTitle>15. Governing Law</SectionTitle>
          <Paragraph>
            Any disputes arising from these Terms shall be resolved through binding arbitration in accordance with international arbitration rules.
          </Paragraph>
        </Section>

        <Highlight>
          <Paragraph>
            <strong>By using Monaliens, you acknowledge that you have read, understood, and agree to these Terms of Service.</strong>
          </Paragraph>
        </Highlight>
      </Content>
    </PageContainer>
  );
};

export default TermsPage;
