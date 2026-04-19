import { LaserDirectionsEnum, PlayerTypesEnum, MovementTypesEnum, LaserActionTypesEnum, PieceTypesEnum, LaserEventsEnum, SquareTypesEnum, WinReasonsEnum } from "./Enums";
import Location from "./Location";
import Piece, { PieceUtils } from "./Piece";
import Square, { SquareUtils } from "./Square";
import SN from "../utils/SN";
import LHAN from "../utils/LHAN";
import { cloneDeep, flatMap, repeat, toLower, toUpper } from "lodash";
import Movement from "./Movement";
import LaserPath from "./LaserPath";
import { point, polygon } from "@turf/helpers";
import isPointInPolygon from "@turf/boolean-point-in-polygon";
import { pieceAnimDuration, pieceAnimEasing } from "../components/BoardPiece";
import {
    ACTIVE_BOARD_COL_OFFSET,
    ACTIVE_BOARD_COLS,
    ACTIVE_BOARD_ROW_OFFSET,
    ACTIVE_BOARD_ROWS,
    BOOKSHELF_PROPS,
    PILLAR_PROPS,
    VISUAL_BOARD_COLS,
    VISUAL_BOARD_ROWS
} from "../constants/boardLayout";


/**
 * @constant
 * Ace
 */
export const DEFAULT_BOARD_SN = "l+9/*/*/*/*/*/*/9L+++";
export const MIRROR_RESERVE_COUNT = 3;

export const DIAMOND_GOAL_ANS = Object.freeze(["e5", "f5", "e4", "f4"]);
const DIAMOND_GOAL_SET = new Set(DIAMOND_GOAL_ANS);
export const isDiamondGoalLocation = (location) => Boolean(location && DIAMOND_GOAL_SET.has(location.an));

const VISUAL_MIN_COL_INDEX = -ACTIVE_BOARD_COL_OFFSET;
const VISUAL_MAX_COL_INDEX = VISUAL_BOARD_COLS - ACTIVE_BOARD_COL_OFFSET - 1;
const VISUAL_MIN_ROW_INDEX = -ACTIVE_BOARD_ROW_OFFSET;
const VISUAL_MAX_ROW_INDEX = VISUAL_BOARD_ROWS - ACTIVE_BOARD_ROW_OFFSET - 1;

export const RED_LASER_LOCATION = Object.freeze(new Location(VISUAL_MIN_COL_INDEX, VISUAL_MIN_ROW_INDEX).serialize());
export const BLUE_LASER_LOCATION = Object.freeze(new Location(VISUAL_MAX_COL_INDEX, VISUAL_MAX_ROW_INDEX).serialize());
export const RED_HIDEOUT_LOCATION = Object.freeze(new Location(-2, 5).serialize());
export const BLUE_HIDEOUT_LOCATION = Object.freeze(new Location(12, 3).serialize());

const RED_LASER_HOME_LOCATION = Object.freeze(Location.fromAN("a8").serialize());
const BLUE_LASER_HOME_LOCATION = Object.freeze(Location.fromAN("j1").serialize());

const locationKey = (location) => `${location.colIndex},${location.rowIndex}`;
const roomPropToBoardLocation = ({ col, row }) => new Location(
    col - ACTIVE_BOARD_COL_OFFSET,
    row - ACTIVE_BOARD_ROW_OFFSET
).serialize();
const RED_HIDEOUT_KEY = locationKey(RED_HIDEOUT_LOCATION);
const BLUE_HIDEOUT_KEY = locationKey(BLUE_HIDEOUT_LOCATION);
const ROOM_OBJECT_LOCATION_KEYS = new Set(
    [...BOOKSHELF_PROPS, ...PILLAR_PROPS].map((prop) => locationKey(roomPropToBoardLocation(prop)))
);
const ROOM_OBJECT_BLOCKED_PIECE_TYPES = new Set([
    PieceTypesEnum.DEFLECTOR,
    PieceTypesEnum.KING
]);
const BLOCKED_VISUAL_KEYS = new Set([
    locationKey(RED_LASER_LOCATION),
    locationKey(BLUE_LASER_LOCATION),
    RED_HIDEOUT_KEY,
    BLUE_HIDEOUT_KEY,
    locationKey(new Location(VISUAL_MIN_COL_INDEX, 7).serialize()),
    locationKey(new Location(VISUAL_MAX_COL_INDEX, 1).serialize())
]);
const isWithinActiveBoard = (location) => (
    location.colIndex >= 0 &&
    location.colIndex < ACTIVE_BOARD_COLS &&
    location.rowIndex >= 0 &&
    location.rowIndex < ACTIVE_BOARD_ROWS
);
const isWithinVisualBoard = (location) => (
    location.colIndex >= VISUAL_MIN_COL_INDEX &&
    location.colIndex <= VISUAL_MAX_COL_INDEX &&
    location.rowIndex >= VISUAL_MIN_ROW_INDEX &&
    location.rowIndex <= VISUAL_MAX_ROW_INDEX
);
const isRoomObjectLocation = (location) => ROOM_OBJECT_LOCATION_KEYS.has(locationKey(location));

