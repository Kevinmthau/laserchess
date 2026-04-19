import { configureStore } from "@reduxjs/toolkit";
import Board, { BLUE_HIDEOUT_LOCATION, RED_LASER_LOCATION } from "./Board";
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

    it("keeps a deflector after its non-reflective side blocks the red laser", () => {
        const board = new Board({ setupNotation: "l+1b7/*/*/*/*/*/*/9L+++" });

        const route = board.getLaserRoute(PlayerTypesEnum.RED);
        const finalLaserPath = route[route.length - 1];
        board.applyLaser(PlayerTypesEnum.RED);

        expect(finalLaserPath.location).toEqual(Location.fromAN("c8").serialize());
        expect(finalLaserPath.actionType).toBe(LaserActionTypesEnum.NOTHING);
        expect(board.getSquare(Location.fromAN("c8")).piece).not.toBeNull();
    });

    it("redirects the red laser when it hits the deflector's white face", () => {
        const board = new Board({ setupNotation: "l+1b+++7/*/*/*/*/*/*/9L+++" });

        const route = board.getLaserRoute(PlayerTypesEnum.RED);
        const deflectPathIndex = route.findIndex((path) => path.location.an === "c8");
        board.applyLaser(PlayerTypesEnum.RED);

        expect(route[deflectPathIndex]?.location).toEqual(Location.fromAN("c8").serialize());
        expect(route[deflectPathIndex]?.actionType).toBe(LaserActionTypesEnum.DEFLECT);
        expect(route[deflectPathIndex + 1]?.location).toEqual(new Location(2, -1).serialize());
        expect(board.getSquare(Location.fromAN("c8")).piece).not.toBeNull();
    });

    it("redirects the blue laser upward when it hits the white face from the right", () => {
        const board = new Board();
        board.deployPiece(new Location(4, 8).serialize(), PieceTypesEnum.DEFLECTOR, PlayerTypesEnum.BLUE, 0);

        const route = board.getLaserRoute(PlayerTypesEnum.BLUE);
        const deflectPathIndex = route.findIndex((path) => {
            return path.location.colIndex === 4 && path.location.rowIndex === 8;
        });
        board.applyLaser(PlayerTypesEnum.BLUE);

        expect(route[deflectPathIndex]?.location).toEqual(new Location(4, 8).serialize());
        expect(route[deflectPathIndex]?.actionType).toBe(LaserActionTypesEnum.DEFLECT);
        expect(route[deflectPathIndex + 1]?.location).toEqual(Location.fromAN("e1").serialize());
        expect(board.getSquare(new Location(4, 8).serialize()).piece).not.toBeNull();
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

    it("keeps a deflector through the reducer finishMovement flow when it blocks", () => {
        const store = configureStore({
            reducer: {
                game: gameReducer
            }
        });

        store.dispatch(setBoardType({ setupNotation: "l+1b7/*/*/*/*/*/*/9L+++" }));
        store.dispatch(finishMovement());

        expect(store.getState().game.squares[0][2].piece).not.toBeNull();
    });

    it("stops the laser on an active-board room object", () => {
        const board = new Board({ setupNotation: "l+9/*/*/*/*/*/*/9L+++" });
        board.deployPiece(Location.fromAN("d8").serialize(), PieceTypesEnum.DEFLECTOR, PlayerTypesEnum.RED, 180);

        const route = board.getLaserRoute(PlayerTypesEnum.RED);
        const finalLaserPath = route[route.length - 1];

        expect(finalLaserPath.location).toEqual(new Location(3, 1).serialize());
        expect(finalLaserPath.actionType).toBe(LaserActionTypesEnum.NOTHING);
    });

    it("stops the laser on an outer-ring room object", () => {
        const board = new Board({ setupNotation: "l+9/*/*/*/*/*/*/9L+++" });
        board.deployPiece(new Location(10, 0).serialize(), PieceTypesEnum.DEFLECTOR, PlayerTypesEnum.RED, 180);

        const route = board.getLaserRoute(PlayerTypesEnum.RED);
        const finalLaserPath = route[route.length - 1];

        expect(finalLaserPath.location).toEqual(new Location(10, 1).serialize());
        expect(finalLaserPath.actionType).toBe(LaserActionTypesEnum.NOTHING);
    });
});

