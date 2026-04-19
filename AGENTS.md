# AGENTS.md

Instructions for coding agents working in this repository.

## Git Workflow

- Do not create a git branch unless the user explicitly asks for one.
- By default, make requested changes on the current branch.

## Project Overview

LaserChess is a React-based implementation of the Laser Chess board game with mobile deployment via Capacitor. It uses canvas-based rendering with React-Konva for board graphics and Redux Toolkit for state management.

## Essential Commands

### Development

```bash
npm start
npm run build
npm test
```

### Mobile Deployment

```bash
npx cap sync android
cd android && ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Combined Build And Deploy

```bash
npm run build && npx cap sync android && cd android && ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleDebug && adb install app/build/outputs/apk/debug/app-debug.apk
```

## Architecture Overview

### State Management Pattern

- A single Redux slice in `src/redux/slices/gameSlice.js` manages the game state.
- Centralized state includes board data, current player, selection state, laser effects, reserve placement, and winner state.
- Movement locking prevents input during animations and laser resolution.
- Game models use `.serialize()` so state stays Redux-compatible.

### Core Game Models

- `src/models/Board.js` is the main game engine for movement validation, reserve deployment, laser calculation, and AI integration.
- `src/models/Piece.js` defines game pieces and color ownership through letter case.
- `src/models/Movement.js` models normal moves, special swaps, rotations, and reserve deployment.
- `src/models/Location.js` handles board coordinates and algebraic notation.

### Rendering Architecture

- The board is rendered with React-Konva on canvas.
- `src/components/BoardLayer.js` draws the board, pieces, placement overlays, and laser effects.
- `src/components/BoardPiece.js` handles drag-and-drop, selection, and piece animation.
- Layout is responsive and scales from the viewport dimensions.

### Game Logic Flow

1. A player selects a piece or enters mirror placement mode.
2. The board validates the move or placement and produces a movement or deploy action.
3. Redux applies the state update and triggers the visual animation.
4. The board computes the laser route and resolves the result.
5. The turn advances unless the game is over.

### Notation Systems

- Setup Notation (SN) stores the active board layout in a compact format.
- Algebraic Notation (AN) is used for board coordinates.
- Laser Hit Action Notation (LHAN) defines laser-piece interaction rules through `src/assets/laser-v-piece.json`.

### AI System

- AI logic lives in `src/utils/ai/`.
- It uses minimax with iterative deepening and node-based tree expansion.
- Evaluation is integrated through the `Board` model.

## Key Implementation Details

### Game State Shape

```javascript
{
  sn: "board_setup_notation",
  currentPlayer: PlayerTypesEnum.BLUE,
  selectedPieceLocation: Location,
  movementIsLocked: boolean,
  laser: {
    route: [],
    finalLocation: Location,
    finalActionType: "HIT" | "MISS"
  },
  winner: "",
  squares: []
}
```

### Movement And Animation Pattern

1. UI interaction dispatches `applyMovement` or reserve placement actions.
2. Board state updates and the laser route is computed.
3. The laser is displayed briefly.
4. `finishMovement` applies the resolved laser effect and advances the turn.

### Piece System

- Uppercase letters are Blue pieces and lowercase letters are Red pieces.
- Piece types are King (`k/K`), Laser (`l/L`), Defender (`d/D`), Deflector (`b/B`), and Switch (`s/S`).
- Directional pieces use orientations `0`, `90`, `180`, and `270`.
- Special squares include reserved cells, visible laser cells, and hideout connections.

### Development Patterns

- Keep business logic in the domain models rather than UI components.
- Use Redux actions to drive game flow.
- Preserve serializable state.
- Prefer canvas-layer updates over DOM-heavy board rendering.
- Keep mobile/touch interaction behavior intact when changing board interaction code.

## Project Structure Notes

- `docs/` contains the game rules and notation references.
- `src/assets/` contains piece art, UI assets, and laser interaction configuration.
- `android/` contains the Capacitor Android project.
- Material UI is used for controls; Konva handles board rendering.
- Styling is SASS-based with responsive breakpoints.
