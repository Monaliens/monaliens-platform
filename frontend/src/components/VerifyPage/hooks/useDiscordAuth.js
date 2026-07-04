import { useState, useEffect, useCallback } from 'react';
import { fetchDiscordUser } from '../utils/api';

const STORAGE_KEY = 'discord_auth';

/**
 * Custom hook for Discord OAuth authentication
 * Handles Discord user data fetching and token management
 * Persists auth to localStorage for returning users
 *
 * @returns {Object} Discord auth state and user data
 */
export const useDiscordAuth = () => {
  const [discordUser, setDiscordUser] = useState({});
  const [discordToken, setDiscordToken] = useState('');
  const [displayName, setDisplayName] = useState('Invalid');
  const [username, setUsername] = useState('');
  const [displayImage, setDisplayImage] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authenticateUser = async () => {
      try {
        // 1. Check URL hash for new OAuth callback
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = fragment.get('access_token');
        const tokenType = fragment.get('token_type');

        if (accessToken) {
          // New OAuth login - fetch user and save to localStorage
          const userData = await fetchDiscordUser(accessToken, tokenType);
          const token = `${tokenType} ${accessToken}`;

          setDiscordUser(userData);
          setDiscordToken(token);

          // Save to localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            user: userData,
            token: token,
            savedAt: Date.now(),
          }));

          // Clear URL hash
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }

        // 2. No URL token - check localStorage
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const { token } = JSON.parse(saved);

          // Verify token is still valid by fetching user
          try {
            const tokenParts = token.split(' ');
            const userData = await fetchDiscordUser(tokenParts[1], tokenParts[0]);

            // Token valid - use refreshed user data
            setDiscordUser(userData);
            setDiscordToken(token);

            // Update localStorage with fresh user data
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
              user: userData,
              token: token,
              savedAt: Date.now(),
            }));
          } catch (err) {
            // Token expired or invalid - clear localStorage
            console.log('Stored token expired, clearing...');
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Discord authentication error:', error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    authenticateUser();
  }, []);

  // Logout function - clears localStorage and state
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDiscordUser({});
    setDiscordToken('');
    setDisplayName('Invalid');
    setUsername('');
    setDisplayImage('');
    setBannerImage('');
  }, []);

  // Update display name and image when user data changes
  useEffect(() => {
    if (discordUser.username) {
      // Use global_name if available, otherwise username
      const globalName = discordUser.global_name || discordUser.username;
      setDisplayName(globalName);
      setUsername(discordUser.username);

      // Set Discord avatar URL
      setDisplayImage(
        `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}`
      );

      // Set Discord banner URL (if exists)
      if (discordUser.banner) {
        const isAnimated = discordUser.banner.startsWith('a_');
        const extension = isAnimated ? 'gif' : 'png';
        setBannerImage(
          `https://cdn.discordapp.com/banners/${discordUser.id}/${discordUser.banner}.${extension}?size=600`
        );
      }

    }
  }, [discordUser]);

  return {
    discordUser,
    discordToken,
    displayName,
    username,
    displayImage,
    bannerImage,
    isAuthenticated: !!discordUser.id,
    isLoading,
    logout,
  };
};
