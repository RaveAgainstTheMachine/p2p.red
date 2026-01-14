# 🚀 Desktop App Project Plan: Tauri Monorepo Migration

**Project:** P2P File Share Desktop Application  
**Repository Strategy:** Monorepo (Single Repository)  
**Framework:** Tauri 2.0  
**Timeline:** 2-3 weeks  
**Status:** Planning Phase

---

## 📋 Executive Summary

Migrate P2P File Share to a monorepo structure and add a Tauri desktop application alongside the existing web app. This solves critical browser limitations (Firefox RAM usage, DataChannel message size limits) while maintaining the web app for easy sharing.

### Key Benefits
- ✅ **Zero RAM buffering** on ALL platforms (Windows, macOS, Linux)
- ✅ **No DataChannel limits** (can use larger chunks or native sockets)
- ✅ **Background transfers** (minimize window, transfers continue)
- ✅ **Native system integration** (notifications, tray icon, auto-start)
- ✅ **80% code reuse** (shared React components, WebRTC logic, encryption)
- ✅ **Unified codebase** (single git repo, synchronized releases)

---

## 🎯 Goals

### Primary Goals
1. Eliminate Firefox 23GB+ RAM usage issue
2. Enable progressive disk writes on all platforms
3. Maintain existing web app functionality
4. Share 80% of codebase between web and desktop

### Secondary Goals
1. Add background transfer support
2. Implement native notifications
3. Add system tray integration
4. Enable transfer resume capability
5. Add transfer history/queue management

---

## 📂 Repository Structure

```
/opt/p2p-file-share/
├── packages/
│   ├── web/                           # Existing web app
│   │   ├── src/
│   │   │   ├── components/           # Web-specific components
│   │   │   ├── hooks/                # Web-specific hooks
│   │   │   └── App.tsx
│   │   ├── public/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   ├── desktop/                       # New Tauri desktop app
│   │   ├── src/
│   │   │   ├── components/           # Desktop-specific components
│   │   │   ├── hooks/                # Desktop-specific hooks
│   │   │   └── App.tsx
│   │   ├── src-tauri/                # Rust backend
│   │   │   ├── src/
│   │   │   │   ├── main.rs
│   │   │   │   ├── commands.rs       # Tauri commands
│   │   │   │   └── file_stream.rs    # Progressive file writing
│   │   │   ├── Cargo.toml
│   │   │   └── tauri.conf.json
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   └── shared/                        # Shared code (~80%)
│       ├── src/
│       │   ├── hooks/
│       │   │   ├── useAdaptiveMultiStreamTransfer.ts
│       │   │   ├── usePeerConnection.ts
│       │   │   └── useEncryption.ts
│       │   ├── components/
│       │   │   ├── ProgressBar.tsx
│       │   │   ├── FileList.tsx
│       │   │   └── ConnectionStatus.tsx
│       │   ├── utils/
│       │   │   ├── encryption.ts
│       │   │   ├── multiStreamOrchestrator.ts
│       │   │   └── networkDetection.ts
│       │   └── types/
│       │       └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                       # Root workspace config
├── pnpm-workspace.yaml                # pnpm workspace config
├── turbo.json                         # Turborepo config (optional)
├── deploy.sh                          # Web deployment script
├── docker-compose.yml                 # VPS services
├── nginx.conf
└── README.md
```

---

## 🔧 Technical Architecture

### Web App (Current)
- **Frontend:** React + TypeScript + Vite
- **P2P:** WebRTC DataChannels (PeerJS)
- **File System:** 
  - Chrome/Edge: File System Access API
  - Firefox: RAM buffer + traditional download
- **Deployment:** Docker + Nginx on OVH VPS

### Desktop App (New)
- **Frontend:** React + TypeScript + Vite (shared with web)
- **Backend:** Rust (Tauri 2.0)
- **P2P:** WebRTC DataChannels (same as web)
- **File System:** Tauri File System API (progressive disk writes)
- **Distribution:** Native executables (Windows .exe, macOS .app, Linux .AppImage)

### Shared Code
- WebRTC connection logic
- Multi-stream transfer orchestration
- Encryption/decryption
- UI components (progress bars, file lists)
- Network quality detection
- Chunk management

### Platform-Specific Code
- **Web:** File System Access API, traditional download fallback
- **Desktop:** Tauri commands for file streaming, native notifications, system tray

---

## 📊 Research Findings

### Tauri 2.0 Capabilities

**File System API:**
- ✅ Progressive file writing via `FileHandle`
- ✅ Streaming chunks with `file.write(Uint8Array)`
- ✅ Async operations with `tokio::fs`
- ✅ No RAM buffering required
- ✅ Cross-platform (Windows, macOS, Linux)

**IPC Channels:**
- ✅ Streaming data from Rust to frontend
- ✅ Chunks of 4096+ bytes
- ✅ Progress notifications
- ✅ Async command support

**Example (Rust backend):**
```rust
use tokio::io::AsyncWriteExt;

#[tauri::command]
async fn write_chunk(
    path: std::path::PathBuf,
    chunk: Vec<u8>,
    channel: tauri::ipc::Channel<u64>
) -> Result<(), String> {
    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .await
        .map_err(|e| e.to_string())?;
    
    file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    
    // Notify frontend of progress
    channel.send(chunk.len() as u64).unwrap();
    
    Ok(())
}
```

