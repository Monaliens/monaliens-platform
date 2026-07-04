import { useState, useEffect, useCallback } from 'react';
import {
  getReferralCode,
  createCustomReferralCode,
  applyReferralCode,
  getReferralStats,
  getReferralUsage,
} from '../utils/api';

/**
 * Custom hook for referral system management
 * Handles referral code generation, custom codes, applying codes, and stats
 *
 * @param {Object} discordUser - Discord user object with id
 * @param {string} discordToken - Discord authorization token
 * @returns {Object} Referral state and actions
 */
export const useReferral = (discordUser, discordToken) => {
  // Referral code state
  const [referralCode, setReferralCode] = useState('');
  const [isCustomCode, setIsCustomCode] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(true);

  // Usage state (has this user used someone else's code?)
  const [hasUsedReferral, setHasUsedReferral] = useState(false);
  const [usedCode, setUsedCode] = useState(null);
  const [usedAt, setUsedAt] = useState(null);

  // Stats state
  const [stats, setStats] = useState({
    totalReferrals: 0,
    referrals: [],
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Action states
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [error, setError] = useState(null);

  const userId = discordUser?.id;

  // Fetch referral code on mount
  useEffect(() => {
    const fetchCode = async () => {
      if (!userId || !discordToken) {
        setIsLoadingCode(false);
        return;
      }

      try {
        setIsLoadingCode(true);
        const data = await getReferralCode(userId, discordToken);
        if (data.success) {
          setReferralCode(data.referralCode);
          setIsCustomCode(data.isCustom || false);
        }
      } catch (err) {
        console.error('Failed to fetch referral code:', err);
        setError(err.message);
      } finally {
        setIsLoadingCode(false);
      }
    };

    fetchCode();
  }, [userId, discordToken]);

  // Fetch usage status on mount
  useEffect(() => {
    const fetchUsage = async () => {
      if (!userId || !discordToken) return;

      try {
        const data = await getReferralUsage(userId, discordToken);
        if (data.success) {
          setHasUsedReferral(data.hasUsedReferral || false);
          setUsedCode(data.usedCode || null);
          setUsedAt(data.usedAt || null);
        }
      } catch (err) {
        console.error('Failed to fetch referral usage:', err);
      }
    };

    fetchUsage();
  }, [userId, discordToken]);

  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      if (!userId || !discordToken) {
        setIsLoadingStats(false);
        return;
      }

      try {
        setIsLoadingStats(true);
        const data = await getReferralStats(userId, discordToken);
        if (data.success) {
          setStats({
            totalReferrals: data.totalReferrals || 0,
            referrals: data.referrals || [],
          });
          // Also update code info from stats if available
          if (data.referralCode) {
            setReferralCode(data.referralCode);
            setIsCustomCode(data.isCustom || false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch referral stats:', err);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, [userId, discordToken]);

  // Create custom code
  const createCustomCode = useCallback(async (customCode) => {
    if (!userId || !discordToken) {
      throw new Error('Not authenticated');
    }

    setIsCreatingCustom(true);
    setError(null);

    try {
      const data = await createCustomReferralCode(userId, customCode, discordToken);
      setReferralCode(data.referralCode);
      setIsCustomCode(true);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsCreatingCustom(false);
    }
  }, [userId, discordToken]);

  // Apply referral code
  const applyCode = useCallback(async (code) => {
    if (!userId || !discordToken) {
      throw new Error('Not authenticated');
    }

    if (hasUsedReferral) {
      throw new Error('You have already used a referral code');
    }

    setIsApplyingCode(true);
    setError(null);

    try {
      const data = await applyReferralCode(userId, code, discordUser, discordToken);
      setHasUsedReferral(true);
      setUsedCode(code);
      setUsedAt(new Date().toISOString());
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsApplyingCode(false);
    }
  }, [userId, discordUser, discordToken, hasUsedReferral]);

  // Refresh stats
  const refreshStats = useCallback(async () => {
    if (!userId || !discordToken) return;

    try {
      setIsLoadingStats(true);
      const data = await getReferralStats(userId, discordToken);
      if (data.success) {
        setStats({
          totalReferrals: data.totalReferrals || 0,
          referrals: data.referrals || [],
        });
      }
    } catch (err) {
      console.error('Failed to refresh stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [userId, discordToken]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Code
    referralCode,
    isCustomCode,
    isLoadingCode,

    // Usage
    hasUsedReferral,
    usedCode,
    usedAt,

    // Stats
    stats,
    isLoadingStats,

    // Actions
    createCustomCode,
    applyCode,
    refreshStats,
    clearError,

    // Action states
    isCreatingCustom,
    isApplyingCode,
    error,
  };
};
