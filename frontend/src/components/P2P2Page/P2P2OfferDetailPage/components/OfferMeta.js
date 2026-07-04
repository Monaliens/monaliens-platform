import React, { useEffect, useState } from 'react';
import { MetaTags, MetaRow, MetaPill } from '../styles';
import {
  buildExplorerLink,
  formatDateTime,
  formatRelativeDeadline,
  shortenAddress
} from '../utils/formatters';

const OfferMeta = ({ offer, offerType }) => {
  const [deadlineLabel, setDeadlineLabel] = useState('No deadline');

  useEffect(() => {
    if (!offer?.deadline) {
      setDeadlineLabel('No deadline');
      return undefined;
    }

    const updateLabel = () => {
      setDeadlineLabel(formatRelativeDeadline(offer.deadline));
    };

    updateLabel();

    const intervalId = setInterval(updateLabel, 60000);

    return () => clearInterval(intervalId);
  }, [offer?.deadline]);

  if (!offer) return null;

  // Map status number to string
  const getStatusString = () => {
    if (offer.statusString) return offer.statusString;
    if (offer.status === 1) return 'ACTIVE';
    if (offer.status === 2) return 'ACCEPTED';
    if (offer.status === 3) return 'CANCELLED';
    if (offer.status === 4) return 'EXPIRED';
    return '—';
  };

  const statusString = getStatusString();
  const statusColorMap = {
    ACTIVE: '#16a34a',
    ACCEPTED: '#16a34a',
    CANCELLED: '#dc2626',
    EXPIRED: '#dc2626',
    REJECTED: '#dc2626',
    PENDING: '#f97316'
  };
  const statusColor = statusColorMap[statusString] || '#64748b';

  // Show "-" for ended offers (CANCELLED, EXPIRED, ACCEPTED)
  const shouldShowDeadline = statusString === 'ACTIVE' || statusString === 'PENDING';
  const displayDeadline = shouldShowDeadline ? deadlineLabel : '—';

  return (
    <MetaTags>
      <MetaRow>
        <MetaPill>
          <span style={{ fontWeight: 600, color: '#1f2937' }}>Status:</span>
          <span style={{ fontWeight: 700, color: statusColor }}>{statusString}</span>
        </MetaPill>

        <MetaPill>
          <span style={{ fontWeight: 600, color: '#1f2937' }}>Expires in:</span>
          <span style={{ fontWeight: 500, color: '#000000' }}>{displayDeadline}</span>
        </MetaPill>
      </MetaRow>

      <MetaRow>
        <MetaPill>
          <span style={{ fontWeight: 600, color: '#1f2937' }}>Created:</span>
          <span style={{ fontWeight: 500, color: '#000000' }}>{formatDateTime(offer.createdAt)}</span>
        </MetaPill>

        <MetaPill>
          <span style={{ fontWeight: 600, color: '#1f2937' }}>Maker:</span>
          {offer.maker ? (
            <a href={buildExplorerLink(offer.maker)} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
              {shortenAddress(offer.maker)}
            </a>
          ) : (
            <span style={{ fontWeight: 500, color: '#64748b' }}>Unknown</span>
          )}
        </MetaPill>

        <MetaPill>
          <span style={{ fontWeight: 600, color: '#1f2937' }}>Contract:</span>
          {offer.contractAddress ? (
            <a href={buildExplorerLink(offer.contractAddress)} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
              {shortenAddress(offer.contractAddress)}
            </a>
          ) : (
            <span style={{ fontWeight: 500, color: '#64748b' }}>Unknown</span>
          )}
        </MetaPill>
      </MetaRow>
    </MetaTags>
  );
};

export default OfferMeta;