const extractLaserPiece = (squares, location) => {
    const square = squares[location.rowIndex]?.[location.colIndex];
    if (!SquareUtils.hasPiece(square) || square.piece.type !== PieceTypesEnum.LASER) {
        return null;
    }

    const piece = cloneDeep(square.piece);
    square.piece = null;
    return piece;
};

const createOuterRingSquares = () => {
    const outerRingSquares = [];

    for (let rowIndex = VISUAL_MIN_ROW_INDEX; rowIndex <= VISUAL_MAX_ROW_INDEX; rowIndex += 1) {
        for (let colIndex = VISUAL_MIN_COL_INDEX; colIndex <= VISUAL_MAX_COL_INDEX; colIndex += 1) {
            const location = new Location(colIndex, rowIndex).serialize();
            if (isWithinActiveBoard(location) || BLOCKED_VISUAL_KEYS.has(locationKey(location))) {
                continue;
            }

            outerRingSquares.push(new Square(SquareTypesEnum.NORMAL, null, location).serialize());
        }
    }

    return outerRingSquares;
};

const createOffboardSquares = (squares, includeHideoutKings = false) => {
    const offboardSquares = createOuterRingSquares();
    const redLaserPiece = extractLaserPiece(squares, RED_LASER_HOME_LOCATION);
    const blueLaserPiece = extractLaserPiece(squares, BLUE_LASER_HOME_LOCATION);

    if (redLaserPiece) {
        offboardSquares.push(
            new Square(
                SquareTypesEnum.LASER_RED,
                redLaserPiece,
                cloneDeep(RED_LASER_LOCATION)
            ).serialize()
        );
    }

    if (blueLaserPiece) {
        offboardSquares.push(
            new Square(
                SquareTypesEnum.LASER_BLUE,
                blueLaserPiece,
                cloneDeep(BLUE_LASER_LOCATION)
            ).serialize()
        );
    }

    if (includeHideoutKings) {
        offboardSquares.push(
            new Square(
                SquareTypesEnum.HIDEOUT_RED,
                new Piece("k", 0).serialize(),
                cloneDeep(RED_HIDEOUT_LOCATION)
            ).serialize(),
            new Square(
                SquareTypesEnum.HIDEOUT_BLUE,
                new Piece("K", 0).serialize(),
                cloneDeep(BLUE_HIDEOUT_LOCATION)
            ).serialize()
        );
    }

    return offboardSquares;
};

/**
 * @constant
 * @type {Object}
 * 
 * Lookup object of individual piece scores.
 */
const PIECE_TO_SCORE = {
    d: 2, // Defender
    b: 1, // Deflector
    s: 0, // Switch
    l: 0 // Laser
    // k: -1000, // King. We ignore adding king's score, because when the king is not present, a default of -1000 will be given and the game is already over.
};


class Board {
    /**
     * @description
     * Intantiate a new board class.
     * 
     * @param {Object} options Use either {@param options.squares} or {@param options.setupNotation}. 
     *                         - Please only pass one of the options. Not both.
     *                         - If both are passed, options.squares will take priority and options.setupNotation will be ignored.
     *                         - If no options object is passed, will initialize the board with the default Ace Board Setup Notation.
     * @param {Array} options.squares Create a new instance of the board class using an already parsed board squares. You may use {@see SN#parse} method to do so.
     * @param {String} options.setupNotation Create a new instance of the board class using a setupNotation
     */
    constructor(options) {
        // Parse the options
        options = options || {};
        if (options.squares) {
            // If squares is provided, prioritize this
            this.squares = options.squares;

        } else if (options.setupNotation) {
            // If setupNotation is provided parse it and set the parsed squares.
            this.squares = SN.parse(options.setupNotation);

        } else {
            // If opts.squares nor opts.setupNotation is provided, use the default (ace) setup notation
            this.squares = SN.parse(DEFAULT_BOARD_SN);
        }
        if (options.offboardPieces) {
            this.offboardPieces = options.offboardPieces;
        } else {
            const includeHideoutKings = !options.squares && (!options.setupNotation || options.setupNotation === DEFAULT_BOARD_SN);
            this.offboardPieces = createOffboardSquares(this.squares, includeHideoutKings);
        }
        this.winner = null;
        this.winnerReason = null;
    }


