import { useEffect, useRef, useState, useCallback } from "react";
  import type { WSMessage, WSMessageType, ConnectionStatus } from "../types/index";

  interface UseWebSocketOptions {
      url?: string;
      autoReconnect?: boolean;
      reconnectDelay?: number;
      maxReconnectAttempts?: number;
      getToken?: () => Promise<string | null>;  
      onMessage?: (message: WSMessage) => void;
      onOpen?: () => void;
      onClose?: () => void;
      onError?: (error: Event) => void;
  }

  export function useWebSocket(userId: string | null, options: UseWebSocketOptions = {}) {
      const {
          url = 'ws://localhost:8787/ws',
          autoReconnect = true,
          reconnectDelay = 3000,
          maxReconnectAttempts = 5,
          getToken,  // NEW
          onMessage,
          onOpen,
          onClose,
          onError
      } = options;

      const wsRef = useRef<WebSocket | null>(null);
      const [status, setStatus] = useState<ConnectionStatus>('disconnected');
      const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

      const reconnectAttemptsRef = useRef(0);
      const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      const shouldReconnectRef = useRef(true);

      const sendMessage = useCallback((type: WSMessageType, payload: any) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
              const message: WSMessage = {
                  type,
                  payload,
                  timestamp: Date.now(),
              };
              wsRef.current.send(JSON.stringify(message));
              return true;
          } else {
              console.warn('[WebSocket] Cannot send message - connection not open');
              return false;
          }
      }, []);

      const connect = useCallback(async () => {
          if (!userId) {
              console.warn('[WebSocket] Cannot connect - no userId provided');
              return;
          }

          if (wsRef.current?.readyState === WebSocket.OPEN ||
              wsRef.current?.readyState === WebSocket.CONNECTING) {
              return;
          }

          try {
              setStatus('connecting');

              // Get fresh token for connection
              let token: string | null = null;
              if (getToken) {
                  token = await getToken();
                  if (!token) {
                      console.error('[WebSocket] Failed to get authentication token');
                      setStatus('error');
                      return;
                  }
              }

              // Build WebSocket URL with token (not userId)
              const wsUrl = token
                  ? `${url}?token=${encodeURIComponent(token)}`
                  : `${url}?userId=${encodeURIComponent(userId)}`; // Fallback for legacy

              console.log('[WebSocket] Connecting...');

              const ws = new WebSocket(wsUrl);
              wsRef.current = ws;

              ws.onopen = () => {
                  console.log('[WebSocket] Connected successfully');
                  setStatus('connected');
                  reconnectAttemptsRef.current = 0;
                  onOpen?.();
              };

              ws.onmessage = (event) => {
                  try {
                      const message: WSMessage = JSON.parse(event.data);
                      console.log('[WebSocket] Received:', message.type);
                      setLastMessage(message);
                      onMessage?.(message);
                  } catch (error) {
                      console.error('[WebSocket] Failed to parse message:', error);
                  }
              };

              ws.onclose = (event) => {
                  console.log('[WebSocket] Connection closed:', event.code, event.reason);
                  setStatus('disconnected');
                  wsRef.current = null;
                  onClose?.();

                  if (autoReconnect && shouldReconnectRef.current) {
                      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                          reconnectAttemptsRef.current += 1;
                          setStatus('reconnecting');

                          console.log(
                              `[WebSocket] Reconnecting in ${reconnectDelay}ms... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
                          );

                          reconnectTimeoutRef.current = setTimeout(() => {
                              connect();
                          }, reconnectDelay);
                      } else {
                          console.error('[WebSocket] Max reconnect attempts reached');
                          setStatus('error');
                      }
                  }
              };

              ws.onerror = (error) => {
                  console.error('[WebSocket] Error:', error);
                  setStatus('error');
                  onError?.(error);
              };
          } catch (error) {
              console.error('[WebSocket] Failed to connect:', error);
              setStatus('error');
          }
      }, [userId, url, autoReconnect, reconnectDelay, maxReconnectAttempts, getToken, onMessage, onOpen, onClose, onError]);

      const disconnect = useCallback(() => {
          console.log('[WebSocket] Disconnecting...');
          shouldReconnectRef.current = false;

          if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = null;
          }

          if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
          }

          setStatus('disconnected');
      }, []);

      const reconnect = useCallback(() => {
          disconnect();
          shouldReconnectRef.current = true;
          reconnectAttemptsRef.current = 0;
          setTimeout(() => connect(), 100);
      }, [connect, disconnect]);

      useEffect(() => {
          if (userId) {
              shouldReconnectRef.current = true;
              connect();
          }

          return () => {
              shouldReconnectRef.current = false;
              if (reconnectTimeoutRef.current) {
                  clearTimeout(reconnectTimeoutRef.current);
              }
              if (wsRef.current) {
                  wsRef.current.close();
              }
          };
      }, [userId, connect]);

      return {
          status,
          lastMessage,
          sendMessage,
          disconnect,
          reconnect,
          isConnected: status === 'connected',
      };
  }