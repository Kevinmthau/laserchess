# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LaserChess is a React-based implementation of the Laser Chess board game with mobile deployment via Capacitor. It uses canvas-based rendering (React-Konva) for high-performance game graphics and Redux Toolkit for state management.

## Essential Commands

### Development
```bash
npm start              # Start development server (uses legacy OpenSSL)
npm run build          # Production build
npm test               # Run test suite
```

### Mobile Deployment
```bash
npx cap sync android                                    # Sync web assets to Android
cd android && ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleDebug  # Build APK
adb install app/build/outputs/apk/debug/app-debug.apk  # Install on device
```

### Combined Build & Deploy
```bash
npm run build && npx cap sync android && cd android && ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleDebug && adb install app/build/outputs/apk/debug/app-debug.apk
```

## Architecture Overview

### State Management Pattern
- **Single Redux slice** (`src/redux/slices/gameSlice.js`) manages all game state
- **Centralized game state** includes board, current player, selected piece, laser effects, and winner
- **Movement locking mechanism** prevents input during animations and laser effects
- All game objects implement `.serialize()` for Redux compatibility

### Core Game Models (`src/models/`)
- **`Board.js`** - Central game engine with movement validation, laser calculation, and AI integration
- **`Piece.js`** - Game pieces with color-based player identification (uppercase=Blue, lowercase=Red)
- **`Movement.js`** - Three movement types: Normal, Special (piece swapping), Rotation (CW/CCW)
- **`Location.js`** - Algebraic notation support (a1-j8 board coordinates)

### Rendering Architecture
- **Canvas-based rendering** via React-Konva for performance and complex animations
- **`BoardLayer.js`** - Main game board with grid, pieces, and laser visualization
- **`BoardPiece.js`** - Individual pieces with drag-and-drop, selection, and animation support
- **Responsive design** with dynamic board sizing based on viewport

### Game Logic Flow
1. Player selects piece → Redux state updated with `selectedPieceLocation`
2. Movement validated → `Movement` object created with type and destinations
3. Movement applied → Board state updated, animations triggered
4. Laser calculated → Path computed with deflections and piece interactions
5. Turn completed → Player switched or game ends if King eliminated

### Notation Systems
- **Setup Notation (SN)** - Compact board state representation (similar to chess FEN)
- **Algebraic Notation (AN)** - Move representation for game history
- **Laser Hit Action Notation (LHAN)** - Configurable laser-piece interaction rules via `laser-v-piece.json`

### AI System (`src/utils/ai/`)
- **Minimax algorithm** with iterative deepening
- **Node-based tree expansion** for move evaluation  
- **Configurable evaluation limits** for difficulty adjustment
- Integrated into Board class for seamless single-player mode

## Key Implementation Details

### Game State Structure
```javascript
{
  sn: "board_setup_notation",           // Current board state
  currentPlayer: PlayerTypesEnum.BLUE,  // Current turn (Blue always starts)
  selectedPieceLocation: Location,      // Currently selected piece
  movementIsLocked: boolean,            // Prevents input during effects
  laser: {                              // Laser visualization state
    route: [],                          // Path coordinates
    finalLocation: Location,            // End position
    finalActionType: "HIT"|"MISS"       // Result type
  },
  winner: "",                           // Game end state
  squares: []                           // Board piece positions
}
```

### Movement Animation Pattern
1. UI triggers movement → `applyMovement` action dispatched
2. Board state updated → Laser route calculated
3. Laser visualized → 1.5s timeout for effect display
4. `finishMovement` called → Laser effects applied, turn advanced

### Piece System
- **Color identification**: Uppercase letters = Blue, lowercase = Red
- **Piece types**: King (k/K), Laser (l/L), Defender (d/D), Deflector (b/B), Switch (s/S)
- **Orientations**: 0°, 90°, 180°, 270° for directional pieces
- **Special cells**: Reserved areas (blue/red) and laser origin points

### Development Patterns
- **Model-driven architecture** with business logic in domain models
- **Event-driven game flow** through Redux actions
- **Serializable state** for debugging and potential persistence
- **Canvas performance optimization** via Konva layer management
- **Mobile-first responsive design** with touch and mouse support

## Project Structure Notes
- `/docs/` contains comprehensive game rules and notation documentation
- `/src/assets/` includes complete piece image library and UI elements
- `/android/` contains Capacitor Android project for mobile deployment
- Game uses Material-UI components for controls while canvas handles game rendering
- SASS styling with mobile-optimized responsive breakpoints