    /**
     * Get a square from the the current board that is at the specified location
     * ? TODO: validate location
     * 
     * @param {Location} location the location of the square on the board.
     * @returns {Square} the square or null if no square was found on the specified location.
     */
    getSquare(location) {
        const offboardSquare = this.offboardPieces.find(square => locationKey(square.location) === locationKey(location));
        if (offboardSquare) {
            return offboardSquare;
        }

        let row = this.squares[location.rowIndex];
        if (row) {
            let squareAtLocation = row[location.colIndex];
            return squareAtLocation;
        }
        return null;
    }


    /**
     * Get all the squares that contains pieces of the specified player only.
     * 
     * @param {PlayerTypesEnum} player
     * @returns {Array}
     */
    getPlayerSquares(player) {
        const flattenedSquares = [...flatMap(this.squares), ...this.offboardPieces];
        return flattenedSquares.filter((square) => {
            // Filter out the squares with no pieces in it.
            // And only return the pieces of the specified color
            return SquareUtils.hasPiece(square) && square.piece.color === player;
        });
    }


    /**
     * Evaluate a score based on the current board state and pieces available on it for the specified player.
     * @see PIECE_TO_SCORE for the weights of playable piece, used on the evaluation here.
     * 
     * @param {PlayerTypesEnum} playerType the player of whom we want to evaluate the score
     * @returns {number} the score. If game over, return -100.
     */
    getPlayerScore(playerType) {
        let playerScore = 0;
        const squaresOfPlayer = this.getPlayerSquares(playerType);

        // Track the king, to make sure it is is on the board
        let isKingAvailable = false; // we will update this check bellow when we loop through all the pieces on the board

        /**
         * Loop through all of the pieces of this player, and compute the scores 
         * based on our lookup object above 
         * @see PIECE_TO_SCORE the lookup object constant
         */
        squaresOfPlayer.forEach(square => {
            if (square.piece.type === PieceTypesEnum.KING) {
                isKingAvailable = true;
            } else {
                playerScore += PIECE_TO_SCORE[square.piece.type];
            }
        });


        // If the king piece of this color is not in the board.
        // then game over.
        if (!isKingAvailable) {
            return -1000;
        } else {
            return playerScore;
        }
    }


    /**
     * Get the route that the laser will travel when enabled for the specified playerType
     * 
     * @param {PlayerTypesEnum} playerType the player who will applying the laser
     */
    getLaserRoute(playerType) {
        const completeRoute = []; // holds the laser path!

        // Get the laser of the player on the move
        // Starting from the laser, start scanning squares in the direction where laser is pointing.
        const laserSquareLocation = (playerType === PlayerTypesEnum.BLUE) ? BLUE_LASER_LOCATION : RED_LASER_LOCATION;
        const laserSquare = this.getSquare(laserSquareLocation);
        if (SquareUtils.hasPiece(laserSquare)) {
            // Begin!
            // Get the starting laser beam's direction based on the laser piece's orientation
            const laserPiece = laserSquare.piece;
            let direction = SquareUtils.getLaserBeamDirection(laserPiece);

            let colIndex = laserSquareLocation.colIndex;
            let rowIndex = laserSquareLocation.rowIndex;

            // Start scanning in the pointing direction of the laser beam
            let eventType = LaserEventsEnum.START;
            let actionType = LaserActionTypesEnum.NOTHING;

            completeRoute.push(new LaserPath(eventType, direction, actionType, cloneDeep(laserSquareLocation)).serialize()); // start from the player's laser piece.
            while (eventType !== LaserEventsEnum.END) {
                eventType = LaserEventsEnum.CENTRAL;

                let dx, dy;
                if (direction === LaserDirectionsEnum.TOP) {
                    dx = 0;
                    dy = -1;

                } else if (direction === LaserDirectionsEnum.RIGHT) {
                    dx = 1;
                    dy = 0;

                } else if (direction === LaserDirectionsEnum.BOTTOM) {
                    dx = 0;
                    dy = 1;

                } else if (direction === LaserDirectionsEnum.LEFT) {
                    dx = -1;
                    dy = 0;

                }
                colIndex += dx;
                rowIndex += dy;

                // Make sure the indexes are not out of bound from the board.
                if (
                    rowIndex < VISUAL_MIN_ROW_INDEX ||
                    rowIndex > VISUAL_MAX_ROW_INDEX ||
                    colIndex < VISUAL_MIN_COL_INDEX ||
                    colIndex > VISUAL_MAX_COL_INDEX
                ) {
                    // If it is out of bound. Stop the laser right here
                    eventType = LaserEventsEnum.END;
                    completeRoute.push(new LaserPath(eventType, null, actionType, new Location(colIndex, rowIndex).serialize()).serialize());
                    continue;
                }

                // Get the square in the scanning location!
                const nextScanningSquareLocation = new Location(colIndex, rowIndex);
                const nextScanningSquare = this.getSquare(nextScanningSquareLocation);

                // Check if it has a piece in this square
                if (SquareUtils.hasPiece(nextScanningSquare)) {
                    // If piece was found, check what we have to do, based on the Laser Hit Action Notation of the piece in the scanning square
                    const action = LHAN.getHitAction(direction, nextScanningSquare.piece);
                    if (action.type === LaserActionTypesEnum.KILL) {
                        // The piece in this square should be killed/eaten/captured.
                        eventType = LaserEventsEnum.END; // end the scanning, we reached the limit for this laser beam.

                    } else if (action.type === LaserActionTypesEnum.DEFLECT) {
                        // The piece in this square changes the direction of my laser beam.
                        direction = action.newDirection;

                    } else if (action.type === LaserActionTypesEnum.NOTHING) {
                        // The piece in this square is probably (1) another laser or (2) a defender
                        // So, do nothing! Stop the laser now.
                        eventType = LaserEventsEnum.END;
                    }
                    actionType = action.type;

                } else {
                    // Continue if no piece in the scanning square.
                    // Did nothing.
                    actionType = LaserActionTypesEnum.NOTHING;
                }

                completeRoute.push(new LaserPath(eventType, direction, actionType, nextScanningSquareLocation.serialize()).serialize());
            }
        }
        return completeRoute;
    }


