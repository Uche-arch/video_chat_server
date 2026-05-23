const express = require("express");
const http = require("http");
// const next = require("next");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());

const server = http.createServer(app);

// const dev = process.env.NODE_ENV !== "production";
// const app = next({ dev });
// const handler = app.getRequestHandler();

let waitingUser = null;
const pairs = {};
let onlineUsers = 0;

// app.prepare().then(() => {
// const expressApp = express();
// const server = http.createServer(expressApp);

// const io = new Server(server, {
//   cors: {
//     origin: "*",
//   },
// });

const io = new Server(server, {
  cors: {
    origin: "*",
  },
  transports: ["websocket"],
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  onlineUsers++;

  io.emit("online-count", onlineUsers);

  console.log("Online users:", onlineUsers);

  socket.on("find-stranger", () => {
    // prevent self queue duplication
    if (waitingUser === socket.id) return;

    if (waitingUser) {
      const partner = waitingUser;

      waitingUser = null;

      pairs[socket.id] = partner;
      pairs[partner] = socket.id;

      io.to(socket.id).emit("matched", {
        partnerId: partner,
        initiator: true,
      });

      io.to(partner).emit("matched", {
        partnerId: socket.id,
        initiator: false,
      });

      console.log("Matched:", socket.id, partner);
    } else {
      waitingUser = socket.id;
      console.log("Waiting:", socket.id);
    }
  });

  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", {
      from: socket.id,
      offer,
    });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", {
      from: socket.id,
      answer,
    });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", {
      from: socket.id,
      candidate,
    });
  });

  socket.on("next-stranger", () => {
    handleDisconnect(socket);
    socket.emit("requeue");
  });

  socket.on("disconnect", () => {
    handleDisconnect(socket);
    onlineUsers--;

    io.emit("online-count", onlineUsers);

    console.log("Online users:", onlineUsers);
    console.log("Disconnected:", socket.id);
  });

  function handleDisconnect(socket) {
    const partner = pairs[socket.id];

    if (partner) {
      io.to(partner).emit("partner-disconnected");

      delete pairs[partner];
      delete pairs[socket.id];

      // requeue partner
      waitingUser = partner;
    }

    if (waitingUser === socket.id) {
      waitingUser = null;
    }
  }
});

app.get("/", (req, res) => {
  res.send("Socket server running");
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

//   expressApp.all("*", (req, res) => {
//     return handler(req, res);
//   });
// expressApp.all("/{*any}", (req, res) => {
//   return handler(req, res);
// });

// server.listen(3000, () => {
//   console.log("Server running on http://localhost:3000");
// });
// });
