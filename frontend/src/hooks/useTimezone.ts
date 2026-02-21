import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

/**
 * Auto-detect and save user's timezone to backend
 * Runs once on mount if timezone hasn't been saved yet
 */
export function useTimezone() {
  const { getToken } = useAuth();

  useEffect(() => {
    const detectAndSaveTimezone = async () => {
      try {
        // Get browser's timezone using Intl API
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Check if we've already saved this timezone (avoid unnecessary API calls)
        const savedTimezone = localStorage.getItem('user_timezone');
        if (savedTimezone === timezone) {
          return; // Already saved, skip API call
        }

        // Save to backend
        const token = await getToken();
        const response = await fetch('/api/me/timezone', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ timezone }),
        });

        if (response.ok) {
          localStorage.setItem('user_timezone', timezone);
          console.log(`[Timezone] Saved user timezone: ${timezone}`);
        } else {
          console.error('[Timezone] Failed to save timezone:', await response.text());
        }
      } catch (error) {
        console.error('[Timezone] Error detecting/saving timezone:', error);
      }
    };

    detectAndSaveTimezone();
  }, [getToken]);
}