    /**
     * Returns all moves for all of the pieces of the specified player.
     * 
     * @param {PlayerTypesEnum} playerType
     * @returns {Movement[]}
     */
    getMovesForPlayer(playerType) {
        const moves = [];
        const squaresOfPlayer = this.getPlayerSquares(playerType);
        squaresOfPlayer.forEach(square => {
            const movesForPiece = this.getMovesForPieceAtLocation(square.location);
            if (movesForPiece.length !== 0) {
                // append if there are any moves available for said piece
                moves.push(...movesForPiece);
            }
        });
        return moves;
    }


    /**
     * Get all moves for a particular piece at the specified location
     * 
     * @param {Location} location the location on which the piece to get the moves is.
     * @returns {Movement[]} a list of all Movement possible for the piece in that location
     */
    getMovesForPieceAtLocation(location) {
        const moves = [];

        this.getAdjacentLocations(location).forEach((possibleDestLocation) => {
            const movePossibility = this.checkMovePossibility(location, possibleDestLocation);

            if (movePossibility.type !== MovementTypesEnum.INVALID) {
                // Only return moves that are possible
                moves.push(movePossibility);
            }
        });

        // TODO: add rotation possibility as well
        return moves;
    }

    getAdjacentLocations(location) {
        const srcX = location.colIndex;
        const srcY = location.rowIndex;

        return [
            [srcX - 1, srcY - 1],
            [srcX + 0, srcY - 1],
            [srcX + 1, srcY - 1],
            [srcX + 1, srcY + 0],
            [srcX + 1, srcY + 1],
            [srcX + 0, srcY + 1],
            [srcX - 1, srcY + 1],
            [srcX - 1, srcY + 0],
        ]
            .filter(([colIndex, rowIndex]) => isWithinVisualBoard({ colIndex, rowIndex }))
            .map(([colIndex, rowIndex]) => new Location(colIndex, rowIndex));
    }

