class TVDashboard {
  constructor() {
    this.tvs = [];
    this.currentUploadTvId = null;
    this.currentYoutubeTvId = null;
    this.socket = null;
    this.init();
  }

  init() {
    this.initSocket();
    this.bindEvents();
    this.loadTVs();
  }

  initSocket() {
    this.socket = io();

    // Listen for real-time updates
    this.socket.on("tvAdded", (data) => {
      // Check if TV already exists to avoid duplicates
      const existingTv = this.tvs.find((tv) => tv.id === data.tvData.id);
      if (!existingTv) {
        this.tvs.push(data.tvData);
        this.renderTVs();
        this.showSuccess(
          `TV "${data.tvData.name}" ditambahkan oleh pengguna lain!`
        );
      }
    });

    this.socket.on("imageUpdated", (data) => {
      const tvIndex = this.tvs.findIndex((tv) => tv.id === data.tvId);
      if (tvIndex !== -1) {
        this.tvs[tvIndex] = data.tvData;
        // This is the crucial change: instead of re-rendering everything,
        // we find the specific card and update its content.
        const card = document.querySelector(
          `.tv-card[data-tv-id="${data.tvId}"]`
        );
        if (card) {
          const imageContainer = card.querySelector(".tv-image");
          if (imageContainer) {
            imageContainer.innerHTML = data.tvData.image
              ? `<img src="${data.tvData.image}" alt="Gambar TV ${data.tvData.id}">`
              : '<div class="no-image">📷 Belum ada gambar yang diunggah</div>';
          }
        }
        // Only show notification if this client didn't upload the image
        if (this.currentUploadTvId !== data.tvId) {
          this.showSuccess(
            `Gambar TV "${data.tvData.name}" diperbarui oleh pengguna lain!`
          );
        }
      }
    });

    this.socket.on("youtubeLinkUpdated", (data) => {
      const tvIndex = this.tvs.findIndex((tv) => tv.id === data.tvId);
      if (tvIndex !== -1) {
        this.tvs[tvIndex] = data.tvData;
        this.renderTVs();
        this.showSuccess(
          `Tautan YouTube untuk TV "${data.tvData.name}" diperbarui.`
        );
      }
    });

    this.socket.on("tvDeleted", (data) => {
      const deletedTv = this.tvs.find((tv) => tv.id === data.tvId);
      if (deletedTv) {
        this.tvs = this.tvs.filter((tv) => tv.id !== data.tvId);
        this.renderTVs();
        this.showSuccess(`TV "${deletedTv.name}" dihapus oleh pengguna lain!`);
      }
    });

    this.socket.on("tvListUpdate", (tvList) => {
      this.tvs = tvList;
      this.renderTVs();
    });

    this.socket.on("connect", () => {
      console.log("Terhubung ke server");
    });

    this.socket.on("disconnect", () => {
      console.log("Terputus dari server");
    });

    // Listen for zoom command responses
    this.socket.on("zoomCommandSent", (data) => {
      const { tvId, command, clientCount } = data;
      if (clientCount > 0) {
        this.showSuccess(
          `Perintah "${command}" dikirim ke TV ${tvId} (${clientCount} client terhubung)`
        );
      } else {
        this.showError(
          `TV ${tvId} tidak terhubung. Buka halaman TV terlebih dahulu.`
        );
      }
    });
  }

