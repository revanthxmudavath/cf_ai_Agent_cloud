import { useAppStore } from '../stores/appStore';
import { ConnectionStatus } from './ConnectionStatus';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import type { Message, WSMessageType, ConnectionStatus as ConnectionStatusType } from '../types/index';
import { useCallback } from 'react';

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
