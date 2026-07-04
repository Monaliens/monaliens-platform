import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'https://api.monaliens.xyz/api/p2p';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

const useP2P2Offer = (offerId, options = {}) => {
  const { skipIfMissing = false } = options;
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(Boolean(offerId));
  const [error, setError] = useState(null);

  const normalizedId = useMemo(() => {
    if (!offerId) return null;
    const trimmed = String(offerId).trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [offerId]);

  const fetchOffer = useCallback(async () => {
    if (!normalizedId) {
      if (skipIfMissing) {
        setOffer(null);
        setError(null);
        setLoading(false);
        return;
      }

      setError('Missing offer id');
      setOffer(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await client.get(`/offers/${normalizedId}`);

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch offer');
      }

      setOffer(data.data || null);
    } catch (err) {
      setError(err?.message || 'Failed to load offer');
      setOffer(null);
    } finally {
      setLoading(false);
    }
  }, [normalizedId, skipIfMissing]);

  useEffect(() => {
    if (skipIfMissing && !normalizedId) {
      return;
    }
    fetchOffer();
  }, [fetchOffer, skipIfMissing, normalizedId]);

  return {
    offer,
    loading,
    error,
    refresh: fetchOffer
  };
};

export default useP2P2Offer;