  bindEvents() {
    // Add TV Modal
    document.getElementById("addTvBtn").addEventListener("click", () => {
      this.showAddTvModal();
    });

    document.getElementById("closeModal").addEventListener("click", () => {
      this.hideAddTvModal();
    });

    document.getElementById("cancelBtn").addEventListener("click", () => {
      this.hideAddTvModal();
    });

    document.getElementById("addTvForm").addEventListener("submit", (e) => {
      this.handleAddTv(e);
    });

    // Upload Modal
    document
      .getElementById("closeUploadModal")
      .addEventListener("click", () => {
        this.hideUploadModal();
      });

    document.getElementById("cancelUploadBtn").addEventListener("click", () => {
      this.hideUploadModal();
    });

    document.getElementById("uploadForm").addEventListener("submit", (e) => {
      this.handleUploadImage(e);
    });

    document.getElementById("imageFile").addEventListener("change", (e) => {
      this.previewImage(e);
    });

    // YouTube Modal
    document
      .getElementById("closeYoutubeModal")
      .addEventListener("click", () => {
        this.hideYoutubeModal();
      });

    document
      .getElementById("cancelYoutubeBtn")
      .addEventListener("click", () => {
        this.hideYoutubeModal();
      });

    document.getElementById("youtubeForm").addEventListener("submit", (e) => {
      this.handleUpdateYoutubeLink(e);
    });

    // Close modals when clicking outside
    window.addEventListener("click", (e) => {
      const addModal = document.getElementById("addTvModal");
      const uploadModal = document.getElementById("uploadModal");
      const youtubeModal = document.getElementById("youtubeModal");

      if (e.target === addModal) {
        this.hideAddTvModal();
      }
      if (e.target === uploadModal) {
        this.hideUploadModal();
      }
      if (e.target === youtubeModal) {
        this.hideYoutubeModal();
      }
    });
  }

  async loadTVs() {
    try {
      this.showLoading();
      const response = await fetch("/api/tvs");
      if (!response.ok) throw new Error("Failed to load TVs");

      this.tvs = await response.json();
      this.renderTVs();
    } catch (error) {
      console.error("Error loading TVs:", error);
      this.showError("Gagal memuat daftar TV");
    } finally {
      this.hideLoading();
    }
  }

  renderTVs() {
    const tvGrid = document.getElementById("tvGrid");

    if (this.tvs.length === 0) {
      tvGrid.innerHTML = `
            <div class="empty-state">
                <h3>📺 Belum Ada TV yang Ditambahkan</h3>
                <p>Klik "Tambah TV Baru" untuk memulai</p>
            </div>
        `;
      return;
    }

    tvGrid.innerHTML = this.tvs.map((tv) => this.createTVCard(tv)).join("");
  }

  createTVCard(tv) {
    const tvUrl = `${window.location.origin}/tv-${tv.id}`;
    // Tambahkan timestamp untuk mencegah cache gambar
    const imageHtml = tv.image
      ? `<img src="${tv.image}" alt="Gambar TV ${tv.id}">`
      : '<div class="no-image">📷 Belum ada gambar yang diunggah</div>';

    return `
            <div class="tv-card" data-tv-id="${tv.id}">
                <h3>${this.escapeHtml(tv.name)}</h3>
                <div class="tv-info">
                    <strong>ID TV:</strong> ${tv.id}<br>
                    <strong>Dibuat:</strong> ${this.formatDate(tv.createdAt)}
                    ${
                      tv.updatedAt
                        ? `<br><strong>Terakhir Diperbarui:</strong> ${this.formatDate(
                            tv.updatedAt
                          )}`
                        : ""
                    }
                </div>
                <div class="tv-url">
                    <strong>URL Tampilan:</strong> ${tvUrl}
                </div>
                 <div class="tv-youtube">
                    <strong>Tautan YouTube:</strong> ${
                      tv.youtubeLink
                        ? `<a href="${tv.youtubeLink}" target="_blank">${tv.youtubeLink}</a>`
                        : "Tidak ada"
                    }
                </div>
                <div class="tv-image">
                    ${imageHtml}
                </div>
                ${
                  tv.image
                    ? `
                <div class="image-controls">
                    <button class="btn btn-icon" onclick="dashboard.sendZoomCommand(${tv.id}, 'zoomIn')" title="Perbesar">🔍+</button>
                    <button class="btn btn-icon" onclick="dashboard.sendZoomCommand(${tv.id}, 'zoomOut')" title="Perkecil">🔍-</button>
                    <button class="btn btn-icon" onclick="dashboard.sendZoomCommand(${tv.id}, 'resetZoom')" title="Reset Zoom">↻</button>
                    <button class="btn btn-icon" onclick="dashboard.sendZoomCommand(${tv.id}, 'fitToScreen')" title="Fit to Screen">📐</button>
                    <button class="btn btn-icon" onclick="dashboard.sendZoomCommand(${tv.id}, 'stretchToScreen')" title="Stretch to Screen">⛶</button>
                </div>
                `
                    : ""
                }
                <div class="tv-actions">
                    <button class="btn btn-primary" onclick="dashboard.showUploadModal(${
                      tv.id
                    })">
                        📤 Unggah Gambar
                    </button>
                    <button class="btn btn-primary" onclick="dashboard.showYoutubeModal(${
                      tv.id
                    })">
                        ▶️ YouTube
                    </button>
                    <button class="btn btn-secondary" onclick="window.open('/tv-${
                      tv.id
                    }', '_blank')">
                        👁️ Lihat TV
                    </button>
                    <button class="btn btn-danger" onclick="dashboard.deleteTV(${
                      tv.id
                    })">
                        🗑️ Hapus
                    </button>
                </div>
            </div>
        `;
  }

