import styled from 'styled-components';

export const PrefillProgressWrapper = styled.div`
  flex-basis: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  margin: 12px 0 16px;
`;

export const PrefillProgressCard = styled.div`
  width: 100%;
  max-width: 860px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 18px 24px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(99, 102, 241, 0.18);
  box-shadow: 0 18px 36px rgba(99, 102, 241, 0.18);
`;

export const PrefillProgressStep = styled.div`
  flex: 1;
  min-width: 180px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  opacity: ${(props) => (props.$state === 'pending' ? 0.45 : 1)};
  color: ${(props) => {
    if (props.$state === 'error') return '#991b1b';
    if (props.$step === 'complete') {
      if (props.$state === 'done') return '#4c1d95';
      if (props.$state === 'active') return '#4c1d95';
    }
    if (props.$state === 'done') return '#047857';
    if (props.$state === 'active') return '#312e81';
    return '#475569';
  }};
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: ${(props) => (props.$state === 'active' ? 'translateY(-2px)' : 'none')};
`;

export const PrefillProgressBullet = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  background: ${(props) => {
    if (props.$state === 'error') return 'rgba(239, 68, 68, 0.24)';
    if (props.$step === 'complete') {
      if (props.$state === 'done') return 'rgba(124, 58, 237, 0.22)';
      if (props.$state === 'active') return 'rgba(124, 58, 237, 0.28)';
    }
    if (props.$state === 'done') return 'rgba(34, 197, 94, 0.2)';
    if (props.$state === 'active') return 'rgba(99, 102, 241, 0.24)';
    return 'rgba(148, 163, 184, 0.18)';
  }};
  color: ${(props) => {
    if (props.$state === 'error') return '#991b1b';
    if (props.$step === 'complete') {
      if (props.$state === 'done') return '#4c1d95';
      if (props.$state === 'active') return '#4c1d95';
    }
    if (props.$state === 'done') return '#047857';
    if (props.$state === 'active') return '#4338ca';
    return '#475569';
  }};
`;

export const PrefillProgressText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const PrefillProgressTitle = styled.span`
  font-size: 14px;
  font-weight: 600;
`;

export const PrefillProgressSubtitle = styled.span`
  font-size: 12px;
  color: rgba(71, 85, 105, 0.85);
`;