    /**
     * Checks if a specific movement is possible into that square.
     * Allows special move for Switch piece.
     * 
     * TODO: add rotation possibility as well
     *
     * @param {Location} srcLocation the square from where we are moving from.
     * @param {Location} destLocation the square to where we are moving.
     * @returns {Movement} which can contain a type of MovementTypesEnum#INVALID when the move is not possible
     */
    checkMovePossibility(srcLocation, destLocation) {
        const squareAtSrc = this.getSquare(srcLocation);
        const squareAtDest = this.getSquare(destLocation);

        // todo: remove the last OR statement, and add draggable={piece is not laser} instead in BoardPiece
        if ((squareAtDest === null) || (squareAtSrc === null) || (squareAtSrc.piece.type === PieceTypesEnum.LASER)) {
            // Invalid destLocation, as it has no square there. Most likely this is out of bound.
            // Or, we are trying to move a Laser Piece, which is not a possible move according to the rules of the game.
            // Return as not possible to move.
            return new Movement(MovementTypesEnum.INVALID, srcLocation, destLocation);
        }

        const pieceTypeAtSrc = squareAtSrc.piece.type;
        const pieceTypeAtDest = squareAtDest.piece ? squareAtDest.piece.type : null;
        const pieceColorAtSrc = squareAtSrc.piece.color;

        if (!this.canPlayerOccupySquare(squareAtDest, pieceColorAtSrc, pieceTypeAtSrc)) {
            return new Movement(MovementTypesEnum.INVALID, srcLocation, destLocation);
        }

        // Special Move (swap)
        if ((pieceTypeAtSrc === PieceTypesEnum.SWITCH) &&
            (pieceTypeAtDest === PieceTypesEnum.DEFENDER || pieceTypeAtDest === PieceTypesEnum.DEFLECTOR)) {
            // If the piece is a switch, 
            // allow swap if the destination piece is either a defender or deflector of any color!
            return new Movement(MovementTypesEnum.SPECIAL, srcLocation, destLocation);

        } else {
            // Normal movement (to an empty neighbor square)

            // Check if we are moving to a reserved square, and make sure only the correct color can go there.
            if (SquareUtils.hasPiece(squareAtDest)) {
                // Trying to move into a square which already has a piece (and is not a valid swap).
                // Invalid move
                return new Movement(MovementTypesEnum.INVALID, srcLocation, destLocation);

            } else {
                return new Movement(MovementTypesEnum.NORMAL, srcLocation, destLocation);
            }
        }
    }


    // Setters

    /**
     * Apply a movement to this board
     * @param {Movement} movement the movement to be applied on the board
     */
    applyMovement(movement) {
        // Check what type of move is being performed
        if (movement.type === MovementTypesEnum.DEPLOY) {
            this.deployPiece(movement.destLocation, movement.pieceType, movement.playerType, movement.orientation);
            return;
        }

        const squareAtSrc = this.getSquare(movement.srcLocation);
        if (movement.type === MovementTypesEnum.NORMAL) { // dislocate
            // Normal movement (from one square to an empty one)
            const squareAtDest = this.getSquare(movement.destLocation);
            // Move the piece from the src to dest.
            squareAtDest.piece = squareAtSrc.piece;
            squareAtSrc.piece = null;
            this.applyDiamondObjective(squareAtDest);

        } else if (movement.type === MovementTypesEnum.ROTATION_CLOCKWISE) {
            // Rotation movement (clockwise)
            const clockwise = true;
            PieceUtils.applyRotation(squareAtSrc.piece, clockwise);

        } else if (movement.type === MovementTypesEnum.ROTATION_C_CLOCKWISE) {
            // Rotation movement (counter-clockwise)
            const c_clockwise = false;
            PieceUtils.applyRotation(squareAtSrc.piece, c_clockwise);

        } else if (movement.type === MovementTypesEnum.SPECIAL) {
            // Special movement (Switch piece is swapping places with either a Deflector or Defender piece)
            const squareAtDest = this.getSquare(movement.destLocation);

            // Swap the pieces.
            const squareAtSrcPiece = squareAtSrc.piece;
            squareAtSrc.piece = squareAtDest.piece;
            squareAtDest.piece = squareAtSrcPiece;

        }
    }


    /**
     * Applies a resolved laser hit to the current board.
     *
     * @param {LaserActionTypesEnum} actionType the final action resolved for the laser route.
     * @param {Location|Object} location the final location reached by the laser route.
     */
    applyLaserHit(actionType, location) {
        if (actionType !== LaserActionTypesEnum.KILL || !location) {
            return;
        }

        const squareAtHit = this.getSquare(location);
        if (!SquareUtils.hasPiece(squareAtHit)) {
            return;
        }

        // Check if we killed the King!
        if (squareAtHit.piece.type === PieceTypesEnum.KING) {
            // Oh lord, the king is dead, I repeat, the king is dead!
            // Check which king is dead and declare the winner! 🏴‍☠️
            const winnerPlayerColor = squareAtHit.piece.color === PlayerTypesEnum.BLUE ? PlayerTypesEnum.RED : PlayerTypesEnum.BLUE;
            this.winner = winnerPlayerColor;
            this.winnerReason = WinReasonsEnum.LASER;
        }

        // Remove the piece from the square.
        squareAtHit.piece = null;
    }


