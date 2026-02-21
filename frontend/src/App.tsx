import { useEffect, useCallback } from 'react';
import {
SignedIn, SignedOut, SignInButton, useAuth, useUser } from '@clerk/clerk-react';
import { useAppStore } from './stores/appStore';
import { ChatInterface } from './components/ChatInterface';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { TaskPanel } from './components/TaskPanel';
import { useWebSocket } from './hooks/useWebSocket';
import type { WSMessage, Message } from './types/index';
import { useTasks } from './hooks/useTasks';
import { SettingsPanel } from './components/SettingsPanel';


function AuthenticatedApp() {
const { getToken } = useAuth();
const { user } = useUser();

const setUserId = useAppStore((state) => state.setUserId);
const setUserProfile = useAppStore((state) => state.setUserProfile);
const userId = useAppStore((state) => state.userId);
const addMessage = useAppStore((state) => state.addMessage);
const setIsTyping = useAppStore((state) => state.setIsTyping);
const setPendingConfirmation = useAppStore((state) => state.setPendingConfirmation);

const { fetchTasks } = useTasks(userId);

useEffect(() => {
  async function initializeUser() {
    try {
      const token = await getToken();
      if (!token) return;

      // Fetch user profile
      const response = await fetch('http://localhost:5173/api/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
        setUserId(profile.id);
        console.log('[App] User authenticated:', profile.id);
        }
      } catch (error) {
        console.error('[App] Failed to fetch user profile:', error);
      }
    }

    if (user) {
      initializeUser();
    }
  }, [user, getToken, setUserId, setUserProfile]);

  // Get fresh token for WebSocket connection
  const getWebSocketToken = useCallback(async () => {
    const token = await getToken();
    return token;
  }, [getToken]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((wsMessage: WSMessage) => {
    console.log('[App] Received message:', wsMessage.type);

    switch (wsMessage.type) {
      case 'connected':
        console.log('[App] Connected as user:', wsMessage.payload.userId);
        break;

      case 'chat_response':
        const assistantMessage: Message = {
          id: wsMessage.payload.messageId || crypto.randomUUID(),
          role: 'assistant',
          content: wsMessage.payload.content,
          timestamp: wsMessage.timestamp,
        };
        addMessage(assistantMessage);
        setIsTyping(false);
        break;

      case 'confirmation_request':
        setPendingConfirmation({
          requestId: wsMessage.payload.requestId,
          code: wsMessage.payload.code,
          toolCalls: wsMessage.payload.toolCalls,
          expiresAt: Date.now() + wsMessage.payload.timeout,
        });
        setIsTyping(false);
        break;

      case 'tool_execution_result':
        if (wsMessage.payload.success &&
          ['createTask', 'updateTask', 'completeTask', 'deleteTask'].includes(wsMessage.payload.toolName)) {
          fetchTasks();
        }
        break;

      case 'error':
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'system',
          content: `Error: ${wsMessage.payload.message}`,
          timestamp: wsMessage.timestamp,
        };
        addMessage(errorMessage);
        setIsTyping(false);
        break;

      default:
        console.warn('[App] Unknown message type:', wsMessage.type);
    }
  }, [addMessage, setIsTyping, setPendingConfirmation, fetchTasks]);

  // WebSocket with token-based auth
  const { status, sendMessage, isConnected } = useWebSocket(userId, {
    url: 'ws://localhost:8787/ws',
    getToken: getWebSocketToken,
    onMessage: handleWebSocketMessage,
  });

  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-br from-cream-50 via-white to-cream-100 animate-fade-in">
      <TaskPanel sendMessage={sendMessage} isConnected={isConnected} />
      <div className="flex-1 flex flex-col">
        <ChatInterface
          status={status}
          sendMessage={sendMessage}
          isConnected={isConnected}
        />
      </div>
      <ConfirmationDialog sendMessage={sendMessage} />
      <SettingsPanel />
    </div>
  );
}

function App() {
  return (
    <>
      <SignedOut>
        <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-cream-50 via-white to-indigo-50">
          {/* Animated gradient orbs */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-indigo-200/40 to-amber-200/40 rounded-full blur-3xl animate-pulse"
               style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-amber-200/30 to-indigo-200/30 rounded-full blur-3xl animate-pulse"
               style={{ animationDuration: '10s', animationDelay: '2s' }} />

          {/* Main content */}
          <div className="relative z-10 text-center px-6 animate-slide-up">
            {/* Logo/Icon */}
            <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-2xl shadow-indigo-500/50 animate-fade-in">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>

            {/* Heading */}
            <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight animate-slide-up delay-100">
              <span className="text-gradient">AI Personal Assistant</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-navy-600 mb-12 max-w-md mx-auto font-light tracking-wide animate-slide-up delay-200">
              Your intelligent companion for tasks, calendars, and seamless productivity
            </p>

            {/* Sign in button */}
            <div className="animate-slide-up delay-300">
              <SignInButton mode="modal">
                <button className="btn-primary group">
                  <span className="relative z-10 flex items-center gap-2">
                    Sign In to Continue
                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </button>
              </SignInButton>
            </div>

            {/* Feature badges */}
            <div className="mt-16 flex flex-wrap gap-4 justify-center items-center text-sm text-navy-600 animate-fade-in delay-400">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Powered by Cloudflare AI</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-sm">
                <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>Secure & Private</span>
              </div>
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
    </>
  );
}

export default App;