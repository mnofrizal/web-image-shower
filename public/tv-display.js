class TVDisplay {
  constructor() {
    this.tvId = null;
    this.tvData = null;
    this.refreshInterval = null;
    this.cursorTimeout = null;
    this.socket = null;
    this.init();
  }

  init() {
    this.extractTvId();
    this.initSocket();
    this.setupEventListeners();
    this.loadTVData();
    this.startAutoRefresh();
    this.setupCursorHiding();
  }

  initSocket() {
    this.socket = io();

    // Join the specific TV room for real-time updates
    if (this.tvId) {
      this.socket.emit("joinTvDisplay", this.tvId);
    }

    // Listen for real-time image updates
    this.socket.on("imageUpdated", (data) => {
      if (data.tvId === this.tvId) {
        this.tvData = data.tvData;
        this.displayTV();
        console.log("Gambar diperbarui secara real-time");
      }
    });

    // Listen for TV deletion
    this.socket.on("tvDeleted", (data) => {
      if (data.tvId === this.tvId) {
        this.showError("TV ini telah dihapus");
      }
    });

    this.socket.on("connect", () => {
      console.log("Terhubung ke server");
      this.updateStatus("connected");
    });

    this.socket.on("disconnect", () => {
      console.log("Terputus dari server");
      this.updateStatus("error");
    });
  }

  extractTvId() {
    // Extract TV ID from URL path (e.g., /tv-1 -> 1)
    const path = window.location.pathname;
    const match = path.match(/\/tv-(\d+)/);
    if (match) {
      this.tvId = parseInt(match[1]);
    }
  }

  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "F5":
        case "r":
        case "R":
          e.preventDefault();
          this.loadTVData();
          break;
        case "f":
        case "F":
          this.toggleFullscreen();
          break;
        case "d":
        case "D":
          window.open("/", "_blank");
          break;
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          break;
      }
    });

    // Mouse movement for cursor hiding
    document.addEventListener("mousemove", () => {
      this.showCursor();
    });

    // Touch events for mobile
    document.addEventListener("touchstart", () => {
      this.showCursor();
    });

    // Window focus events for auto-refresh
    window.addEventListener("focus", () => {
      this.loadTVData();
      this.startAutoRefresh();
    });

    window.addEventListener("blur", () => {
      this.stopAutoRefresh();
    });

    // Handle visibility change (tab switching)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopAutoRefresh();
      } else {
        this.loadTVData();
        this.startAutoRefresh();
      }
    });
  }

  async loadTVData() {
    if (!this.tvId) {
      this.showError("ID TV tidak valid");
      return;
    }

    try {
      this.showLoading();

      const response = await fetch(`/api/tvs/${this.tvId}`);

      if (!response.ok) {
        if (response.status === 404) {
          this.showError("TV tidak ditemukan");
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        return;
      }

      this.tvData = await response.json();
      this.displayTV();
      this.updateStatus("connected");
    } catch (error) {
      console.error("Error loading TV data:", error);
      this.showError(`Gagal memuat data TV: ${error.message}`);
      this.updateStatus("error");
    }
  }

  displayTV() {
    this.hideAllViews();

    if (this.tvData.image) {
      this.showImage();
    } else {
      this.showNoImage();
    }

    this.updateControls();
  }

  showImage() {
    const imageDisplay = document.getElementById("imageDisplay");
    const tvImage = document.getElementById("tvImage");

    // Add cache-busting parameter to ensure fresh image
    const imageUrl = `${this.tvData.image}?t=${Date.now()}`;

    tvImage.onload = () => {
      imageDisplay.style.display = "flex";
    };

    tvImage.onerror = () => {
      console.error("Failed to load image");
      this.showNoImage();
    };

    tvImage.src = imageUrl;
    tvImage.alt = `${this.tvData.name} Display`;
  }

  showNoImage() {
    const noImage = document.getElementById("noImage");
    const tvName = document.getElementById("tvName");
    const tvId = document.getElementById("tvId");

    tvName.textContent = this.tvData.name;
    tvId.textContent = `ID TV: ${this.tvData.id}`;

    noImage.style.display = "flex";
  }

  showLoading() {
    this.hideAllViews();
    document.getElementById("loading").style.display = "flex";
  }

  showError(message) {
    this.hideAllViews();
    const errorDiv = document.getElementById("error");
    const errorText = errorDiv.querySelector("p");

    if (message === "TV tidak ditemukan") {
      errorText.textContent = "Tampilan TV ini tidak ada atau telah dihapus.";
    } else {
      errorText.textContent = message;
    }

    errorDiv.style.display = "flex";
  }

  hideAllViews() {
    document.getElementById("loading").style.display = "none";
    document.getElementById("noImage").style.display = "none";
    document.getElementById("imageDisplay").style.display = "none";
    document.getElementById("error").style.display = "none";
  }

  updateControls() {
    if (!this.tvData) return;

    const controlTvName = document.getElementById("controlTvName");
    const controlLastUpdate = document.getElementById("controlLastUpdate");

    controlTvName.textContent = this.tvData.name;

    if (this.tvData.updatedAt) {
      const lastUpdate = new Date(this.tvData.updatedAt);
      controlLastUpdate.textContent = this.formatDateTime(lastUpdate);
    } else {
      controlLastUpdate.textContent = "Tidak pernah";
    }
  }

  updateStatus(status) {
    // Remove existing status indicator
    const existingIndicator = document.querySelector(".status-indicator");
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Add new status indicator
    const indicator = document.createElement("div");
    indicator.className = `status-indicator ${
      status === "error" ? "error" : ""
    }`;
    document.body.appendChild(indicator);
  }

  startAutoRefresh() {
    this.stopAutoRefresh();

    // Refresh every 60 seconds (reduced frequency since we have real-time updates)
    this.refreshInterval = setInterval(() => {
      this.loadTVData();
    }, 60000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  setupCursorHiding() {
    this.showCursor();
  }

  showCursor() {
    document.body.classList.remove("hide-cursor");

    // Clear existing timeout
    if (this.cursorTimeout) {
      clearTimeout(this.cursorTimeout);
    }

    // Hide cursor after 3 seconds of inactivity
    this.cursorTimeout = setTimeout(() => {
      document.body.classList.add("hide-cursor");
    }, 3000);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  formatDateTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return "Baru saja";
    } else if (diffMins < 60) {
      return `${diffMins} menit yang lalu`;
    } else if (diffHours < 24) {
      return `${diffHours} jam yang lalu`;
    } else if (diffDays < 7) {
      return `${diffDays} hari yang lalu`;
    } else {
      return (
        date.toLocaleDateString("id-ID") +
        " " +
        date.toLocaleTimeString("id-ID")
      );
    }
  }

  // Public methods for manual control
  refresh() {
    this.loadTVData();
  }

  goToDashboard() {
    window.open("/", "_blank");
  }
}

// Initialize TV display when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.tvDisplay = new TVDisplay();
});

// Handle page unload
window.addEventListener("beforeunload", () => {
  if (window.tvDisplay) {
    window.tvDisplay.stopAutoRefresh();
    // Leave the TV room when page unloads
    if (window.tvDisplay.socket && window.tvDisplay.tvId) {
      window.tvDisplay.socket.emit("leaveTvDisplay", window.tvDisplay.tvId);
    }
  }
});

// Service Worker registration for offline support (optional)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered: ", registration);
      })
      .catch((registrationError) => {
        console.log("SW registration failed: ", registrationError);
      });
  });
}