    /**
     * Applies the laser hit action notation in the current board.
     * 
     * @param {PlayerTypesEnum} playerType the player whose laser is being switched on.
     * @returns {number[][]} the
     */
    applyLaser(playerType) {
        if (!playerType) {
            throw new Error("applyLaser - Please specify the player whose laser is being switched on.");
        }

        // Compute the laser beam route, and do actions on the necessary pieces.
        const laserRoute = this.getLaserRoute(playerType);
        const finalLaserPath = laserRoute[laserRoute.length - 1];

        this.applyLaserHit(finalLaserPath.actionType, finalLaserPath.location);
    }


    /**
     * Returns a new board from move without modifying current board.
     * @param {Movement} movement the movement being performed on the board
     * @param {PlayerTypesEnum} playerType the player that is moving
     */
    newBoardFromMovement(movement, playerType) {
        const newBoard = new Board({
            squares: cloneDeep(this.squares),
            offboardPieces: cloneDeep(this.offboardPieces)
        });
        newBoard.applyMovement(movement);
        if (!newBoard.winner) {
            newBoard.applyLaser(playerType);
        }
        return newBoard;
    }


    /**
     * Converts the current board into Setup Notation string.
     * @returns {string} SN string
     */
    toSN() {
        let sn = "";
        let emptySquaresCount = 0;

        this.squares.forEach((row, rowIndex) => {
            row.forEach((square, colIndex) => {
                if (SquareUtils.hasPiece(square)) {
                    if (emptySquaresCount > 0) {
                        sn += `${emptySquaresCount}`;
                        emptySquaresCount = 0;
                    }

                    // type?
                    if (square.piece.color === PlayerTypesEnum.BLUE) {
                        // Blue uses upper case letters for piece type representation (L D B K S)
                        sn += toUpper(square.piece.type);

                    } else {
                        // Red uses lower case letter for piece type representation (l d b k s);
                        sn += toLower(square.piece.type);
                    }

                    // orientation?
                    const orientation = square.piece.orientation;
                    sn += repeat("+", orientation / 90);

                } else {
                    emptySquaresCount += 1;
                }
            });

            if (emptySquaresCount > 0) {
                sn += `${emptySquaresCount === 10 ? "*" : emptySquaresCount}`; // on 10 empty spaces show "*" instead of (10)
                emptySquaresCount = 0; // reset
            }

            // Append / to sepparate rows, but not at the end of the notation.
            if (rowIndex !== 7) {
                sn += "/"; // separates the rows
            }
        });
        return sn;
    }


    /**
     * Serializes the Board object into an Object.
     * @returns {Object} plain object, representing this instance
     */
    serialize() {
        return {
            winner: this.winner,
            winnerReason: this.winnerReason,
            squares: this.squares,
            offboardPieces: this.offboardPieces,
            sn: this.toSN() // setup notation
        };
    }

    applyDiamondObjective(squareAtDest) {
        if (
            SquareUtils.hasPiece(squareAtDest) &&
            squareAtDest.piece.type === PieceTypesEnum.KING &&
            isDiamondGoalLocation(squareAtDest.location)
        ) {
            this.winner = squareAtDest.piece.color;
            this.winnerReason = WinReasonsEnum.DIAMOND;
        }
    }

    canPlayerOccupySquare(square, playerType, pieceType) {
        if (!square) {
            return false;
        }

        if (ROOM_OBJECT_BLOCKED_PIECE_TYPES.has(pieceType) && isRoomObjectLocation(square.location)) {
            return false;
        }

        if (square.type === SquareTypesEnum.RESERVED_BLUE && playerType !== PlayerTypesEnum.BLUE) {
            return false;
        }

        if (square.type === SquareTypesEnum.RESERVED_RED && playerType !== PlayerTypesEnum.RED) {
            return false;
        }

        if (square.type === SquareTypesEnum.HIDEOUT_RED) {
            return playerType === PlayerTypesEnum.RED && pieceType === PieceTypesEnum.KING;
        }

        if (square.type === SquareTypesEnum.HIDEOUT_BLUE) {
            return playerType === PlayerTypesEnum.BLUE && pieceType === PieceTypesEnum.KING;
        }

        if (isDiamondGoalLocation(square.location) && pieceType !== PieceTypesEnum.KING) {
            return false;
        }

        return true;
    }

    canDeployPiece(location, _playerType, pieceType = PieceTypesEnum.DEFLECTOR) {
        const squareAtDest = this.getSquare(location);
        if (!squareAtDest || SquareUtils.hasPiece(squareAtDest)) {
            return false;
        }

        if (pieceType === PieceTypesEnum.DEFLECTOR && isRoomObjectLocation(squareAtDest.location)) {
            return false;
        }

        return true;
    }

