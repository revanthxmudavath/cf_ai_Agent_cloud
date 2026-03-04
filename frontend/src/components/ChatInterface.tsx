import { useAppStore } from '../stores/appStore';
import { ConnectionStatus } from './ConnectionStatus';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import type { Message, WSMessageType, ConnectionStatus as ConnectionStatusType } from '../types/index';
import { useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ChatInterfaceProps {
  status: ConnectionStatusType;
  sendMessage: (type: WSMessageType, payload: any) => boolean;
  isConnected: boolean;
}

export function ChatInterface({ status, sendMessage, isConnected }: ChatInterfaceProps) {
    const messages = useAppStore((state) => state.messages);
    const addMessage = useAppStore((state) => state.addMessage);
    const isTyping = useAppStore((state) => state.isTyping);
    const setIsTyping = useAppStore((state) => state.setIsTyping);
    const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
    const calendarAuthExpired = useAppStore((state) => state.calendarAuthExpired);
    const setCalendarAuthExpired = useAppStore((state) => state.setCalendarAuthExpired);
    const setIsSettingsOpen = useAppStore((state) => state.setIsSettingsOpen);

    const handleSendMessage = useCallback((content: string) => {
      if (!isConnected) {
        console.warn('[ChatInterface] Cannot send message - not connected');
        return;
      }

      
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      addMessage(userMessage);

     
      sendMessage('chat', { content });


      setIsTyping(true);
    }, [isConnected, sendMessage, addMessage, setIsTyping]);

    return (
    <div className={`flex flex-col h-screen bg-transparent transition-all duration-300 ${
      isSidebarOpen ? 'ml-80' : 'ml-0'
    }`}>
      {/* Header */}
      <div className="glass border-b border-cream-200 px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="animate-slide-in">
            <h1 className="text-2xl font-bold text-navy-900 tracking-tight">AI Assistant</h1>
            <p className="text-sm text-navy-500 font-medium mt-0.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Powered by Cloudflare Workers AI
            </p>
          </div>
          <div className="mr-12 animate-fade-in delay-200">
            <ConnectionStatus status={status} />
          </div>
        </div>
      </div>

      {/* Calendar auth expired banner */}
      {calendarAuthExpired && (
        <div className="animate-slide-in mx-4 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 shadow-sm backdrop-blur-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm font-medium text-amber-900">
            Google Calendar disconnected — your connection token expired.
          </p>
          <button
            onClick={() => { setIsSettingsOpen(true); setCalendarAuthExpired(false); }}
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:bg-amber-700 hover:shadow-md"
          >
            Reconnect →
          </button>
          <button
            onClick={() => setCalendarAuthExpired(false)}
            className="shrink-0 rounded-lg p-1.5 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Messages */}
      <MessageList messages={messages} isTyping={isTyping} />

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={!isConnected}
        placeholder={
          isConnected
            ? "Type a message..."
            : "Connecting to server..."
        }
      />
    </div>
  );
  }
