import { io, type Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000";

let socket: Socket | null = null;

// One socket per session, authenticated the same way REST calls are
// (JWT access token). Reconnects automatically; auth.token is re-read on
// every (re)connect attempt via the callback form so a refreshed token
// is picked up without tearing the whole app down.
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: (cb) => cb({ token: localStorage.getItem("sankofa:accessToken") }),
  });
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  socket?.disconnect();
}