    getDeployLocationsForPlayer(playerType, pieceType = PieceTypesEnum.DEFLECTOR) {
        return [...flatMap(this.squares), ...this.offboardPieces]
            .filter(square => this.canDeployPiece(square.location, playerType, pieceType))
            .map(square => square.location);
    }

    deployPiece(location, pieceType, playerType, orientation = 0) {
        const normalizedPieceType = pieceType.toLowerCase();
        if (!this.canDeployPiece(location, playerType, normalizedPieceType)) {
            return false;
        }

        const pieceNotationType = playerType === PlayerTypesEnum.BLUE ? toUpper(normalizedPieceType) : toLower(normalizedPieceType);
        const squareAtDest = this.getSquare(location);
        squareAtDest.piece = new Piece(pieceNotationType, orientation).serialize();
        return true;
    }


    // CLI Related (dev only)

    /**
     * Logs a prettier version of SN into the CLI
     */
    _viewInCLI() {
        let sn = "";
        let emptySquaresCount = 0;

        this.squares.forEach((row, rowIndex) => {
            row.forEach((square, colIndex) => {
                if (SquareUtils.hasPiece(square)) {

                    if (emptySquaresCount > 0) {
                        sn += `${emptySquaresCount}`;
                        emptySquaresCount = 0;
                    }

                    // type?
                    if (square.piece.color === PlayerTypesEnum.BLUE) {
                        // Blue uses upper case letters for piece type representation (L D B K S)
                        sn += toUpper(square.piece.type);

                    } else {
                        // Red uses lower case letter for piece type representation (l d b k s);
                        sn += toLower(square.piece.type);
                    }

                    sn += " ";

                    // orientation?
                    // const orientation = square.piece.orientation;
                    // sn += _.repeat("+", orientation / 90);

                } else {
                    sn += ". ";
                }
            });

            // Append / to sepparate rows, but not at the end of the notation.
            if (rowIndex !== 7) {
                sn += "\n"; // separates the rows
            }
        });
        console.log(sn);
    }


    /**
     * Check if a piece a srcLocation is moving to a neighboring location.
     * Uses the point-in-polygon concept.
     * 
     * @param {Location} srcLocation the source location
     * @param {Location} destLocation the destination location
     * @returns {boolean} true if the destLocation square is a neighboring square, otherwise false for every other square.
     */
    static isMovingToNeighborSquare(srcLocation, destLocation) {
        /**
         * Minimum squares to be moved to, given xy as srcLocation
         * 
         * -x-y | x-y | +x-y
         *  -xy | xy  | +xy
         * -x+y | x+y | +x+y
         */
        const srcX = srcLocation.colIndex;
        const srcY = srcLocation.rowIndex;
        const destX = destLocation.colIndex;
        const destY = destLocation.rowIndex;

        /**
         * A polygon containing the possible moving squares for the srcLocation.
         * That is, the neighbouring squares.
         * 
         *
         * -----------
         * |a| | | |d|
         * -----------
         * | | |x| | |
         * -----------
         * |b| | | |c|
         * -----------
         * Where X is our srcLocation.
         * 
         * @see https://github.com/kishannareshpal/laserchess/blob/master/docs/Guide.md#How-to-play-steps
         */
        const possiblePoly = polygon([[
            [srcX - 1, srcY - 1], // a
            [srcX - 1, srcY + 1], // b
            [srcX + 1, srcY + 1], // c
            [srcX + 1, srcY - 1], // d
            [srcX - 1, srcY - 1] // closing point – back to a
        ]]);

        // Check if the destLocation is one of the neighboring squares of the srcLocation
        const destPoint = point([destX, destY]); // x
        return isPointInPolygon(destPoint, possiblePoly);
    }



