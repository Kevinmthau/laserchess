import React, { useCallback } from "react";
import { Circle, Group, Layer, Line, Rect, RegularPolygon } from "react-konva";
import { LaserActionTypesEnum, PieceTypesEnum, PlayerTypesEnum, SquareTypesEnum } from "../models/Enums";
import Location from "../models/Location";
import { useDispatch, useSelector } from "react-redux";
import BoardPiece, { pieceAnimDuration, pieceAnimEasing } from "./BoardPiece";
import { SquareUtils } from "../models/Square";
import { flatMap, isEmpty } from "lodash";
import { applyMovement, deployMirror, selectPiece, unselectPiece } from "../redux/slices/gameSlice";
import Board, { isDiamondGoalLocation } from "../models/Board";
import PieceMoveHighlight from "./PieceMoveHighlight";
import {
    ACTIVE_BOARD_COL_OFFSET,
    ACTIVE_BOARD_COLS,
    ACTIVE_BOARD_ROW_OFFSET,
    ACTIVE_BOARD_ROWS,
    VISUAL_BOARD_COLS,
    VISUAL_BOARD_ROWS
} from "../constants/boardLayout";

const BASE_SQUARE_PALETTE = {
    fill: "#34385B",
    insetFill: "#434A6B",
    stroke: "rgba(192, 204, 255, 0.06)",
    marker: "rgba(243, 247, 255, 0.14)"
};

const getSquarePalette = (square) => {
    if (isDiamondGoalLocation(square.location)) {
        return BASE_SQUARE_PALETTE;
    }

    switch (square.type) {
        case SquareTypesEnum.LASER_BLUE:
        case SquareTypesEnum.LASER_RED:
        case SquareTypesEnum.RESERVED_BLUE:
        case SquareTypesEnum.RESERVED_RED:
            return BASE_SQUARE_PALETTE;
        default:
            return BASE_SQUARE_PALETTE;
    }
};

const TOP_WINDOWS = [
    { x: 1.02, width: 1.12, tint: "#CFE3FF" },
    { x: 3.78, width: 1.12, tint: "#D8F0FF" },
    { x: 6.26, width: 2.5, tint: "#CFE7FF" },
    { x: 10.16, width: 1.12, tint: "#C9E1FF" },
    { x: 12.92, width: 1.12, tint: "#A5B7FF" }
];

const BOOKSHELF_PROPS = [
    { col: 2, row: 1, width: 0.72, height: 0.72 },
    { col: 12, row: 1, width: 0.72, height: 0.72 },
    { col: 13, row: 3, width: 0.72, height: 0.72 },
    { col: 1, row: 5, width: 0.72, height: 0.72 },
    { col: 2, row: 7, width: 0.72, height: 0.72 },
    { col: 12, row: 7, width: 0.72, height: 0.72 }
];

const PILLAR_PROPS = [
    { col: 5, row: 1 },
    { col: 8, row: 1 },
    { col: 5, row: 6 },
    { col: 9, row: 6 }
];

const CENTER_DIAMOND_COL = Math.floor(VISUAL_BOARD_COLS / 2);
const CENTER_DIAMOND_ROW = Math.floor(VISUAL_BOARD_ROWS / 2);

