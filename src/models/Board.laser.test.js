import { configureStore } from "@reduxjs/toolkit";
import Board from "./Board";
import Location from "./Location";
import { LaserActionTypesEnum, MovementTypesEnum, PlayerTypesEnum } from "./Enums";
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
