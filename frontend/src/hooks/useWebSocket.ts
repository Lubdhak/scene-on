// WebSocket hook for real-time chat updates
import { useEffect, useRef, useCallback, useState } from 'react';

interface WSMessage {
    type: string;
    data: Record<string, any>;
}

type MessageHandler = (data: Record<string, any>) => void;

const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If we're in development (Vite), the backend might be on 8080.
    // In production, it's likely on the same host.
    const host = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host;
    return `${protocol}//${host}/ws`;
};

const WS_BASE_URL = getWsUrl();

export const useWebSocket = (sceneId?: string | null) => {
    const ws = useRef<WebSocket | null>(null);
    const handlers = useRef<Map<string, MessageHandler[]>>(new Map());
    const reconnectTimeout = useRef<NodeJS.Timeout>();
    const [isConnected, setIsConnected] = useState(false);

    const connect = useCallback(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            setIsConnected(true);
            return;
        }

        // Use the sceneId passed to the hook
        const url = sceneId ? `${WS_BASE_URL}?scene_id=${sceneId}` : WS_BASE_URL;

        console.log(`🔌 Connecting to WebSocket: ${url}`); // Added console.log
        try {
            ws.current = new WebSocket(url);

            ws.current.onopen = () => {
                setIsConnected(true);
            };

            ws.current.onmessage = (event) => {
                try {
                    const message: WSMessage = JSON.parse(event.data);
                    console.log('📥 WS Message:', message.type, message.data); // Debug log
                    const messageHandlers = handlers.current.get(message.type);
                    if (messageHandlers) {
                        messageHandlers.forEach(handler => handler(message.data));
                    }
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setIsConnected(false);
            };

            ws.current.onclose = () => {
                setIsConnected(false);
                reconnectTimeout.current = setTimeout(() => {
                    connect();
                }, 3000);
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            setIsConnected(false);
            reconnectTimeout.current = setTimeout(() => {
                connect();
            }, 3000);
        }
    }, [sceneId]); // Added sceneId to connect's dependencies

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
            ws.current.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket is not connected');
        }
    }, []);

    // Reconnect when currentSceneId changes in localStorage
    // We'll use a simple interval or a manual trigger if we had a Provider, 
    // but for now, we'll just ensure connect() is called in useEffect.
    useEffect(() => {
        // Close existing connection before attempting a new one if sceneId changed
        if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
            ws.current.close();
        }
        connect();

        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [connect]);

    return { subscribe, send, isConnected };
};
