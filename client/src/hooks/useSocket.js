import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

let _socket = null;

function getSocket() {
  if (!_socket) {
    _socket = io(SERVER_URL, { autoConnect: true, reconnection: true, reconnectionDelay: 1000 });
  }
  return _socket;
}

export function useSocket() {
  const socket = getSocket();
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => { socket.off("connect", onConnect); socket.off("disconnect", onDisconnect); };
  }, []);

  const emit = useCallback((event, data) => {
    return new Promise((resolve) => {
      socket.emit(event, data, resolve);
    });
  }, []);

  const on = useCallback((event, handler) => {
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, []);

  return { socket, connected, emit, on };
}