    /**
     * Get flattened xy points from the laser route, that is used in the board's laser drawing.
     * 
     * @param {LaserPath[]} route the route travelled by the laser. Use { #getLaserRoute() }
     * @param {number} cellSize the size of indidual cells of the board.
     * @returns {number[]} a flattened array of the x,y coordinates for the laser to be drawn in the board.
     */
    static linePointsFromLaserRoute(laserRoute, cellSize) {
        const points = laserRoute.map(path => {
            let x, y;
            if ((path.eventType === LaserEventsEnum.START) || (path.eventType === LaserEventsEnum.END)) {
                // Start from the middle of the laser piece,
                y = path.location.rowIndex * cellSize + (cellSize / 2);
                x = path.location.colIndex * cellSize + (cellSize / 2);

            } else if (path.eventType === LaserEventsEnum.CENTRAL) {
                // Laser is going ways....
                if (path.direction === LaserDirectionsEnum.TOP) {
                    // going top
                    if (path.actionType === LaserActionTypesEnum.DEFLECT) {
                        x = path.location.colIndex * cellSize + (cellSize / 2);
                        y = path.location.rowIndex * cellSize + (cellSize / 2);

                    } else if (path.actionType === LaserActionTypesEnum.NOTHING) {
                        x = path.location.colIndex * cellSize + (cellSize / 2);
                        y = path.location.rowIndex * cellSize;
                    }

                } else if (path.direction === LaserDirectionsEnum.LEFT) {
                    // going left
                    if (path.actionType === LaserActionTypesEnum.DEFLECT) {
                        x = path.location.colIndex * cellSize + (cellSize / 2);
                        y = path.location.rowIndex * cellSize + (cellSize / 2);

                    } else if (path.actionType === LaserActionTypesEnum.NOTHING) {
                        x = path.location.colIndex * cellSize;
                        y = path.location.rowIndex * cellSize + (cellSize / 2);
                    }

                } else if (path.direction === LaserDirectionsEnum.RIGHT) {
                    // going right
                    if (path.actionType === LaserActionTypesEnum.DEFLECT) {
                        x = path.location.colIndex * cellSize + (cellSize / 2);
                        y = path.location.rowIndex * cellSize + (cellSize / 2);

                    } else if (path.actionType === LaserActionTypesEnum.NOTHING) {
                        x = path.location.colIndex * cellSize + cellSize;
                        y = path.location.rowIndex * cellSize + (cellSize / 2);
                    }

                } else if (path.direction === LaserDirectionsEnum.BOTTOM) {
                    // going bottom
                    if (path.actionType === LaserActionTypesEnum.DEFLECT) {
                        x = path.location.colIndex * cellSize + (cellSize / 2);
                        y = path.location.rowIndex * cellSize + (cellSize / 2);

                    } else if (path.actionType === LaserActionTypesEnum.NOTHING) {
                        x = path.location.colIndex * cellSize + (cellSize / 2);
                        y = path.location.rowIndex * cellSize + cellSize;
                    }
                }
            }
            return [x, y];
        });

        return flatMap(points);
    }



    /**
     * Simply presents a piece movement visually on the canvas stage.
     * 
     * @param {Ref} stagePiecesRef React.Ref of the layer where the board pieces are drawn in the canvas
     * @param {Movement} movement The movement being performed
     * @param {number} cellSize The width of individual squares of the board
     */
    static presentPieceMovement(stagePiecesRef, movement, cellSize) {
        const [srcBoardPiece] = stagePiecesRef.current.find(`#${movement.srcLocation.an}`);

        // Check the type of movement, which could be either "special" or "normal"
        if (movement.type === MovementTypesEnum.SPECIAL) {
            const [destBoardPiece] = stagePiecesRef.current.find(`#${movement.destLocation.an}`);
            // Special move (Switch can swap)
            // Swap the piece from destLocation with the piece at srcLocation!
            // - First move the piece from src to dest
            srcBoardPiece.to({
                x: Location.getX(movement.destLocation.colIndex, cellSize),
                y: Location.getY(movement.destLocation.rowIndex, cellSize),
                duration: pieceAnimDuration,
                easing: pieceAnimEasing
            });
            // - Now move the piece from src to dest
            destBoardPiece.to({
                x: Location.getX(movement.srcLocation.colIndex, cellSize),
                y: Location.getY(movement.srcLocation.rowIndex, cellSize),
                duration: pieceAnimDuration,
                easing: pieceAnimEasing
            });

        } else if (movement.type === MovementTypesEnum.NORMAL) {
            // Normal move (moving to a new empty target square)
            // - Just put the piece from src in dest square
            srcBoardPiece.to({
                x: Location.getX(movement.destLocation.colIndex, cellSize),
                y: Location.getY(movement.destLocation.rowIndex, cellSize),
                duration: pieceAnimDuration,
                easing: pieceAnimEasing
            });

        } else if (movement.type === MovementTypesEnum.ROTATION_CLOCKWISE) {
            const prevOrientation = srcBoardPiece.rotation();
            srcBoardPiece.to({
                rotation: prevOrientation + 90,
                duration: pieceAnimDuration,
                easing: pieceAnimEasing
            });

        } else if (movement.type === MovementTypesEnum.ROTATION_C_CLOCKWISE) {
            const prevOrientation = srcBoardPiece.rotation();
            srcBoardPiece.to({
                rotation: prevOrientation - 90,
                duration: pieceAnimDuration,
                easing: pieceAnimEasing
            });
        }
    }
}

export default Board;