**Example (Frontend):**
```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

const channel = new Channel<number>();
channel.onmessage = (bytesWritten) => {
  console.log(`Written ${bytesWritten} bytes to disk`);
};

await invoke('write_chunk', {
  path: '/path/to/file',
  chunk: new Uint8Array([...]),
  channel
});
```

### Monorepo Tooling

**Recommended Stack:**
- **Package Manager:** pnpm (fast, efficient, workspace support)
- **Build Tool:** Turborepo (optional, for faster builds)
- **Workspace:** pnpm workspaces (built-in, simple)

**Why pnpm:**
- Faster than npm/yarn
- Efficient disk usage (content-addressable storage)
- Built-in workspace support
- Industry standard for monorepos

**Workspace Configuration:**
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

```json
// Root package.json
{
  "name": "p2p-file-share-monorepo",
  "private": true,
  "scripts": {
    "dev:web": "pnpm --filter web dev",
    "dev:desktop": "pnpm --filter desktop tauri dev",
    "build:web": "pnpm --filter web build",
    "build:desktop": "pnpm --filter desktop tauri build",
    "deploy:web": "./deploy.sh"
  }
}
```

### Performance Comparison

| Metric | Web (Chrome) | Web (Firefox) | Desktop (Tauri) |
|--------|--------------|---------------|-----------------|
| **RAM (20GB file)** | ~50MB | ~40GB | ~50MB |
| **Chunk Size Limit** | 262KB | 262KB | Unlimited |
| **Background Transfer** | ❌ | ❌ | ✅ |
| **Native Notifications** | Limited | Limited | ✅ |
| **App Size** | 0 (web) | 0 (web) | ~50MB |
| **Installation** | None | None | Required |
| **Auto-updates** | ❌ | ❌ | ✅ |

---

## 📅 Implementation Timeline

### Phase 1: Monorepo Setup (Week 1, Days 1-2)
**Goal:** Restructure repository without breaking web app

**Tasks:**
1. ✅ Create project plan and research
2. ⏳ Install pnpm globally
3. ⏳ Create `packages/` directory structure
4. ⏳ Move web app to `packages/web/`
5. ⏳ Create `packages/shared/` structure
6. ⏳ Extract shared code to `packages/shared/`
7. ⏳ Set up pnpm workspace configuration
8. ⏳ Update import paths in web app
9. ⏳ Test web app still works
10. ⏳ Commit monorepo structure

**Deliverables:**
- Working monorepo structure
- Web app functional in `packages/web/`
- Shared code in `packages/shared/`
- pnpm workspace configured

**Success Criteria:**
- `pnpm dev:web` runs web app
- `pnpm build:web` builds web app
- `./deploy.sh` still deploys to VPS
- No functionality lost

---

### Phase 2: Tauri Desktop App Setup (Week 1, Days 3-5)
**Goal:** Create basic Tauri app with shared code

**Tasks:**
1. ⏳ Install Tauri CLI
2. ⏳ Create `packages/desktop/` with Tauri template
3. ⏳ Configure Tauri to use shared packages
4. ⏳ Set up basic UI (copy from web app)
5. ⏳ Test Tauri app launches
6. ⏳ Implement basic file selection
7. ⏳ Test shared components render
8. ⏳ Commit basic desktop app

**Deliverables:**
- Tauri app launches successfully
- Basic UI with shared components
- File selection works
- Development workflow established

**Success Criteria:**
- `pnpm dev:desktop` launches Tauri app
- Shared components render correctly
- Can select files via native dialog
- No build errors

---

### Phase 3: Progressive File Writing (Week 2, Days 1-3)
**Goal:** Implement Tauri backend for streaming file writes

**Tasks:**
1. ⏳ Create Rust command for file handle creation
2. ⏳ Implement chunk writing command
3. ⏳ Add progress channel for feedback
4. ⏳ Integrate with `useAdaptiveMultiStreamTransfer`
5. ⏳ Test with small files (< 100MB)
6. ⏳ Test with large files (> 1GB)
7. ⏳ Verify RAM usage stays low
8. ⏳ Add error handling
9. ⏳ Commit file streaming implementation

**Deliverables:**
- Rust commands for file operations
- Frontend integration with Tauri commands
- Progressive disk writes working
- Low RAM usage verified

**Success Criteria:**
- 20GB file uses < 100MB RAM
- Chunks written to disk immediately
- Progress updates in real-time
- No data loss or corruption

---

### Phase 4: WebRTC Integration (Week 2, Days 4-5)
**Goal:** Full P2P transfer working in desktop app

**Tasks:**
1. ⏳ Test PeerJS in Tauri environment
2. ⏳ Integrate multi-stream transfer
3. ⏳ Test sender → receiver transfer
4. ⏳ Verify event-driven flow control works
5. ⏳ Test with 20GB folder
6. ⏳ Compare speeds: web vs desktop
7. ⏳ Fix any platform-specific issues
8. ⏳ Commit working P2P transfer

