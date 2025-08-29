# Paraspot AI Mobile App

Professional inspection video recording and upload app for iOS and Android. Built with React, TypeScript, Tailwind CSS, and Capacitor for cross-platform mobile deployment.

## Features

- **Simple Inspection Flow**: Enter inspection ID or paste link, start recording immediately
- **Smart Input Parsing**: Accepts both plain IDs (e.g., ABC123) and full URLs (e.g., https://app.paraspot.ai/i/ABC123)
- **Recent Inspections**: Quick access to your 5 most recent inspection IDs
- **Upload Queue Management**: Monitor upload progress, pause/resume, retry failed uploads
- **Full Screen Camera**: Professional camera interface with recording controls
- **Offline Recording**: Record videos without internet connection
- **Chunked Uploads**: Reliable multipart upload with resume capability
- **Cross-Platform**: Works on iOS, Android, and web browsers

## Quick Start

### Web Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Mobile Deployment (iOS/Android)

1. **Export to GitHub** via Lovable's "Export to Github" button
2. **Clone and setup**:
   ```bash
   git clone <your-repo-url>
   cd <your-project>
   npm install
   ```

3. **Initialize Capacitor** (already configured):
   ```bash
   npx cap init
   ```

4. **Add platforms**:
   ```bash
   # For iOS (requires Mac + Xcode)
   npx cap add ios
   
   # For Android (requires Android Studio)
   npx cap add android
   ```

5. **Build and sync**:
   ```bash
   npm run build
   npx cap sync
   ```

6. **Run on device/emulator**:
   ```bash
   # iOS (Mac only)
   npx cap run ios
   
   # Android
   npx cap run android
   ```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# API Configuration
VITE_API_BASE_URL=https://api.paraspot.ai

# Upload Settings
VITE_UPLOAD_CONCURRENCY=3
VITE_CHUNK_SIZE_BYTES=5242880

# Development/Testing
VITE_MOCK_API=false
```

### API Integration

The app expects these REST endpoints:

#### Initialize Upload
```
POST /api/inspections/{inspection_id}/uploads/init
Body: { "filename": string, "filesize": number, "mime": "video/mp4" }
Response: { "upload_id": string, "part_size": number, "urls": [...] }
```

#### Upload Part
```
PUT <signed_url_for_part>
Body: Raw bytes of the part
Response: 200/204 with ETag header
```

#### Complete Upload
```
POST /api/inspections/{inspection_id}/uploads/complete
Body: { "upload_id": string, "parts": [{ "part": number, "etag": string }] }
Response: { "status": "completed" }
```

## Architecture

### Core Services

- **StorageService**: Local persistence for inspections and upload queue
- **CameraService**: Video recording with device camera integration
- **UploadService**: Chunked multipart upload with retry logic

### Data Models

- **InspectionRecord**: Recent inspection tracking
- **UploadJob**: Upload queue item with progress and status
- **CameraSettings**: Device camera configuration

### Mobile Components

- **MobileButton**: Touch-optimized button with variants
- **MobileInput**: Mobile-friendly input fields  
- **MobileCard**: Pressable cards for mobile interactions
- **StatusBadge**: Visual status indicators for uploads

## Permissions Required

### iOS (Info.plist)
- Camera Usage: Video recording
- Microphone Usage: Audio recording

### Android (AndroidManifest.xml)  
- Camera: Video capture
- Record Audio: Audio recording
- Write External Storage: File operations

## Development Notes

### Hot Reload Setup
The Capacitor config includes hot-reload support for development. The mobile app connects to your Lovable preview URL for live updates.

### Testing Strategies

1. **Web Browser**: Test core functionality and UI
2. **iOS Simulator**: Test iOS-specific behaviors  
3. **Android Emulator**: Test Android integration
4. **Physical Devices**: Test camera, storage, and performance

### Mock API Mode
Set `VITE_MOCK_API=true` for local development without backend integration.

## Troubleshooting

### Common Issues

**Camera not working**: Check permissions in device settings
**Upload failures**: Verify API endpoints and network connectivity  
**Build errors**: Ensure all dependencies are installed with `npm install`
**iOS build issues**: Requires Mac with Xcode installed
**Android build issues**: Requires Android Studio and SDK setup

### Platform-Specific Setup

**iOS Development**: 
- Requires macOS with Xcode
- Apple Developer account for device testing
- Proper code signing certificates

**Android Development**:
- Android Studio with SDK tools
- USB debugging enabled on test devices
- Proper SDK/build tools versions

For detailed mobile development guidance, see: [Lovable Mobile Development Guide](https://lovable.dev/blogs/TODO)

## Production Deployment

1. Build optimized version: `npm run build`
2. Sync to native platforms: `npx cap sync`
3. Generate signed builds through Xcode (iOS) or Android Studio
4. Deploy to App Store/Play Store following platform guidelines

## License

Built with [Lovable](https://lovable.dev) - AI-powered web development platform.
