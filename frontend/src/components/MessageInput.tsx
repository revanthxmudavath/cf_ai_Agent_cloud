import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
onSendMessage: (content: string) => void;
disabled?: boolean;
placeholder?: string;
}

export function MessageInput({ 
onSendMessage, 
disabled = false,
placeholder = "Type a message..." 
}: MessageInputProps) {
const [input, setInput] = useState('');

const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
    onSendMessage(trimmed);
    setInput('');
    }
};

const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
    }
};

return (
    <div className="border-t border-gray-200 p-4 bg-white">
    <div className="flex gap-2">
        <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100
disabled:cursor-not-allowed"
        style={{ minHeight: '40px', maxHeight: '120px' }}
        />
        <button
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        className="flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-300 
disabled:cursor-not-allowed transition-colors"
        >
        <Send className="h-5 w-5" />
        </button>
    </div>
    </div>
);
}