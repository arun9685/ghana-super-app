import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/env.dart';

// Mirrors frontend/src/api/socket.ts: one authenticated socket per
// session, joined to the same rooms the backend emits to
// (backend/src/realtime/socket.ts) — ride:<id>, driver:<id>.
class SocketService {
  static final SocketService instance = SocketService._internal();
  SocketService._internal();

  io.Socket? _socket;

  void connect(String accessToken) {
    _socket?.dispose();
    _socket = io.io(
      Env.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': accessToken})
          .disableAutoConnect()
          .build(),
    );
    _socket!.connect();
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  void on(String event, void Function(dynamic) handler) {
    _socket?.on(event, handler);
  }

  void off(String event) {
    _socket?.off(event);
  }

  void joinRide(String rideId) {
    // Matches backend/src/realtime/socket.ts's "ride:subscribe" handler,
    // which takes the bare rideId (not an object) and joins the caller
    // to the `ride:<rideId>` room after checking they're party to it.
    _socket?.emit('ride:subscribe', rideId);
  }

  void leaveRide(String rideId) {
    _socket?.emit('ride:unsubscribe', rideId);
  }
}
