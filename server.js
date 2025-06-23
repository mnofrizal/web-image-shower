const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
const PORT = process.env.PORT || 1286;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// Create uploads directory if it doesn't exist
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Storage configuration for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Get TV ID from URL params instead of body
    const tvId = req.params.id || "default";
    const extension = path.extname(file.originalname);
    cb(null, `tv-${tvId}${extension}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// In-memory storage for TV data (in production, use a database)
let tvs = [];

// Routes

// Serve dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Serve TV display page
app.get("/tv-:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tv-display.html"));
});

// API Routes

// Get all TVs
app.get("/api/tvs", (req, res) => {
  res.json(tvs);
});

// Add new TV
app.post("/api/tvs", (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Nama TV wajib diisi" });
  }

  const id = tvs.length + 1;
  const newTv = {
    id,
    name,
    image: null,
    youtubeLink: null,
    createdAt: new Date().toISOString(),
  };

  tvs.push(newTv);

  // Emit real-time update to all connected clients
  io.emit("tvAdded", {
    tvData: newTv,
  });

  res.json(newTv);
});

// Upload image to TV
app.post("/api/tvs/:id/upload", upload.single("image"), (req, res) => {
  const tvId = parseInt(req.params.id);
  const tv = tvs.find((t) => t.id === tvId);

  if (!tv) {
    return res.status(404).json({ error: "TV tidak ditemukan" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "File gambar tidak disediakan" });
  }

  tv.image = `/uploads/${req.file.filename}`;
  tv.updatedAt = new Date().toISOString();

  // Emit real-time update to all connected clients
  io.emit("imageUpdated", {
    tvId: tv.id,
    tvData: tv,
  });

  res.json(tv);
});

// Update YouTube link for a TV
app.post("/api/tvs/:id/youtube", (req, res) => {
  const tvId = parseInt(req.params.id);
  const { youtubeLink } = req.body;
  const tv = tvs.find((t) => t.id === tvId);

  if (!tv) {
    return res.status(404).json({ error: "TV tidak ditemukan" });
  }

  tv.youtubeLink = youtubeLink;
  tv.updatedAt = new Date().toISOString();

  // Emit real-time update to all connected clients
  io.emit("youtubeLinkUpdated", {
    tvId: tv.id,
    tvData: tv,
  });

  res.json(tv);
});

// Get TV by ID
app.get("/api/tvs/:id", (req, res) => {
  const tvId = parseInt(req.params.id);
  const tv = tvs.find((t) => t.id === tvId);

  if (!tv) {
    return res.status(404).json({ error: "TV tidak ditemukan" });
  }

  res.json(tv);
});

// Delete TV
app.delete("/api/tvs/:id", (req, res) => {
  const tvId = parseInt(req.params.id);
  const tvIndex = tvs.findIndex((t) => t.id === tvId);

  if (tvIndex === -1) {
    return res.status(404).json({ error: "TV tidak ditemukan" });
  }

  // Delete associated image file
  const tv = tvs[tvIndex];
  if (tv.image) {
    const imagePath = path.join(__dirname, tv.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  tvs.splice(tvIndex, 1);

  // Emit real-time update to all connected clients
  io.emit("tvDeleted", {
    tvId: tvId,
  });

  res.json({ message: "TV berhasil dihapus" });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File terlalu besar. Ukuran maksimum 10MB." });
    }
  }
  res.status(500).json({ error: error.message });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client terhubung:", socket.id);

  // Send current TV list to newly connected client
  socket.emit("tvListUpdate", tvs);

  socket.on("disconnect", () => {
    console.log("Client terputus:", socket.id);
  });

  // Handle TV display page connections
  socket.on("joinTvDisplay", (tvId) => {
    const roomName = `tv-${tvId}`;
    socket.join(roomName);
    console.log(`Client ${socket.id} bergabung dengan room ${roomName}`);

    // Send confirmation back to client
    socket.emit("joinedTvRoom", { tvId, roomName });
  });

  socket.on("leaveTvDisplay", (tvId) => {
    socket.leave(`tv-${tvId}`);
    console.log(`Client ${socket.id} meninggalkan TV ${tvId}`);
  });

  // Handle zoom commands from dashboard
  socket.on("zoomCommand", (data) => {
    const { tvId, command } = data;
    console.log(`Zoom command "${command}" dikirim ke TV ${tvId}`);

    // Send zoom command to specific TV room
    io.to(`tv-${tvId}`).emit("zoomCommand", {
      command: command,
    });

    // Send confirmation back to dashboard
    socket.emit("zoomCommandSent", {
      tvId: tvId,
      command: command,
    });
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server Dashboard TV berjalan di http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`Contoh Tampilan TV: http://localhost:${PORT}/tv-1`);
});
