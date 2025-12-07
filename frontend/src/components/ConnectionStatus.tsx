import type { ConnectionStatus as ConnectionStatusType } from '../types/index';

interface ConnectionStatusProps {
status: ConnectionStatusType;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
const statusConfig = {
    connected: {
    color: 'bg-green-500',
    text: 'Connected',
    pulse: false,
    },
    connecting: {
    color: 'bg-yellow-500',
    text: 'Connecting...',
    pulse: true,
    },
    reconnecting: {
    color: 'bg-orange-500',
    text: 'Reconnecting...',
    pulse: true,
    },
    disconnected: {
    color: 'bg-gray-400',
    text: 'Disconnected',
    pulse: false,
    },
    error: {
    color: 'bg-red-500',
    text: 'Connection Error',
    pulse: false,
    },
};

const config = statusConfig[status];

return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
    <div className="relative">
        <div className={`h-2 w-2 rounded-full ${config.color}`} />
        {config.pulse && (
        <div className={`absolute inset-0 h-2 w-2 rounded-full ${config.color} animate-ping opacity-75`} />
        )}
    </div>
    <span>{config.text}</span>
    </div>
);
}