import { configureStore } from "@reduxjs/toolkit";
import Board, { RED_LASER_LOCATION } from "./Board";
import Location from "./Location";
import { LaserActionTypesEnum, MovementTypesEnum, PieceTypesEnum, PlayerTypesEnum } from "./Enums";
import gameReducer, {
    applyMovement,
    deployMirror,
    finishMovement,
    setBoardType,
    startMirrorPlacement
} from "../redux/slices/gameSlice";

describe("laser blocker resolution", () => {
    it("keeps a blocker directly in the red laser path", () => {
        const board = new Board({ setupNotation: "l++9/d9/*/*/*/*/*/9L" });

        board.applyLaser(PlayerTypesEnum.RED);

        expect(board.getSquare(Location.fromAN("a7")).piece).not.toBeNull();
    });

    it("keeps a blocker through the reducer finishMovement flow", () => {
        const store = configureStore({
            reducer: {
                game: gameReducer
            }
        });

        store.dispatch(setBoardType({ setupNotation: "l++9/*/*/*/*/*/9D+/9L" }));
        store.dispatch(finishMovement());

        expect(store.getState().game.squares[6][9].piece).not.toBeNull();
    });

    it("keeps a blocker after a moved mirror deflects the blue laser into it", () => {
        const store = configureStore({
            reducer: {
                game: gameReducer
            }
        });

        store.dispatch(setBoardType({ setupNotation: "l++9/*/*/*/*/8B1/8D1/9L" }));
        store.dispatch(applyMovement({
            movement: {
                type: MovementTypesEnum.NORMAL,
                srcLocation: Location.fromAN("i3").serialize(),
                destLocation: Location.fromAN("j2").serialize()
            }
        }));
        store.dispatch(finishMovement());

        expect(store.getState().game.squares[6][8].piece).not.toBeNull();
    });

    it("keeps a blocker after a reserve mirror deflects the blue laser into it", () => {
        const store = configureStore({
            reducer: {
                game: gameReducer
            }
        });

        store.dispatch(setBoardType({ setupNotation: "l++9/*/*/*/*/*/8D1/9L" }));
        store.dispatch(startMirrorPlacement());
        store.dispatch(deployMirror({ location: Location.fromAN("j2").serialize() }));
        store.dispatch(finishMovement());

        expect(store.getState().game.squares[6][8].piece).not.toBeNull();
    });

    it("does not remove a blocker when finishing movement from stored laser state", () => {
        const boardState = gameReducer(undefined, setBoardType({ setupNotation: "l++9/*/*/*/*/*/8D1/9L" }));

        const finishedState = gameReducer({
            ...boardState,
            laser: {
                route: [],
                finalActionType: LaserActionTypesEnum.NOTHING,
                finalLocation: Location.fromAN("i2").serialize()
            }
        }, finishMovement());

        expect(finishedState.squares[6][8].piece).not.toBeNull();
    });
});

describe("mirror deployment rules", () => {
    it("allows reserve mirrors on any empty visible square", () => {
        const board = new Board();

        expect(board.canDeployPiece(Location.fromAN("a8").serialize(), PlayerTypesEnum.BLUE)).toBe(true);
        expect(board.canDeployPiece(Location.fromAN("a7").serialize(), PlayerTypesEnum.BLUE)).toBe(true);
        expect(board.canDeployPiece(Location.fromAN("j2").serialize(), PlayerTypesEnum.RED)).toBe(true);
        expect(board.canDeployPiece(Location.fromAN("e4").serialize(), PlayerTypesEnum.BLUE)).toBe(true);
        expect(board.canDeployPiece(new Location(-1, 0).serialize(), PlayerTypesEnum.BLUE)).toBe(true);
        expect(board.canDeployPiece(new Location(10, 8).serialize(), PlayerTypesEnum.RED)).toBe(true);
    });

    it("deploys onto an opponent reserved square through the reducer flow", () => {
        const store = configureStore({
            reducer: {
                game: gameReducer
            }
        });

        store.dispatch(setBoardType({ setupNotation: "l+9/*/*/*/*/*/*/9L+++" }));
        store.dispatch(startMirrorPlacement());
        store.dispatch(deployMirror({ location: Location.fromAN("a7").serialize() }));

        const state = store.getState().game;

        expect(state.squares[1][0].piece).not.toBeNull();
        expect(state.squares[1][0].piece.type).toBe(PieceTypesEnum.DEFLECTOR);
        expect(state.mirrorReserve[PlayerTypesEnum.BLUE]).toBe(2);
    });

    it("deploys onto the outer ring through the reducer flow", () => {
        const store = configureStore({
            reducer: {
                game: gameReducer
            }
        });

        const location = new Location(-1, 0).serialize();

        store.dispatch(setBoardType());
        store.dispatch(startMirrorPlacement());
        store.dispatch(deployMirror({ location }));

        const state = store.getState().game;
        const placedMirror = state.offboardPieces.find((square) => {
            return square.location.colIndex === location.colIndex && square.location.rowIndex === location.rowIndex;
        });

        expect(placedMirror?.piece).not.toBeNull();
        expect(placedMirror?.piece?.type).toBe(PieceTypesEnum.DEFLECTOR);
        expect(state.mirrorReserve[PlayerTypesEnum.BLUE]).toBe(2);
    });
});

describe("laser routing on the visible board", () => {
    it("starts from the visible laser square and scans the outer ring", () => {
        const board = new Board();
        const route = board.getLaserRoute(PlayerTypesEnum.RED);

        expect(route[0].location).toEqual(RED_LASER_LOCATION);
        expect(route[1].location).toEqual(new Location(-1, 0).serialize());
    });
});
