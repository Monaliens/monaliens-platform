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

const normalizeId = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const extractOffers = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.offers)) return payload.offers;
  if (Array.isArray(payload?.counterOffers)) return payload.counterOffers;
  if (Array.isArray(payload?.data?.counterOffers)) return payload.data.counterOffers;
  return [];
};

const useOfferChildren = (offerId, options = {}) => {
  const { enabled = true } = options;
  const normalizedId = useMemo(() => normalizeId(offerId), [offerId]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchChildren = useCallback(async () => {
    if (!normalizedId || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await client.get(`/offers/${normalizedId}/children`);
      if (data?.success === false) {
        throw new Error(data?.error || 'Failed to load counter offers');
      }

      const nextOffers = extractOffers(data?.data ?? data);
      setOffers(Array.isArray(nextOffers) ? nextOffers : []);
    } catch (err) {
      setError(err?.message || 'Failed to load counter offers');
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [normalizedId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (normalizedId) {
      fetchChildren();
    }
  }, [fetchChildren, normalizedId, enabled]);

  useEffect(() => {
    if (!normalizedId) {
      setOffers([]);
    }
  }, [normalizedId]);

  return {
    offers,
    loading,
    error,
    refresh: fetchChildren
  };
};

export default useOfferChildren;