  showAddTvModal() {
    document.getElementById("addTvModal").style.display = "block";
    document.getElementById("tvName").focus();
  }

  hideAddTvModal() {
    document.getElementById("addTvModal").style.display = "none";
    document.getElementById("addTvForm").reset();
  }

  showUploadModal(tvId) {
    this.currentUploadTvId = tvId;
    document.getElementById("uploadModal").style.display = "block";
    document.getElementById("imagePreview").innerHTML = "";
  }

  hideUploadModal() {
    document.getElementById("uploadModal").style.display = "none";
    document.getElementById("uploadForm").reset();
    document.getElementById("imagePreview").innerHTML = "";
    this.currentUploadTvId = null;
  }

  showYoutubeModal(tvId) {
    this.currentYoutubeTvId = tvId;
    const tv = this.tvs.find((t) => t.id === tvId);
    if (tv) {
      document.getElementById("youtubeLink").value = tv.youtubeLink || "";
    }
    document.getElementById("youtubeModal").style.display = "block";
    document.getElementById("youtubeLink").focus();
  }

  hideYoutubeModal() {
    document.getElementById("youtubeModal").style.display = "none";
    document.getElementById("youtubeForm").reset();
    this.currentYoutubeTvId = null;
  }

  async handleAddTv(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const tvName = formData.get("tvName").trim();

    if (!tvName) {
      this.showError("Nama TV wajib diisi");
      return;
    }

    try {
      this.showLoading();
      const response = await fetch("/api/tvs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: tvName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Gagal menambahkan TV");
      }

      const newTv = await response.json();
      // Check if TV already exists to avoid duplicates from Socket.IO
      const existingTv = this.tvs.find((tv) => tv.id === newTv.id);
      if (!existingTv) {
        this.tvs.push(newTv);
      }
      this.renderTVs();
      this.hideAddTvModal();
      this.showSuccess(`TV "${tvName}" berhasil ditambahkan!`);
    } catch (error) {
      console.error("Error adding TV:", error);
      this.showError(error.message);
    } finally {
      this.hideLoading();
    }
  }

  async handleUploadImage(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const imageFile = formData.get("image");

    if (!imageFile || !imageFile.size) {
      this.showError("Silakan pilih file gambar");
      return;
    }

    if (!this.currentUploadTvId) {
      this.showError("Tidak ada TV yang dipilih untuk unggahan");
      return;
    }

    try {
      this.showLoading();
      // Don't append tvId to formData, it's taken from URL params

      const response = await fetch(
        `/api/tvs/${this.currentUploadTvId}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Gagal mengunggah gambar");
      }

      const updatedTv = await response.json();

      // Update the TV in our local array
      const tvIndex = this.tvs.findIndex(
        (tv) => tv.id === this.currentUploadTvId
      );
      if (tvIndex !== -1) {
        this.tvs[tvIndex] = updatedTv;
      }

      this.renderTVs();
      this.hideUploadModal();
      this.showSuccess("Gambar berhasil diunggah!");
    } catch (error) {
      console.error("Error uploading image:", error);
      this.showError(error.message);
    } finally {
      this.hideLoading();
    }
  }

  async handleUpdateYoutubeLink(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const youtubeLink = formData.get("youtubeLink").trim();

    if (!this.currentYoutubeTvId) {
      this.showError("Tidak ada TV yang dipilih");
      return;
    }

    try {
      this.showLoading();
      const response = await fetch(
        `/api/tvs/${this.currentYoutubeTvId}/youtube`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ youtubeLink }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Gagal memperbarui tautan YouTube");
      }

      const updatedTv = await response.json();

      // Update the TV in our local array
      const tvIndex = this.tvs.findIndex(
        (tv) => tv.id === this.currentYoutubeTvId
      );
      if (tvIndex !== -1) {
        this.tvs[tvIndex] = updatedTv;
      }

      this.renderTVs();
      this.hideYoutubeModal();
      this.showSuccess("Tautan YouTube berhasil diperbarui!");
    } catch (error) {
      console.error("Error updating YouTube link:", error);
      this.showError(error.message);
    } finally {
      this.hideLoading();
    }
  }

  async deleteTV(tvId) {
    const tv = this.tvs.find((t) => t.id === tvId);
    if (!tv) return;

    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus "${tv.name}"? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }

    try {
      this.showLoading();
      const response = await fetch(`/api/tvs/${tvId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Gagal menghapus TV");
      }

      // Only update if TV still exists (avoid duplicate from Socket.IO)
      const stillExists = this.tvs.find((t) => t.id === tvId);
      if (stillExists) {
        this.tvs = this.tvs.filter((t) => t.id !== tvId);
        this.renderTVs();
        this.showSuccess(`TV "${tv.name}" berhasil dihapus!`);
      }
    } catch (error) {
      console.error("Error deleting TV:", error);
      this.showError(error.message);
    } finally {
      this.hideLoading();
    }
  }

  previewImage(e) {
    const file = e.target.files[0];
    const preview = document.getElementById("imagePreview");

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
      };
      reader.readAsDataURL(file);
    } else {
      preview.innerHTML = "";
    }
  }

  showLoading() {
    document.getElementById("loadingOverlay").style.display = "flex";
  }

  hideLoading() {
    document.getElementById("loadingOverlay").style.display = "none";
  }

  showSuccess(message) {
    this.showNotification(message, "success");
  }

  showError(message) {
    this.showNotification(message, "error");
  }

  showNotification(message, type = "info") {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
            <span>${this.escapeHtml(message)}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;

    // Add notification styles if not already added
    if (!document.getElementById("notification-styles")) {
      const styles = document.createElement("style");
      styles.id = "notification-styles";
      styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 600;
                    z-index: 3000;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    max-width: 400px;
                    animation: slideInRight 0.3s ease;
                }
                .notification-success { background: #28a745; }
                .notification-error { background: #dc3545; }
                .notification-info { background: #17a2b8; }
                .notification button {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString("id-ID");
  }

  // Send zoom command to specific TV
  sendZoomCommand(tvId, command) {
    if (this.socket) {
      this.socket.emit("zoomCommand", {
        tvId: tvId,
        command: command,
      });

      // Show immediate feedback
      const commandNames = {
        zoomIn: "Perbesar",
        zoomOut: "Perkecil",
        resetZoom: "Reset Zoom",
        fitToScreen: "Fit to Screen",
        stretchToScreen: "Stretch to Screen",
      };

      this.showSuccess(
        `Mengirim perintah "${commandNames[command]}" ke TV ${tvId}`
      );
    } else {
      this.showError("Tidak terhubung ke server");
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.dashboard = new TVDashboard();
});
