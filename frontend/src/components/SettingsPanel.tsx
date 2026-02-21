import { useState } from 'react';
import { useAuth, useClerk, UserButton } from '@clerk/clerk-react';
import { Calendar, Check, X, Settings, Loader2, LogOut, AlertCircle } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import Nango from '@nangohq/frontend';

export function SettingsPanel() {
    const { getToken } = useAuth();
    const { signOut } = useClerk();
    const userProfile = useAppStore((state) => state.userProfile);
    const setUserProfile = useAppStore((state) => state.setUserProfile);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isCalendarConnected = userProfile?.google_calendar_connected;

    const handleConnectCalendar = async () => {
        try {
            setIsConnecting(true);
            setError(null);
            const token = await getToken();

            if (!token) {
                setError('Authentication token not found');
                setIsConnecting(false);
                return;
            }

            // Get connect session token from backend
            const response = await fetch('/api/integrations/google-calendar/connect', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = typeof errorData.error === 'string'
                    ? errorData.error
                    : (errorData.message || errorData.details || 'Failed to create connection session');
                throw new Error(errorMessage);
            }

            const { token: sessionToken } = await response.json();

            // Initialize Nango SDK
            const nango = new Nango({ connectSessionToken: sessionToken });

            // Open Nango Connect UI with event handler
            nango.openConnectUI({
                onEvent: async (event) => {
                    console.log('[Nango SDK] Event received:', event);

                    if (event.type === 'connect' && event.payload?.connectionId) {
                        const connectionId = event.payload.connectionId;
                        console.log('[Nango SDK] Connection successful:', connectionId);

                        try {
                            // Send connectionId to backend to store
                            const callbackResponse = await fetch('/api/integrations/google-calendar/callback', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ connectionId }),
                            });

                            if (callbackResponse.ok) {
                                console.log('[Nango SDK] Connection stored in database');
                                // Update local profile state
                                if (userProfile) {
                                    setUserProfile({
                                        ...userProfile,
                                        google_calendar_connected: true,
                                    });
                                }
                                setIsConnecting(false);
                            } else {
                                console.error('[Nango SDK] Failed to store connection');
                                setError('Failed to save calendar connection');
                                setIsConnecting(false);
                            }
                        } catch (error) {
                            console.error('[Nango SDK] Error storing connection:', error);
                            setError('Failed to save calendar connection');
                            setIsConnecting(false);
                        }
                    } else if (event.type === 'close') {
                        // User closed the popup without completing OAuth
                        console.log('[Nango SDK] Connect UI closed');
                        setIsConnecting(false);
                    }
                },
            });
        } catch (error: any) {
            console.error('Failed to initiate calendar connection:', error);
            setError(error.message || 'Failed to connect calendar');
            setIsConnecting(false);
        }
    };

    const handleDisconnectCalendar = async () => {
        try {
            setIsConnecting(true);
            setError(null);
            const token = await getToken();

            // Use relative URL
            await fetch('/api/integrations/google-calendar/disconnect', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            // Update local profile state
            if (userProfile) {
                setUserProfile({
                    ...userProfile,
                    google_calendar_connected: false,
                });
            }

            setIsConnecting(false);
        } catch (error: any) {
            console.error('Failed to disconnect calendar:', error);
            setError(error.message || 'Failed to disconnect calendar');
            setIsConnecting(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            window.location.href = '/';
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    };

    // Don't check on mount - only check after manual connection attempt or disconnect
    // This prevents API spam and rate limiting

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed top-6 right-6 p-3 glass rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 z-50 group"
                aria-label="Open settings"
            >
                <Settings className="w-5 h-5 text-navy-700 group-hover:rotate-90 transition-transform duration-300" />
            </button>
        );
    }

    return (
        <div className="fixed top-6 right-6 w-96 card-elevated border border-cream-200 p-6 z-50 animate-slide-in">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-navy-900 tracking-tight">Settings</h3>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-navy-400 hover:text-navy-700 hover:bg-cream-100 p-2 rounded-lg transition-all duration-200"
                    aria-label="Close settings"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* User Profile */}
            <div className="mb-6 pb-6 border-b border-cream-200">
                <div className="flex items-center gap-3 mb-4 p-3 bg-gradient-to-br from-cream-50 to-white rounded-xl border border-cream-100">
                    <UserButton />
                    <div className="flex-1">
                        <p className="font-semibold text-navy-900">{userProfile?.name || 'User'}</p>
                        <p className="text-sm text-navy-500">{userProfile?.email || ''}</p>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-200 transition-all duration-200"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>

            {/* Google Calendar Integration */}
            <div className="space-y-4">
                <h4 className="text-sm font-semibold text-navy-700 uppercase tracking-wider">Integrations</h4>

                {/* Error Message */}
                {error && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl animate-slide-up">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                )}

                <div className="p-5 bg-gradient-to-br from-cream-50 to-white rounded-xl border border-cream-200 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-xl shadow-sm">
                                <Calendar className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-navy-900">Google Calendar</p>
                                <p className="text-xs text-navy-500 mt-0.5">
                                    {isCalendarConnected ? (
                                        <span className="flex items-center gap-1.5 text-green-600 font-medium">
                                            <Check className="w-3.5 h-3.5" />
                                            Connected
                                        </span>
                                    ) : (
                                        'Not connected'
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {isConnecting ? (
                            <button
                                disabled
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-cream-100 text-navy-400 rounded-xl cursor-not-allowed border border-cream-200"
                            >
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Connecting...
                            </button>
                        ) : isCalendarConnected ? (
                            <button
                                onClick={handleDisconnectCalendar}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-xl transition-all duration-200"
                            >
                                Disconnect
                            </button>
                        ) : (
                            <button
                                onClick={handleConnectCalendar}
                                className="flex-1 px-4 py-2.5 text-sm bg-gradient-to-br from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 rounded-xl transition-all duration-200 font-semibold shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40"
                            >
                                Connect Calendar
                            </button>
                        )}
                    </div>

                    {!isCalendarConnected && (
                        <p className="text-xs text-navy-500 leading-relaxed">
                            Connect your Google Calendar to create and manage events directly from chat.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}