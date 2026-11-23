import type { Server as HttpServer } from "node:http";
import { Server, type DefaultEventsMap, type Socket } from "socket.io";
import { verifyToken } from "./auth.service.js";
import { assertMember } from "./household.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SocketData = {
  userId: string;
};

type RealtimeServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

type RealtimeSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

type JoinAck = (response: { ok: true } | { ok: false; error: string }) => void;

let io: RealtimeServer | null = null;

export function initRealtime(server: HttpServer): void {
  io = new Server(server);

  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth.token;

    if (typeof token !== "string") {
      next(new Error("Authentication required."));
      return;
    }

    try {
      const userId = verifyToken(token);
      socket.data.userId = userId;
      void socket.join(`user:${userId}`);
      next();
    } catch {
      next(new Error("Authentication required."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("household:join", (payload: unknown, ack?: JoinAck) => {
      if (typeof ack !== "function") {
        return;
      }

      void joinHouseholdRoom(socket, payload, ack);
    });
  });
}

export function emitToHousehold(
  householdId: string,
  event: string,
  payload: unknown,
): void {
  if (io === null) {
    return;
  }

  io.to(`household:${householdId}`).emit(event, payload);
}

export function removeUserFromHousehold(
  userId: string,
  householdId: string,
): void {
  if (io === null) {
    return;
  }

  io.in(`user:${userId}`).socketsLeave(`household:${householdId}`);
}

async function joinHouseholdRoom(
  socket: RealtimeSocket,
  payload: unknown,
  ack: JoinAck,
): Promise<void> {
  try {
    const householdId = parseHouseholdId(payload);
    await assertMember(socket.data.userId, householdId);
    await socket.join(`household:${householdId}`);
    ack({ ok: true });
  } catch {
    ack({ ok: false, error: "Household not found." });
  }
}

function parseHouseholdId(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.householdId !== "string") {
    throw new Error("Invalid household id.");
  }

  const householdId = payload.householdId;
  if (!UUID.test(householdId)) {
    throw new Error("Invalid household id.");
  }

  return householdId.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
