import express from "express";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { findUser } from "./users.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const PORT = process.env.PORT || 3000;

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// --- Auth: login with existing account only (no signup) ---
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = findUser(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign(
    { sub: user.username, displayName: user.displayName },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
  res.json({ token, displayName: user.displayName, username: user.username });
});

// --- HTTP server + Socket.IO ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// In-memory message buffer (last 50)
const MESSAGE_BUFFER = []; // {user, text, ts}

io.use((socket, next) => {
  // Expect token in auth
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No auth token"));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = { username: payload.sub, displayName: payload.displayName };
    return next();
  } catch (e) {
    return next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  // Single global room
  const ROOM = "global";
  socket.join(ROOM);

  // Send last messages to the newly connected client
  socket.emit("chat:history", MESSAGE_BUFFER);

  // Broadcast join notice (optional)
  socket.to(ROOM).emit("chat:system", {
    text: `${socket.user.displayName} joined`,
    ts: Date.now()
  });

  socket.on("chat:send", (text) => {
    if (typeof text !== "string" || !text.trim()) return;
    const msg = {
      user: {
        username: socket.user.username,
        displayName: socket.user.displayName
      },
      text: text.trim(),
      ts: Date.now()
    };
    MESSAGE_BUFFER.push(msg);
    if (MESSAGE_BUFFER.length > 50) MESSAGE_BUFFER.shift();
    io.to(ROOM).emit("chat:message", msg);
  });

  socket.on("disconnect", () => {
    socket.to(ROOM).emit("chat:system", {
      text: `${socket.user.displayName} left`,
      ts: Date.now()
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