**Deliverables:**
- Full P2P transfer working
- Multi-stream architecture functional
- Performance on par with web app
- All transfer features working

**Success Criteria:**
- Can transfer 20GB folder successfully
- Speeds match or exceed web app
- No premature completion
- Stable connection

---

### Phase 5: Desktop Features (Week 3, Days 1-3)
**Goal:** Add desktop-specific enhancements

**Tasks:**
1. ⏳ Implement native notifications
2. ⏳ Add system tray icon
3. ⏳ Add background transfer support
4. ⏳ Implement transfer queue
5. ⏳ Add transfer history
6. ⏳ Add settings persistence
7. ⏳ Test minimize to tray
8. ⏳ Commit desktop features

**Deliverables:**
- Native notifications on transfer complete
- System tray integration
- Background transfers working
- Transfer queue management
- Persistent settings

**Success Criteria:**
- Notifications appear on completion
- Can minimize to tray
- Transfers continue in background
- Settings saved between sessions

---

### Phase 6: Polish & Release (Week 3, Days 4-5)
**Goal:** Prepare for production release

**Tasks:**
1. ⏳ Add app icon and branding
2. ⏳ Set up code signing (Windows/macOS)
3. ⏳ Configure auto-updater
4. ⏳ Build release executables
5. ⏳ Test on Windows 10/11
6. ⏳ Test on macOS (Intel + Apple Silicon)
7. ⏳ Test on Linux (Ubuntu, Fedora)
8. ⏳ Write user documentation
9. ⏳ Create release notes
10. ⏳ Publish v1.0.0

**Deliverables:**
- Signed executables for all platforms
- Auto-updater configured
- User documentation
- Release notes
- GitHub release

**Success Criteria:**
- App installs on all platforms
- Auto-updater works
- No critical bugs
- Documentation complete

---

## 🚧 Risks & Mitigations

### Risk 1: Breaking Web App During Migration
**Impact:** High  
**Probability:** Medium  
**Mitigation:**
- Gradual migration (keep web app working at all times)
- Test after each step
- Git branches for major changes
- Can roll back if issues

### Risk 2: Tauri Learning Curve
**Impact:** Medium  
**Probability:** Medium  
**Mitigation:**
- Start with simple examples
- Use official Tauri documentation
- Leverage existing Rust knowledge
- Community support (Discord, GitHub)

### Risk 3: Code Signing Complexity
**Impact:** Medium  
**Probability:** High  
**Mitigation:**
- Research early (Week 1)
- Budget for certificates ($$$)
- Use Tauri's built-in signing support
- Test on all platforms

### Risk 4: Performance Regression
**Impact:** High  
**Probability:** Low  
**Mitigation:**
- Benchmark before/after
- Profile with Chrome DevTools
- Test with large files
- Compare web vs desktop speeds

---

## 📦 Dependencies

### New Dependencies
- **pnpm:** Package manager
- **Tauri CLI:** Desktop app framework
- **Rust toolchain:** Backend development
- **Code signing certificates:** Windows/macOS distribution

### Existing Dependencies (Keep)
- React, TypeScript, Vite
- PeerJS, WebRTC
- TailwindCSS, Lucide icons
- Docker, Nginx (for web deployment)

---

## 🎯 Success Metrics

### Technical Metrics
- ✅ RAM usage < 100MB for 20GB file (desktop)
- ✅ Transfer speeds match or exceed web app
- ✅ Zero data loss or corruption
- ✅ App launches in < 3 seconds
- ✅ Build size < 100MB

### User Experience Metrics
- ✅ Background transfers work reliably
- ✅ Notifications appear on completion
- ✅ Settings persist between sessions
- ✅ No crashes during normal use
- ✅ Intuitive UI matching web app

### Development Metrics
- ✅ 80%+ code reuse between web/desktop
- ✅ Single git repository
- ✅ Synchronized releases
- ✅ Easy to add features to both platforms

---

## 📚 Resources

### Documentation
- [Tauri 2.0 Docs](https://v2.tauri.app/)
- [Tauri File System Plugin](https://v2.tauri.app/plugin/file-system/)
- [Tauri IPC Channels](https://v2.tauri.app/develop/calling-rust/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Docs](https://turborepo.dev/)

### Examples
- [Tauri Examples Repo](https://github.com/tauri-apps/tauri/tree/dev/examples)
- [Tauri + React Template](https://github.com/tauri-apps/tauri/tree/dev/examples/react)
- [Monorepo Examples](https://github.com/vercel/turborepo/tree/main/examples)

---

## 🔄 Next Steps

1. **Review this plan** with stakeholders
2. **Discuss current web app state** (any issues to address first?)
3. **Get approval** to proceed with Phase 1
4. **Install pnpm** and begin monorepo setup
5. **Set up development environment** for Tauri

---

## 📝 Notes

- Web app will continue to work throughout migration
- Desktop app is additive, not a replacement
- Users can choose web or desktop based on needs
- Both platforms share same P2P protocol
- Can transfer between web ↔ desktop users

---

**Last Updated:** 2026-01-14  
**Status:** ✅ Planning Complete - Ready for Review
