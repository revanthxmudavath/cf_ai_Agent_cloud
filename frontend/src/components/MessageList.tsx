import { useEffect, useRef } from 'react';
import type { Message } from '../types/index';
import { ROLE_COLORS } from '../types/index';
import { format } from 'date-fns';

interface MessageListProps {
messages: Message[];
isTyping?: boolean;
}

export function MessageList({ messages, isTyping = false }: MessageListProps) {
const messagesEndRef = useRef<HTMLDivElement>(null);

// Auto-scroll to bottom when new messages arrive
useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages, isTyping]);

const visibleMessages = messages.filter((msg) => msg.role !== 'system');

return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
    {visibleMessages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start a conversation with your AI assistant</p>
        </div>
        </div>
    ) : (
        visibleMessages.map((message) => (
        <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
            <div
            className={`max-w-[70%] rounded-lg px-4 py-2 ${ROLE_COLORS[message.role]}`}
            >
            <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-semibold capitalize">
                {message.role}
                </span>
                <span className="text-xs opacity-70">
                {format(message.timestamp, 'HH:mm')}
                </span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
            </p>
            </div>
        </div>
        ))
    )}

    {/* Typing indicator */}
    {isTyping && (
        <div className="flex justify-start">
        <div className="max-w-[70%] rounded-lg px-4 py-2 bg-gray-100">
            <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
        </div>
        </div>
    )}

    {/* Scroll anchor */}
    <div ref={messagesEndRef} />
    </div>
);
}