const BoardLayer = ({ reference, cellSize, onBoardPieceMove }) => {
    const dispatch = useDispatch();
    const squares = useSelector(state => state.game.squares);
    const flattenedSquares = useSelector(state => flatMap(state.game.squares));
    const movementIsLocked = useSelector(state => state.game.movementIsLocked);
    const currentPlayer = useSelector(state => state.game.currentPlayer);
    const selectedPieceLocation = useSelector(state => state.game.selectedPieceLocation);
    const pendingPlacement = useSelector(state => state.game.pendingPlacement);
    const laser = useSelector(state => state.game.laser);
    const placementModeActive = Boolean(pendingPlacement);
    const activeBoardOriginX = ACTIVE_BOARD_COL_OFFSET * cellSize;
    const activeBoardOriginY = ACTIVE_BOARD_ROW_OFFSET * cellSize;
    const blueCornerColIndex = VISUAL_BOARD_COLS - 1;
    const blueCornerRowIndex = VISUAL_BOARD_ROWS - 1;

    const drawBoardBackdrop = useCallback(() => {
        const kings = flattenedSquares
            .filter(square => SquareUtils.hasPiece(square) && square.piece.type === PieceTypesEnum.KING)
            .map(square => ({
                color: square.piece.color,
                x: activeBoardOriginX + ((square.location.colIndex + 0.5) * cellSize),
                y: activeBoardOriginY + ((square.location.rowIndex + 0.5) * cellSize)
            }));

        return (
            <Group listening={false}>
                <Rect
                    x={0}
                    y={0}
                    width={cellSize * VISUAL_BOARD_COLS}
                    height={cellSize * VISUAL_BOARD_ROWS}
                    fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                    fillLinearGradientEndPoint={{ x: cellSize * VISUAL_BOARD_COLS, y: cellSize * VISUAL_BOARD_ROWS }}
                    fillLinearGradientColorStops={[0, "#3F4168", 0.18, "#4B4A73", 0.42, "#323B67", 0.72, "#232E57", 1, "#1B2448"]}
                />
                <Rect
                    x={0}
                    y={0}
                    width={cellSize * VISUAL_BOARD_COLS}
                    height={cellSize * 1.06}
                    fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                    fillLinearGradientEndPoint={{ x: cellSize * VISUAL_BOARD_COLS, y: 0 }}
                    fillLinearGradientColorStops={[0, "#3A335E", 0.34, "#6A6487", 0.7, "#4F4C78", 1, "#2D2750"]}
                />
                <Line
                    points={[0, cellSize * 0.98, cellSize * VISUAL_BOARD_COLS, cellSize * 0.98]}
                    stroke="rgba(132, 176, 255, 0.5)"
                    strokeWidth={2}
                    opacity={0.5}
                />
                <Rect
                    x={0}
                    y={cellSize * 8.12}
                    width={cellSize * VISUAL_BOARD_COLS}
                    height={cellSize * 0.88}
                    fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                    fillLinearGradientEndPoint={{ x: 0, y: cellSize * 0.88 }}
                    fillLinearGradientColorStops={[0, "rgba(25, 24, 46, 0)", 0.14, "rgba(36, 28, 54, 0.5)", 1, "#1F1934"]}
                />
                {TOP_WINDOWS.map((window, index) => (
                    <Group
                        key={`top-window-${index}`}
                        x={window.x * cellSize}
                        y={cellSize * 0.04}
                        listening={false}
                    >
                        <Rect
                            width={window.width * cellSize}
                            height={cellSize * 0.34}
                            cornerRadius={cellSize * 0.03}
                            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                            fillLinearGradientEndPoint={{ x: 0, y: cellSize * 0.34 }}
                            fillLinearGradientColorStops={[0, "#E8F1FF", 0.38, window.tint, 1, "#7383B0"]}
                            stroke="rgba(229, 238, 255, 0.32)"
                            strokeWidth={1}
                            shadowEnabled={true}
                            shadowColor={window.tint}
                            shadowBlur={12}
                            shadowOpacity={0.28}
                        />
                        <Line
                            points={[
                                cellSize * 0.12,
                                cellSize * 0.08,
                                cellSize * 0.36,
                                cellSize * 0.28
                            ]}
                            stroke="rgba(255, 255, 255, 0.46)"
                            strokeWidth={1}
                            lineCap="round"
                        />
                    </Group>
                ))}
                <Circle
                    x={activeBoardOriginX + (cellSize * 3.3)}
                    y={activeBoardOriginY + (cellSize * 4.2)}
                    radius={cellSize * 2.2}
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndRadius={cellSize * 2.2}
                    fillRadialGradientColorStops={[0, "rgba(255, 108, 127, 0.28)", 1, "rgba(255, 108, 127, 0)"]}
                />
                <Circle
                    x={cellSize * 12.4}
                    y={cellSize * 3.8}
                    radius={cellSize * 2.6}
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndRadius={cellSize * 2.6}
                    fillRadialGradientColorStops={[0, "rgba(86, 182, 255, 0.26)", 1, "rgba(86, 182, 255, 0)"]}
                />
                {kings.map((king, index) => {
                    const isBlue = king.color === PlayerTypesEnum.BLUE;
                    const color = isBlue ? "rgba(110, 180, 255, 0.28)" : "rgba(255, 105, 125, 0.30)";
                    const radius = cellSize * 1.7;
                    return (
                        <Circle
                            key={`king-spot-${index}`}
                            x={king.x}
                            y={king.y}
                            radius={radius}
                            fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                            fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                            fillRadialGradientStartRadius={0}
                            fillRadialGradientEndRadius={radius}
                            fillRadialGradientColorStops={[0, color, 1, color.replace(/[\d.]+\)$/, "0)")]}
                        />
                    );
                })}
            </Group>
        );
    }, [activeBoardOriginX, activeBoardOriginY, cellSize, flattenedSquares]);

    const drawRoomProps = useCallback(() => (
        <Group listening={false}>
            {BOOKSHELF_PROPS.map((prop, index) => {
                const shelfInset = cellSize * 0.14;
                const shelfX = (prop.col * cellSize) + shelfInset;
                const shelfY = (prop.row * cellSize) + shelfInset;
                const shelfWidth = prop.width * cellSize;
                const shelfHeight = prop.height * cellSize;

                return (
                    <Group key={`bookshelf-${index}`} x={shelfX} y={shelfY}>
                        <Rect
                            width={shelfWidth}
                            height={shelfHeight}
                            cornerRadius={cellSize * 0.03}
                            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                            fillLinearGradientEndPoint={{ x: 0, y: shelfHeight }}
                            fillLinearGradientColorStops={[0, "#1B1B2E", 0.6, "#26253D", 1, "#11131E"]}
                            shadowEnabled={true}
                            shadowColor="#05070F"
                            shadowBlur={16}
                            shadowOpacity={0.4}
                        />
                        {[0.18, 0.44, 0.7].map((row, rowIndex) => (
                            <Group key={`shelf-row-${rowIndex}`} y={shelfHeight * row}>
                                <Line
                                    points={[cellSize * 0.04, 0, shelfWidth - (cellSize * 0.04), 0]}
                                    stroke="rgba(8, 9, 16, 0.72)"
                                    strokeWidth={2}
                                />
                                {[0.12, 0.24, 0.34, 0.46, 0.58, 0.7].map((offset, offsetIndex) => (
                                    <Rect
                                        key={`book-${offsetIndex}`}
                                        x={shelfWidth * offset}
                                        y={cellSize * 0.02}
                                        width={cellSize * 0.05}
                                        height={cellSize * 0.11}
                                        cornerRadius={cellSize * 0.012}
                                        fill={["#6C75C9", "#A0528C", "#F4D39B", "#73B9E6", "#B680D2", "#4E9A74"][offsetIndex]}
                                        opacity={0.88}
                                    />
                                ))}
                            </Group>
                        ))}
                    </Group>
                );
            })}
            {PILLAR_PROPS.map((prop, index) => {
                const pillarInset = cellSize * 0.14;
                const pillarX = (prop.col * cellSize) + pillarInset;
                const pillarY = (prop.row * cellSize) + pillarInset;
                return (
                    <Group key={`pillar-${index}`} x={pillarX} y={pillarY}>
                        <Rect
                            x={cellSize * 0.18}
                            y={0}
                            width={cellSize * 0.28}
                            height={cellSize * 0.18}
                            cornerRadius={cellSize * 0.03}
                            fill="#E7E4EE"
                        />
                        <Rect
                            x={cellSize * 0.2}
                            y={cellSize * 0.18}
                            width={cellSize * 0.24}
                            height={cellSize * 0.48}
                            cornerRadius={cellSize * 0.02}
                            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                            fillLinearGradientEndPoint={{ x: 0, y: cellSize * 0.48 }}
                            fillLinearGradientColorStops={[0, "#D6ECFF", 0.5, "#81BFFF", 1, "#6172AE"]}
                            shadowEnabled={true}
                            shadowColor="#A1DCFF"
                            shadowBlur={18}
                            shadowOpacity={0.38}
                        />
                        <Rect
                            x={cellSize * 0.12}
                            y={cellSize * 0.64}
                            width={cellSize * 0.4}
                            height={cellSize * 0.12}
                            cornerRadius={cellSize * 0.03}
                            fill="#D3CEDD"
                        />
                    </Group>
                );
            })}
        </Group>
    ), [cellSize]);

    const drawCenterDiamond = useCallback(() => {
        const centerX = (CENTER_DIAMOND_COL + 0.5) * cellSize;
        const centerY = (CENTER_DIAMOND_ROW + 0.5) * cellSize;

        return (
            <Group listening={false}>
                <Circle
                    x={centerX}
                    y={centerY}
                    radius={cellSize * 0.84}
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndRadius={cellSize * 0.84}
                    fillRadialGradientColorStops={[0, "rgba(95, 245, 255, 0.22)", 1, "rgba(95, 245, 255, 0)"]}
                />
                <RegularPolygon
                    x={centerX}
                    y={centerY}
                    sides={4}
                    radius={cellSize * 0.34}
                    rotation={45}
                    fillLinearGradientStartPoint={{ x: -cellSize * 0.24, y: -cellSize * 0.24 }}
                    fillLinearGradientEndPoint={{ x: cellSize * 0.24, y: cellSize * 0.24 }}
                    fillLinearGradientColorStops={[0, "#F5FFFF", 0.38, "#8AF6FF", 0.72, "#4DCBFF", 1, "#2E71FF"]}
                    stroke="rgba(207, 248, 255, 0.82)"
                    strokeWidth={1}
                    shadowEnabled={true}
                    shadowColor="#63F4FF"
                    shadowBlur={26}
                    shadowOpacity={0.75}
                />
                <Line
                    points={[
                        centerX,
                        centerY - (cellSize * 0.42),
                        centerX,
                        centerY + (cellSize * 0.36)
                    ]}
                    stroke="rgba(227, 251, 255, 0.5)"
                    strokeWidth={1}
                    lineCap="round"
                />
            </Group>
        );
    }, [cellSize]);

    const drawGrid = useCallback(() => {
        const inset = cellSize * 0.035;
        const markerLen = cellSize * 0.09;
        const cornerLen = cellSize * 0.07;
        const decorativePalette = BASE_SQUARE_PALETTE;

        return Array.from({ length: VISUAL_BOARD_ROWS }, (_, rowIndex) => (
            Array.from({ length: VISUAL_BOARD_COLS }, (_, colIndex) => {
                const activeColIndex = colIndex - ACTIVE_BOARD_COL_OFFSET;
                const activeRowIndex = rowIndex - ACTIVE_BOARD_ROW_OFFSET;
                const activeSquare = (
                    activeColIndex >= 0 &&
                    activeColIndex < ACTIVE_BOARD_COLS &&
                    activeRowIndex >= 0 &&
                    activeRowIndex < ACTIVE_BOARD_ROWS
                ) ? squares[activeRowIndex]?.[activeColIndex] || null : null;
                let palette = activeSquare ? getSquarePalette(activeSquare) : decorativePalette;
                const isEmbeddedLaserSquare = activeSquare && (
                    activeSquare.type === SquareTypesEnum.LASER_RED ||
                    activeSquare.type === SquareTypesEnum.LASER_BLUE
                );

                if (isEmbeddedLaserSquare) {
                    palette = decorativePalette;
                }

                if (colIndex === 0 && rowIndex === 0) {
                    palette = getSquarePalette({
                        type: SquareTypesEnum.LASER_RED,
                        location: null
                    });
                } else if (colIndex === blueCornerColIndex && rowIndex === blueCornerRowIndex) {
                    palette = getSquarePalette({
                        type: SquareTypesEnum.LASER_BLUE,
                        location: null
                    });
                }

                const baseX = Location.getX(colIndex, cellSize, false);
                const baseY = Location.getY(rowIndex, cellSize, false);
                const centerX = baseX + (cellSize / 2);
                const centerY = baseY + (cellSize / 2);
                const isSkylight = Boolean(palette.skylight);
                const skylightBlue = palette.skylight === "blue";

                return (
                    <Group key={`grid--${colIndex}-${rowIndex}`} listening={false}>
                        <Rect
                            x={baseX + inset}
                            y={baseY + inset}
                            width={cellSize - (inset * 2)}
                            height={cellSize - (inset * 2)}
                            cornerRadius={cellSize * 0.08}
                            fill={palette.fill}
                            stroke={palette.stroke}
                            strokeWidth={1.2}
                        />
                        {!isSkylight && (
                            <Rect
                                x={baseX + (inset * 1.85)}
                                y={baseY + (inset * 1.85)}
                                width={cellSize - (inset * 3.7)}
                                height={cellSize - (inset * 3.7)}
                                cornerRadius={cellSize * 0.07}
                                fill={palette.insetFill}
                                opacity={0.56}
                            />
                        )}
                        <Group listening={false} opacity={0.12}>
                            <Line
                                points={[baseX + inset, baseY + inset + cornerLen, baseX + inset, baseY + inset, baseX + inset + cornerLen, baseY + inset]}
                                stroke="#F4F7FF"
                                strokeWidth={1}
                                lineCap="round"
                                lineJoin="round"
                            />
                            <Line
                                points={[baseX + cellSize - inset - cornerLen, baseY + inset, baseX + cellSize - inset, baseY + inset, baseX + cellSize - inset, baseY + inset + cornerLen]}
                                stroke="#F4F7FF"
                                strokeWidth={1}
                                lineCap="round"
                                lineJoin="round"
                            />
                            <Line
                                points={[baseX + inset, baseY + cellSize - inset - cornerLen, baseX + inset, baseY + cellSize - inset, baseX + inset + cornerLen, baseY + cellSize - inset]}
                                stroke="#F4F7FF"
                                strokeWidth={1}
                                lineCap="round"
                                lineJoin="round"
                            />
                            <Line
                                points={[baseX + cellSize - inset - cornerLen, baseY + cellSize - inset, baseX + cellSize - inset, baseY + cellSize - inset, baseX + cellSize - inset, baseY + cellSize - inset - cornerLen]}
                                stroke="#F4F7FF"
                                strokeWidth={1}
                                lineCap="round"
                                lineJoin="round"
                            />
                        </Group>
                        {palette.marker && (
                            <Group listening={false}>
                                <Line
                                    points={[centerX - markerLen, centerY, centerX + markerLen, centerY]}
                                    stroke={palette.marker}
                                    strokeWidth={1.4}
                                    lineCap="round"
                                />
                                <Line
                                    points={[centerX, centerY - markerLen, centerX, centerY + markerLen]}
                                    stroke={palette.marker}
                                    strokeWidth={1.4}
                                    lineCap="round"
                                />
                            </Group>
                        )}
                        {isSkylight && (
                            <Group listening={false}>
                                <Rect
                                    x={baseX + (cellSize * 0.12)}
                                    y={baseY + (cellSize * 0.18)}
                                    width={cellSize * 0.76}
                                    height={cellSize * 0.64}
                                    cornerRadius={cellSize * 0.08}
                                    fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                                    fillLinearGradientEndPoint={{ x: 0, y: cellSize * 0.64 }}
                                    fillLinearGradientColorStops={skylightBlue
                                        ? [0, "#DDF8FF", 0.45, "#79E0FF", 1, "#1E5E8A"]
                                        : [0, "#FFE4EB", 0.45, "#FF9BB5", 1, "#7E2748"]}
                                    opacity={0.88}
                                    stroke={skylightBlue ? "rgba(190, 240, 255, 0.55)" : "rgba(255, 210, 220, 0.55)"}
                                    strokeWidth={1}
                                    shadowEnabled={true}
                                    shadowColor={skylightBlue ? "#79E0FF" : "#FF9BB5"}
                                    shadowBlur={20}
                                    shadowOpacity={0.55}
                                />
                                <Line
                                    points={[
                                        baseX + (cellSize * 0.22),
                                        baseY + (cellSize * 0.28),
                                        baseX + (cellSize * 0.42),
                                        baseY + (cellSize * 0.72)
                                    ]}
                                    stroke="rgba(255, 255, 255, 0.55)"
                                    strokeWidth={1.2}
                                    lineCap="round"
                                />
                                <Line
                                    points={[
                                        baseX + (cellSize * 0.58),
                                        baseY + (cellSize * 0.28),
                                        baseX + (cellSize * 0.78),
                                        baseY + (cellSize * 0.72)
                                    ]}
                                    stroke="rgba(255, 255, 255, 0.35)"
                                    strokeWidth={1}
                                    lineCap="round"
                                />
                            </Group>
                        )}
                    </Group>
                );
            })
        ));
    }, [blueCornerColIndex, blueCornerRowIndex, cellSize, squares]);

    const drawPieces = useCallback(() => {
        const squaresWithPieces = flattenedSquares.filter(square => SquareUtils.hasPiece(square));

        return squaresWithPieces.map((square) => (
            <BoardPiece
                currentPlayer={currentPlayer}
                movementIsLocked={movementIsLocked || placementModeActive}
                id={square.location.an}
                key={`${square.piece.imageName}--${square.location.an}`}
                squares={squares}
                square={square}
                onMove={onBoardPieceMove}
                onGrab={(srcLocation) => {
                    dispatch(selectPiece({ location: srcLocation }));
                }}
                onSelect={(srcLocation) => {
                    if (srcLocation === selectedPieceLocation) {
                        dispatch(unselectPiece());
                    } else {
                        dispatch(selectPiece({ location: srcLocation }));
                    }
                }}
                cellSize={cellSize}
            />
        ));
    }, [flattenedSquares, currentPlayer, movementIsLocked, placementModeActive, squares, onBoardPieceMove, cellSize, dispatch, selectedPieceLocation]);

    const drawPossibleMovesHighlight = useCallback(() => {
        if (placementModeActive) {
            return null;
        }

        if (!isEmpty(selectedPieceLocation)) {
            const board = new Board({ squares });
            const movesForSelectedPiece = board.getMovesForPieceAtLocation(selectedPieceLocation);

            const ringColor = currentPlayer === PlayerTypesEnum.BLUE ? "#79C6FF" : "#FF9BB5";
            const selectedPieceHighlight = (
                <Circle
                    key="selectedPiece"
                    stroke={ringColor}
                    shadowEnabled={true}
                    shadowColor={ringColor}
                    shadowBlur={18}
                    listening={false}
                    strokeWidth={3}
                    radius={cellSize * 0.5}
                    x={(selectedPieceLocation.colIndex * cellSize) + (cellSize / 2)}
                    y={(selectedPieceLocation.rowIndex * cellSize) + (cellSize / 2)}
                />
            );

            const possibleMovesHighlights = movesForSelectedPiece.map(movement => (
                <PieceMoveHighlight
                    key={`pmh--${movement.destLocation.an}`}
                    cellSize={cellSize}
                    onChoose={(move) => {
                        Board.presentPieceMovement(reference, move.serialize(), cellSize);
                        dispatch(unselectPiece());
                        setTimeout(() => {
                            dispatch(applyMovement({ movement: movement.serialize() }));
                        }, 400);
                    }}
                    movement={movement}
                />
            ));

            return [possibleMovesHighlights, selectedPieceHighlight];
        }
    }, [cellSize, currentPlayer, dispatch, placementModeActive, reference, selectedPieceLocation, squares]);

    const drawDeployHighlights = useCallback(() => {
        if (!pendingPlacement) {
            return null;
        }

        const board = new Board({ squares });
        const deployLocations = board.getDeployLocationsForPlayer(pendingPlacement.playerType, PieceTypesEnum.DEFLECTOR);
        const isBackslashMirror = pendingPlacement.orientation === 0 || pendingPlacement.orientation === 180;

        return deployLocations.map((location) => {
            const x = location.colIndex * cellSize;
            const y = location.rowIndex * cellSize;
            const inset = cellSize * 0.14;
            const points = isBackslashMirror
                ? [inset, inset, cellSize - inset, cellSize - inset]
                : [cellSize - inset, inset, inset, cellSize - inset];

            return (
                <Group
                    key={`deploy--${location.an}`}
                    x={x}
                    y={y}
                    onClick={() => dispatch(deployMirror({ location }))}
                    onTap={() => dispatch(deployMirror({ location }))}
                >
                    <Rect
                        x={cellSize * 0.1}
                        y={cellSize * 0.1}
                        width={cellSize * 0.8}
                        height={cellSize * 0.8}
                        cornerRadius={cellSize * 0.16}
                        fill="rgba(97, 243, 255, 0.08)"
                        stroke="#61F3FF"
                        strokeWidth={1.8}
                        shadowEnabled={true}
                        shadowColor="#61F3FF"
                        shadowBlur={16}
                    />
                    <Line
                        points={points}
                        stroke="#DDFBFF"
                        strokeWidth={2.8}
                        lineCap="round"
                        shadowEnabled={true}
                        shadowColor="#61F3FF"
                        shadowBlur={14}
                    />
                </Group>
            );
        });
    }, [cellSize, dispatch, pendingPlacement, squares]);

    const drawLaser = useCallback(() => {
        const linePoints = Board.linePointsFromLaserRoute(laser.route, cellSize);
        const laserGraphics = [];
        const laserColor = currentPlayer === PlayerTypesEnum.BLUE ? "#61F3FF" : "#FF7D9A";

        if (linePoints && linePoints.length >= 2 && laser.route.length > 0) {
            const startPath = laser.route[0];
            if (startPath.location?.an === "a8") {
                linePoints[0] = Location.getX(-ACTIVE_BOARD_COL_OFFSET, cellSize);
                linePoints[1] = Location.getY(-ACTIVE_BOARD_ROW_OFFSET, cellSize);
            } else if (startPath.location?.an === "j1") {
                linePoints[0] = Location.getX(VISUAL_BOARD_COLS - ACTIVE_BOARD_COL_OFFSET - 1, cellSize);
                linePoints[1] = Location.getY(VISUAL_BOARD_ROWS - ACTIVE_BOARD_ROW_OFFSET - 1, cellSize);
            }
        }

        if (linePoints && linePoints.length > 0) {
            laserGraphics.push(
                <Group key="laser-beam">
                    <Line
                        points={linePoints}
                        stroke={laserColor}
                        shadowEnabled={true}
                        shadowColor={laserColor}
                        shadowBlur={20}
                        lineCap="round"
                        lineJoin="round"
                        listening={false}
                        strokeWidth={8}
                    />
                    <Line
                        points={linePoints}
                        stroke="#FFF5ED"
                        lineCap="round"
                        lineJoin="round"
                        listening={false}
                        strokeWidth={3}
                    />
                </Group>
            );
        }

        if (laser.finalActionType === LaserActionTypesEnum.KILL) {
            laserGraphics.unshift(
                <Rect
                    key="killed-piece-highlight"
                    width={cellSize * 0.84}
                    height={cellSize * 0.84}
                    x={Location.getX(laser.finalLocation.colIndex, cellSize, false) + (cellSize * 0.08)}
                    y={Location.getY(laser.finalLocation.rowIndex, cellSize, false) + (cellSize * 0.08)}
                    fill={currentPlayer === PlayerTypesEnum.BLUE ? "rgba(97, 243, 255, 0.28)" : "rgba(255, 125, 154, 0.28)"}
                    stroke={laserColor}
                    strokeWidth={2}
                    cornerRadius={cellSize * 0.12}
                />
            );

            setTimeout(() => {
                const pieceAtfinalLocation = reference.current.find(`#${laser.finalLocation.an}`);
                pieceAtfinalLocation.to({
                    scaleY: 0,
                    scaleX: 0,
                    duration: pieceAnimDuration,
                    easing: pieceAnimEasing
                });
            }, 1000);
        }

        return laserGraphics;
    }, [cellSize, currentPlayer, laser, reference]);

    return (
        <>
            <Layer ref={reference}>
                {drawBoardBackdrop()}
                {drawGrid()}
                {drawRoomProps()}
                {drawCenterDiamond()}
                <Group x={activeBoardOriginX} y={activeBoardOriginY}>
                    {drawPieces()}
                    {drawPossibleMovesHighlight()}
                    {drawDeployHighlights()}
                </Group>
            </Layer>
            <Layer>
                <Group x={activeBoardOriginX} y={activeBoardOriginY}>
                    {drawLaser()}
                </Group>
            </Layer>
        </>
    );
};

export default BoardLayer;
