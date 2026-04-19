import { createSlice } from "@reduxjs/toolkit";
import { PlayerTypesEnum, GameStatusEnum, PieceTypesEnum } from "../../models/Enums";
import Board, { DEFAULT_BOARD_SN, MIRROR_RESERVE_COUNT } from "../../models/Board";

const initialMirrorReserve = () => ({
    [PlayerTypesEnum.BLUE]: MIRROR_RESERVE_COUNT,
    [PlayerTypesEnum.RED]: MIRROR_RESERVE_COUNT
});


const gameSlice = createSlice({
    name: "game",
    initialState: {
        sn: DEFAULT_BOARD_SN, // setup notation
        currentPlayer: PlayerTypesEnum.BLUE, // The current player
        status: GameStatusEnum.PLAYING,
        winner: "", // 🎉 this is replaced with either PlayerTypesEnum.BLUE or PlayerTypesEnum.RED when one of them wins by killing the opponent's king!
        winnerReason: null,
        squares: [],
        mirrorReserve: initialMirrorReserve(),
        pendingPlacement: null,

        selectedPieceLocation: null, // keeps track of the location where the selected piece is. It is NULL when no piece is selected.
        movementIsLocked: false, // when true, no player can move any piece. Usually becomes true when the laser is triggered and changing to another piece

        laser: {
            route: [],
            finalLocation: null,
            finalActionType: null
        }
    },
    reducers: {
        /**
         * Setup the board with a setup notation
         * This should be called in the app initialization.
         * 
         * @param {Object} action
         * @param {Object} action.payload
         * @param {string} action.payload.setupNotation the initial board setup notation.
         *                                              - If setupNotation is not passed, will default to the Ace board
         */
        setBoardType: (state, action) => {
            const newBoard = new Board(action.payload).serialize();
            state.squares = newBoard.squares;
            state.winner = newBoard.winner || "";
            state.winnerReason = newBoard.winnerReason;
            state.sn = newBoard.sn;
            state.mirrorReserve = initialMirrorReserve();
            state.pendingPlacement = null;
            state.selectedPieceLocation = null;
        },

        /**
         * Perform a movement on the current board state.
         * @param {Object} action
         * @param {Object} action.payload
         * @param {Movement} action.payload.movement the movement to be performed on the board.
         */
        applyMovement: (state, action) => {
            state.movementIsLocked = true;
            state.pendingPlacement = null;

            // Lock the move until finished (or laser stopped)
            const { movement } = action.payload;
            const newBoard = new Board({ squares: state.squares });

            newBoard.applyMovement(movement);
            const serializedBoard = newBoard.serialize();
            if (serializedBoard.winner) {
                state.winner = serializedBoard.winner || "";
                state.winnerReason = serializedBoard.winnerReason;
                state.sn = serializedBoard.sn;
                state.squares = serializedBoard.squares;
                state.status = GameStatusEnum.GAME_OVER;
                state.laser.route = [];
                state.laser.finalActionType = null;
                state.laser.finalLocation = null;
                return;
            }

            const route = newBoard.getLaserRoute(state.currentPlayer);

            state.laser.triggered = true;
            state.laser.route = route;

            const lastLaserRoutePath = route[route.length - 1];
            state.laser.finalActionType = lastLaserRoutePath.actionType;
            state.laser.finalLocation = lastLaserRoutePath.location;
        },

        startMirrorPlacement: (state) => {
            if (state.movementIsLocked || state.mirrorReserve[state.currentPlayer] <= 0) {
                return;
            }

            state.selectedPieceLocation = null;
            if (state.pendingPlacement?.playerType === state.currentPlayer) {
                state.pendingPlacement = null;
                return;
            }

            state.pendingPlacement = {
                playerType: state.currentPlayer,
                pieceType: PieceTypesEnum.DEFLECTOR,
                orientation: 0
            };
        },

        cancelMirrorPlacement: (state) => {
            state.pendingPlacement = null;
        },

        rotatePendingPlacement: (state, action) => {
            if (!state.pendingPlacement) {
                return;
            }

            const clockwise = action.payload?.clockwise !== false;
            const delta = clockwise ? 90 : -90;
            state.pendingPlacement.orientation = (state.pendingPlacement.orientation + delta + 360) % 360;
        },

        deployMirror: (state, action) => {
            if (!state.pendingPlacement) {
                return;
            }

            const { location } = action.payload;
            const { playerType, pieceType, orientation } = state.pendingPlacement;
            const newBoard = new Board({ squares: state.squares });
            if (!newBoard.canDeployPiece(location, playerType, pieceType)) {
                return;
            }

            state.movementIsLocked = true;
            newBoard.deployPiece(location, pieceType, playerType, orientation);
            state.pendingPlacement = null;
            state.mirrorReserve[playerType] -= 1;

            const route = newBoard.getLaserRoute(state.currentPlayer);
            state.laser.triggered = true;
            state.laser.route = route;

            const lastLaserRoutePath = route[route.length - 1];
            state.laser.finalActionType = lastLaserRoutePath.actionType;
            state.laser.finalLocation = lastLaserRoutePath.location;
        },



        /**
         * Finishes the current player move.
         * Hides the laser and applies any laser effect to the board (such as removing a piece on hit)
         *  - if game over, lock the movement.
         *  - // todo: if not game over, passes the turn to the next player. by removing the #togglePlayerTurn()
         * - This action is dispatched before #togglePlayerTurn.
         */
        finishMovement: (state) => {
            const newBoard = new Board({ squares: state.squares });
            if (state.laser.finalLocation) {
                newBoard.applyLaserHit(state.laser.finalActionType, state.laser.finalLocation);
            } else {
                newBoard.applyLaser(state.currentPlayer);
            }
            const serializedBoard = newBoard.serialize();

            state.winner = serializedBoard.winner || "";
            state.winnerReason = serializedBoard.winnerReason;
            state.sn = serializedBoard.sn;
            state.squares = serializedBoard.squares;

            // Check if game over
            if (serializedBoard.winner) {
                // If game is over, then keep the movement locked and show who won in the UI.
                state.movementIsLocked = true;
                state.status = GameStatusEnum.GAME_OVER;

            } else {
                // reset laser
                state.laser.route = [];
                state.laser.finalActionType = null;
                state.laser.finalLocation = null;
                state.pendingPlacement = null;

                // If game is not over, then pass the turn to the next player
                state.currentPlayer = (state.currentPlayer === PlayerTypesEnum.BLUE) ? PlayerTypesEnum.RED : PlayerTypesEnum.BLUE;
                state.movementIsLocked = false; // unlock the movement for the next player.
            }

        },


        /**
         * Mark a square location, selected or not.
         * 
         * @param {Object} action
         * @param {Object} action.payload
         * @param {Location} action.payload.location The location of the piece to be selected. 
         * 
         * You can pass NULL to unselect (if selected) the currently selected piece,
         * or even better, use the #uselectPiece action.
         */
        selectPiece: (state, action) => {
            const { location } = action.payload;
            state.selectedPieceLocation = location;
            state.pendingPlacement = null;
        },

        /**
         * Unselect a piece
         * 
         * @see selectPiece on how to select a piece by it's location.
         */
        unselectPiece: (state) => {
            state.selectedPieceLocation = null;
        },


        // Control game state
        /**
         * Pause the game!
         */
        pause: (state) => {
            state.status = GameStatusEnum.PAUSED;
        },

        /**
         * Resume the game. 
         */
        resume: (state) => {
            state.status = GameStatusEnum.PLAYING;
        },

        /**
         * Reset the game to initial state
         */
        resetGame: (state) => {
            const newBoard = new Board().serialize();
            state.sn = DEFAULT_BOARD_SN;
            state.currentPlayer = PlayerTypesEnum.BLUE;
            state.status = GameStatusEnum.PLAYING;
            state.winner = "";
            state.winnerReason = null;
            state.squares = newBoard.squares;
            state.mirrorReserve = initialMirrorReserve();
            state.pendingPlacement = null;
            state.selectedPieceLocation = null;
            state.movementIsLocked = false;
            state.laser = {
                route: [],
                finalLocation: null,
                finalActionType: null
            };
        }
    }
});


// Action creators are generated for each case reducer function
export const {
    togglePlayerTurn,
    finishMovement,
    pause,
    resume,
    setBoardType,
    applyMovement,
    startMirrorPlacement,
    cancelMirrorPlacement,
    rotatePendingPlacement,
    deployMirror,
    selectPiece,
    unselectPiece,
    resetGame,
} = gameSlice.actions;


// Selectors, to allow us to easily select a value from the state, while 
// export const selectAllSquares = state => state.squares;



export default gameSlice.reducer;