describe("mirror deployment rules", () => {
    it("does not mutate caller-owned board data while moving the burglar", () => {
        const sourceBoard = new Board();
        const sourceOffboardPieces = sourceBoard.offboardPieces;
        const board = new Board({
            squares: sourceBoard.squares,
            offboardPieces: sourceOffboardPieces
        });

        board.applyMovement({
            type: MovementTypesEnum.NORMAL,
            srcLocation: BLUE_HIDEOUT_LOCATION,
            destLocation: new Location(11, 3).serialize()
        });

        const sourceHideoutSquare = sourceOffboardPieces.find((square) => {
            return square.location.colIndex === BLUE_HIDEOUT_LOCATION.colIndex &&
                square.location.rowIndex === BLUE_HIDEOUT_LOCATION.rowIndex;
        });
        const sourceExitSquare = sourceOffboardPieces.find((square) => {
            return square.location.colIndex === 11 && square.location.rowIndex === 3;
        });

        expect(sourceHideoutSquare?.piece?.type).toBe(PieceTypesEnum.KING);
        expect(sourceExitSquare?.piece).toBeNull();
    });

    it("allows reserve mirrors on empty visible squares without room props", () => {
        const board = new Board();

        expect(board.canDeployPiece(Location.fromAN("a8").serialize(), PlayerTypesEnum.BLUE)).toBe(true);
        expect(board.canDeployPiece(Location.fromAN("a6").serialize(), PlayerTypesEnum.BLUE)).toBe(true);
        expect(board.canDeployPiece(Location.fromAN("j2").serialize(), PlayerTypesEnum.RED)).toBe(true);
        expect(board.canDeployPiece(Location.fromAN("e4").serialize(), PlayerTypesEnum.BLUE)).toBe(true);
        expect(board.canDeployPiece(new Location(-1, 0).serialize(), PlayerTypesEnum.BLUE)).toBe(true);
        expect(board.canDeployPiece(new Location(10, 8).serialize(), PlayerTypesEnum.RED)).toBe(true);
        expect(board.canDeployPiece(new Location(-1, 5).serialize(), PlayerTypesEnum.BLUE)).toBe(true);
        expect(board.canDeployPiece(Location.fromAN("a7").serialize(), PlayerTypesEnum.BLUE)).toBe(false);
        expect(board.canDeployPiece(Location.fromAN("d7").serialize(), PlayerTypesEnum.BLUE)).toBe(false);
        expect(board.canDeployPiece(new Location(-2, 4).serialize(), PlayerTypesEnum.BLUE)).toBe(false);
        expect(board.canDeployPiece(new Location(12, 2).serialize(), PlayerTypesEnum.BLUE)).toBe(false);
    });

    it("blocks reflector movement onto room object squares", () => {
        const board = new Board({ setupNotation: "*/2B7/*/*/*/*/*/*" });

        expect(
            board.checkMovePossibility(Location.fromAN("c7"), Location.fromAN("d7")).type
        ).toBe(MovementTypesEnum.INVALID);
    });

    it("allows the burglar to move one square into an open space", () => {
        const board = new Board({ setupNotation: "*/2K7/*/*/*/*/*/*" });

        expect(
            board.checkMovePossibility(Location.fromAN("c7"), Location.fromAN("c6")).type
        ).toBe(MovementTypesEnum.NORMAL);
    });

    it("blocks burglar movement onto room object squares", () => {
        const board = new Board({ setupNotation: "*/2K7/*/*/*/*/*/*" });

        expect(
            board.checkMovePossibility(Location.fromAN("c7"), Location.fromAN("d7")).type
        ).toBe(MovementTypesEnum.INVALID);
    });

    it("opens the front hideout exit while bookshelves flank the burglar", () => {
        const board = new Board();
        const destinations = board.getMovesForPieceAtLocation(BLUE_HIDEOUT_LOCATION)
            .map(({ destLocation }) => `${destLocation.colIndex},${destLocation.rowIndex}`)
            .sort();

        expect(destinations).toEqual([
            "11,2",
            "11,3",
            "11,4",
        ]);
    });

    it("deploys onto an opponent reserved square through the reducer flow", () => {
        const store = configureStore({
            reducer: {
                game: gameReducer
            }
        });

        store.dispatch(setBoardType({ setupNotation: "l+9/*/*/*/*/*/*/9L+++" }));
        store.dispatch(startMirrorPlacement());
        store.dispatch(deployMirror({ location: Location.fromAN("a6").serialize() }));

        const state = store.getState().game;

        expect(state.squares[2][0].piece).not.toBeNull();
        expect(state.squares[2][0].piece.type).toBe(PieceTypesEnum.DEFLECTOR);
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
