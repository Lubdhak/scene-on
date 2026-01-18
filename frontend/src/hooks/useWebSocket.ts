// WebSocket hook for real-time chat updates with automatic reconnection
import { useEffect, useRef, useCallback, useState } from 'react';

interface WSMessage {
    type: string;
    data: Record<string, any>;
}

type MessageHandler = (data: Record<string, any>) => void;

const getWsUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    if (apiUrl.startsWith('https')) {
        return apiUrl.replace('https', 'wss') + '/ws';
    }
    return apiUrl.replace('http', 'ws') + '/ws';
};

const WS_BASE_URL = getWsUrl();

// Connection states for better visibility
export enum ConnectionState {
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    RECONNECTING = 'reconnecting',
    FAILED = 'failed'
}

// Reconnection configuration
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 10;
const PING_INTERVAL = 25000; // 25 seconds (less than server's 54s ping period)

export const useWebSocket = (sceneId?: string | null) => {
    const ws = useRef<WebSocket | null>(null);
    const handlers = useRef<Map<string, MessageHandler[]>>(new Map());
    const reconnectTimeout = useRef<NodeJS.Timeout>();
    const pingInterval = useRef<NodeJS.Timeout>();
    const retryCount = useRef(0);
    const shouldReconnect = useRef(true);
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
    
    // Track connection quality
    const lastPongTime = useRef<number>(Date.now());
    const missedPongs = useRef(0);

    const cleanup = useCallback(() => {
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = undefined;
        }
        if (pingInterval.current) {
            clearInterval(pingInterval.current);
            pingInterval.current = undefined;
        }
    }, []);

    const startPingInterval = useCallback(() => {
        cleanup();
        pingInterval.current = setInterval(() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
                const timeSinceLastPong = Date.now() - lastPongTime.current;
                
                // If we haven't received a pong in a while, consider connection stale
                if (timeSinceLastPong > 70000) { // 70 seconds (server timeout is 60s)
                    console.warn('⚠️ Connection appears stale, forcing reconnect');
                    missedPongs.current++;
                    if (missedPongs.current > 2) {
                        ws.current?.close();
                        return;
                    }
                }
                
                try {
                    ws.current.send(JSON.stringify({ type: 'ping', data: {} }));
                } catch (error) {
                    console.error('❌ Failed to send ping:', error);
                }
            }
        }, PING_INTERVAL);
    }, [cleanup]);

    const getReconnectDelay = useCallback(() => {
        // Exponential backoff with jitter
        const delay = Math.min(
            INITIAL_RETRY_DELAY * Math.pow(2, retryCount.current),
            MAX_RETRY_DELAY
        );
        // Add random jitter (±20%)
        const jitter = delay * 0.2 * (Math.random() - 0.5);
        return Math.floor(delay + jitter);
    }, []);

    const connect = useCallback(() => {
        // Don't attempt if we're already connected or connecting
        if (ws.current?.readyState === WebSocket.OPEN || 
            ws.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        // Check if we've exceeded max retries
        if (retryCount.current >= MAX_RETRY_ATTEMPTS) {
            console.error('❌ Max reconnection attempts reached');
            setConnectionState(ConnectionState.FAILED);
            return;
        }

        const url = sceneId ? `${WS_BASE_URL}?scene_id=${sceneId}` : WS_BASE_URL;
        
        const isReconnecting = retryCount.current > 0;
        setConnectionState(isReconnecting ? ConnectionState.RECONNECTING : ConnectionState.CONNECTING);
        
        console.log(`🔌 ${isReconnecting ? 'Reconnecting' : 'Connecting'} to WebSocket: ${url} (attempt ${retryCount.current + 1})`);
        
        try {
            ws.current = new WebSocket(url);

            ws.current.onopen = () => {
                console.log('✅ WebSocket connected');
                setConnectionState(ConnectionState.CONNECTED);
                retryCount.current = 0; // Reset retry count on successful connection
                missedPongs.current = 0;
                lastPongTime.current = Date.now();
                startPingInterval();
            };

            ws.current.onmessage = (event) => {
                try {
                    const message: WSMessage = JSON.parse(event.data);
                    
                    // Handle pong messages
                    if (message.type === 'pong') {
                        lastPongTime.current = Date.now();
                        missedPongs.current = 0;
                        return;
                    }
                    
                    console.log('📥 WS Message:', message.type, message.data);
                    
                    const messageHandlers = handlers.current.get(message.type);
                    if (messageHandlers) {
                        messageHandlers.forEach(handler => {
                            try {
                                handler(message.data);
                            } catch (error) {
                                console.error(`❌ Error in message handler for ${message.type}:`, error);
                            }
                        });
                    }
                } catch (error) {
                    console.error('❌ Failed to parse WebSocket message:', error);
                }
            };

            ws.current.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };

            ws.current.onclose = (event) => {
                console.log(`🔌 WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
                setConnectionState(ConnectionState.DISCONNECTED);
                cleanup();
                
                // Only reconnect if it's expected and we haven't exceeded max attempts
                if (shouldReconnect.current && retryCount.current < MAX_RETRY_ATTEMPTS) {
                    retryCount.current++;
                    const delay = getReconnectDelay();
                    console.log(`🔄 Reconnecting in ${delay}ms...`);
                    reconnectTimeout.current = setTimeout(() => {
                        connect();
                    }, delay);
                } else if (retryCount.current >= MAX_RETRY_ATTEMPTS) {
                    setConnectionState(ConnectionState.FAILED);
                }
            };
        } catch (error) {
            console.error('❌ Failed to create WebSocket:', error);
            setConnectionState(ConnectionState.DISCONNECTED);
            
            if (shouldReconnect.current && retryCount.current < MAX_RETRY_ATTEMPTS) {
                retryCount.current++;
                const delay = getReconnectDelay();
                reconnectTimeout.current = setTimeout(() => {
                    connect();
                }, delay);
            }
        }
    }, [sceneId, cleanup, startPingInterval, getReconnectDelay]);

    const subscribe = useCallback((messageType: string, handler: MessageHandler) => {
        const currentHandlers = handlers.current.get(messageType) || [];
        handlers.current.set(messageType, [...currentHandlers, handler]);

        // Return unsubscribe function
        return () => {
            const updatedHandlers = handlers.current.get(messageType)?.filter(h => h !== handler) || [];
            if (updatedHandlers.length === 0) {
                handlers.current.delete(messageType);
            } else {
                handlers.current.set(messageType, updatedHandlers);
            }
        };
    }, []);

    const send = useCallback((message: WSMessage) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            try {
                ws.current.send(JSON.stringify(message));
            } catch (error) {
                console.error('❌ Failed to send message:', error);
            }
        } else {
            console.warn('⚠️ WebSocket is not connected. Current state:', ws.current?.readyState);
        }
    }, []);

    const disconnect = useCallback(() => {
        shouldReconnect.current = false;
        cleanup();
        if (ws.current) {
            ws.current.close(1000, 'Client disconnecting');
            ws.current = null;
        }
        setConnectionState(ConnectionState.DISCONNECTED);
    }, [cleanup]);

    const reconnect = useCallback(() => {
        retryCount.current = 0;
        shouldReconnect.current = true;
        if (ws.current) {
            ws.current.close();
        }
        connect();
    }, [connect]);

    // Effect to handle scene changes and initial connection
    useEffect(() => {
        shouldReconnect.current = true;
        
        // If sceneId changes, close existing connection and reconnect
        if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
            ws.current.close();
        }
        
        connect();

        return () => {
            shouldReconnect.current = false;
            cleanup();
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [connect, cleanup]);

    return { 
        subscribe, 
        send, 
        disconnect, 
        reconnect,
        connectionState,
        isConnected: connectionState === ConnectionState.CONNECTED 
    };
};

