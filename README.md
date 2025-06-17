# TV Image Dashboard

A web-based dashboard system for managing and displaying images on multiple TV displays. Perfect for digital signage, information displays, or any scenario where you need to remotely manage images shown on different screens.

## Features

- **Dashboard Management**: Add, manage, and delete TV displays
- **Image Upload**: Upload images to specific TV displays
- **Real-time Display**: Individual TV display pages that auto-refresh
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Auto-refresh**: TV displays automatically check for new images
- **Fullscreen Support**: Press 'F' on TV display for fullscreen mode
- **Keyboard Shortcuts**: Quick navigation and control

## Quick Start

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Start the Server**

   ```bash
   npm start
   ```

   For development with auto-restart:

   ```bash
   npm run dev
   ```

3. **Access the Dashboard**
   - Open your browser and go to `http://localhost:3000`
   - The dashboard will be available at the root URL

## Usage

### Dashboard (Main Interface)

1. **Add a New TV**

   - Click the "Add New TV" button
   - Enter a name for your TV (e.g., "Living Room TV", "Reception Display")
   - Click "Add TV"

2. **Upload Images**

   - Click "Upload Image" on any TV card
   - Select an image file (JPG, PNG, GIF, WebP up to 10MB)
   - Click "Upload Image"

3. **View TV Display**
   - Click "View TV" to open the display page in a new tab
   - Each TV has a unique URL: `http://localhost:3000/tv-{id}`

### TV Display Pages

- **Auto-refresh**: Displays automatically check for new images every 30 seconds
- **Keyboard Shortcuts**:

  - `F` or `f`: Toggle fullscreen mode
  - `R` or `r`: Refresh display
  - `D` or `d`: Open dashboard in new tab
  - `Escape`: Exit fullscreen mode

- **Mouse Controls**: Hover over the display to see control bar with TV info and buttons

## API Endpoints

### TVs Management

- `GET /api/tvs` - Get all TVs
- `POST /api/tvs` - Create new TV
- `GET /api/tvs/:id` - Get specific TV
- `DELETE /api/tvs/:id` - Delete TV

### Image Upload

- `POST /api/tvs/:id/upload` - Upload image to specific TV

## File Structure

```
tv-image-dashboard/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── uploads/               # Uploaded images storage
└── public/                # Frontend files
    ├── dashboard.html     # Main dashboard interface
    ├── dashboard.css      # Dashboard styling
    ├── dashboard.js       # Dashboard functionality
    ├── tv-display.html    # TV display page
    ├── tv-display.css     # TV display styling
    └── tv-display.js      # TV display functionality
```

## Configuration

### Port Configuration

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### File Upload Limits

- Maximum file size: 10MB
- Supported formats: JPEG, JPG, PNG, GIF, WebP
- Files are stored in the `uploads/` directory

## Production Deployment

For production deployment:

1. **Environment Variables**

   ```bash
   export NODE_ENV=production
   export PORT=80
   ```

2. **Process Manager** (recommended)

   ```bash
   npm install -g pm2
   pm2 start server.js --name "tv-dashboard"
   ```

3. **Reverse Proxy** (nginx example)
   ```nginx
   server {
       listen 80;
       server_name tv-sla.my.id;

       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## Browser Compatibility

- Chrome/Chromium 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Troubleshooting

### Common Issues

1. **Images not displaying**

   - Check file format (must be image type)
   - Verify file size (under 10MB)
   - Check browser console for errors

2. **TV not found error**

   - Verify the TV ID in the URL
   - Check if TV was deleted from dashboard

3. **Upload failures**
   - Check available disk space
   - Verify file permissions on uploads/ directory

### Logs

Server logs are displayed in the console. For production, consider using a logging service or redirecting output:

```bash
npm start > app.log 2>&1
```

## Development

### Adding Features

The application is built with vanilla JavaScript and Express.js for easy customization:

- **Frontend**: Modify files in `public/` directory
- **Backend**: Edit `server.js` for API changes
- **Styling**: Update CSS files for visual changes

### Database Integration

Currently uses in-memory storage. For production, consider integrating:

- SQLite for simple deployments
- PostgreSQL/MySQL for larger installations
- MongoDB for document-based storage

## License

MIT License - feel free to use and modify for your needs.

## Support

For issues or questions, check the console logs and browser developer tools for error messages.
