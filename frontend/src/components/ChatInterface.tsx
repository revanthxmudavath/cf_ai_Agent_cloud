import { useWebSocket } from '../hooks/useWebSocket';
import { useAppStore } from '../stores/appStore';
import { ConnectionStatus } from './ConnectionStatus';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import type { WSMessage, Message } from '../types/index';
import { useTasks } from '../hooks/useTasks';

export function ChatInterface() {
    const userId = useAppStore((state) => state.userId);
    const messages = useAppStore((state) => state.messages);
    const addMessage = useAppStore((state) => state.addMessage);
    const isTyping = useAppStore((state) => state.isTyping);
    const setIsTyping = useAppStore((state) => state.setIsTyping);
    const setPendingConfirmation = useAppStore((state) => state.setPendingConfirmation);
    const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);

    const { fetchTasks } = useTasks(userId);

    const { status, sendMessage, isConnected } = useWebSocket(userId, {
        onMessage: handleWebSocketMessage,
    });

    function handleWebSocketMessage(wsMessage: WSMessage) {
        console.log('[ChatInterface] Received message:', wsMessage.type);

        switch (wsMessage.type) {
            case 'connected':
                console.log('[ChatInterface] Connected as user:', wsMessage.payload.userId);
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
                // Show confirmation dialog (will handle in Step 6)
                console.log('[ChatInterface] Confirmation requested:', wsMessage.payload);
                setPendingConfirmation({
                    requestId: wsMessage.payload.requestId,
                    code: wsMessage.payload.code,
                    toolCalls: wsMessage.payload.toolCalls,
                    expiresAt: Date.now() + wsMessage.payload.timeout,
                });
                setIsTyping(false);
                break;

            
            case 'tool_execution_result':
                // Add tool result as system message
                const resultMessage: Message = {
                    id: crypto.randomUUID(),
                    role: 'system',
                    content: wsMessage.payload.success
                    ? `✅ Tool "${wsMessage.payload.toolName}" executed successfully`
                    : `❌ Tool "${wsMessage.payload.toolName}" failed: ${wsMessage.payload.error}`,
                    timestamp: wsMessage.timestamp,
                };
                addMessage(resultMessage);

                if (wsMessage.payload.success && 
                  ['createTask', 'updateTask', 'completeTask', 'deleteTask'].includes(wsMessage.payload.toolName)) {
                    console.log('[ChatInterface] Refreshing tasks after tool execution');
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

            case 'status':
                console.log('[ChatInterface] Status:', wsMessage.payload.message);
                break;

            default:
                console.warn('[ChatInterface] Unknown message type:', wsMessage.type);
      }
        }


    function handleSendMessage(content: string) {
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
    }

    return (
    <div className={`flex flex-col h-screen bg-gray-50 transition-all duration-300 ${
      isSidebarOpen ? 'ml-80' : 'ml-0'
    }`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AI Assistant</h1>
            <p className="text-sm text-gray-500">Powered by Cloudflare Workers AI</p>
          </div>
          <ConnectionStatus status={status} />
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
