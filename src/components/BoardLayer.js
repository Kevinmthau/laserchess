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

const getSquarePalette = (square) => {
    if (isDiamondGoalLocation(square.location)) {
        return {
            fill: "#18384C",
            insetFill: "#1D516E",
            stroke: "#7BEFFF",
            marker: "rgba(160, 240, 255, 0.22)"
        };
    }

    switch (square.type) {
        case SquareTypesEnum.LASER_BLUE:
            return {
                fill: "#111B2E",
                insetFill: "#16243D",
                stroke: "rgba(140, 200, 255, 0.20)",
                marker: null,
                skylight: "blue"
            };
        case SquareTypesEnum.LASER_RED:
            return {
                fill: "#1B1224",
                insetFill: "#261728",
                stroke: "rgba(255, 180, 200, 0.18)",
                marker: null,
                skylight: "red"
            };
        case SquareTypesEnum.RESERVED_BLUE:
            return {
                fill: "#162A4C",
                insetFill: "#1E3A6A",
                stroke: "rgba(110, 170, 255, 0.35)",
                marker: "rgba(170, 210, 255, 0.22)"
            };
        case SquareTypesEnum.RESERVED_RED:
            return {
                fill: "#3A1F3D",
                insetFill: "#4A2858",
                stroke: "rgba(200, 130, 255, 0.35)",
                marker: "rgba(230, 190, 255, 0.22)"
            };
        default:
            return {
                fill: "#1C2836",
                insetFill: "#243345",
                stroke: "rgba(170, 200, 255, 0.10)",
                marker: "rgba(255, 255, 255, 0.10)"
            };
    }
};

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

    const drawBoardBackdrop = useCallback(() => {
        const kings = flattenedSquares
            .filter(square => SquareUtils.hasPiece(square) && square.piece.type === PieceTypesEnum.KING)
            .map(square => ({
                color: square.piece.color,
                x: (square.location.colIndex + 0.5) * cellSize,
                y: (square.location.rowIndex + 0.5) * cellSize
            }));

        return (
            <Group listening={false}>
                <Rect
                    x={0}
                    y={0}
                    width={cellSize * 10}
                    height={cellSize * 8}
                    fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                    fillLinearGradientEndPoint={{ x: cellSize * 10, y: cellSize * 8 }}
                    fillLinearGradientColorStops={[0, "#16202C", 0.35, "#1A2838", 0.65, "#161F2E", 1, "#0D1522"]}
                />
                <Circle
                    x={cellSize * 5}
                    y={cellSize * 4}
                    radius={cellSize * 1.9}
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndRadius={cellSize * 1.9}
                    fillRadialGradientColorStops={[0, "rgba(104, 241, 255, 0.36)", 1, "rgba(104, 241, 255, 0)"]}
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
    }, [cellSize, flattenedSquares]);

    const drawGrid = useCallback(() => {
        const inset = cellSize * 0.05;
        const markerLen = cellSize * 0.11;
        return flattenedSquares.map(square => {
            const palette = getSquarePalette(square);
            const baseX = Location.getX(square.location.colIndex, cellSize, false);
            const baseY = Location.getY(square.location.rowIndex, cellSize, false);
            const centerX = baseX + (cellSize / 2);
            const centerY = baseY + (cellSize / 2);
            const isSkylight = Boolean(palette.skylight);
            const skylightBlue = palette.skylight === "blue";

            return (
                <Group key={`grid--${square.location.an}`} listening={false}>
                    <Rect
                        x={baseX + inset}
                        y={baseY + inset}
                        width={cellSize - (inset * 2)}
                        height={cellSize - (inset * 2)}
                        cornerRadius={cellSize * 0.12}
                        fill={palette.fill}
                        stroke={palette.stroke}
                        strokeWidth={1.5}
                    />
                    {!isSkylight && (
                        <Rect
                            x={baseX + (inset * 1.85)}
                            y={baseY + (inset * 1.85)}
                            width={cellSize - (inset * 3.7)}
                            height={cellSize - (inset * 3.7)}
                            cornerRadius={cellSize * 0.1}
                            fill={palette.insetFill}
                            opacity={0.38}
                        />
                    )}
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
        });
    }, [cellSize, flattenedSquares]);

    const drawDiamondObjective = useCallback(() => (
        <Group listening={false}>
            <Circle
                x={cellSize * 5}
                y={cellSize * 4}
                radius={cellSize * 1.15}
                fill="rgba(95, 245, 255, 0.18)"
                shadowEnabled={true}
                shadowColor="#5FF5FF"
                shadowBlur={54}
            />
            <Rect
                x={cellSize * 4.2}
                y={cellSize * 4.2}
                width={cellSize * 1.6}
                height={cellSize * 0.48}
                cornerRadius={cellSize * 0.12}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: 0, y: cellSize * 0.48 }}
                fillLinearGradientColorStops={[0, "#2A1D3B", 1, "#130A1E"]}
                stroke="#B25CFF"
                strokeWidth={2}
                shadowEnabled={true}
                shadowColor="#B25CFF"
                shadowBlur={20}
                shadowOpacity={0.6}
            />
            <Rect
                x={cellSize * 4.38}
                y={cellSize * 4.28}
                width={cellSize * 1.24}
                height={cellSize * 0.22}
                cornerRadius={cellSize * 0.05}
                fill="#0B1A2E"
                stroke="#68E0FF"
                strokeWidth={1.2}
                opacity={0.9}
            />
            <Circle
                x={cellSize * 4.4}
                y={cellSize * 4.74}
                radius={cellSize * 0.09}
                fill="#F5D66B"
                stroke="#3C2A10"
                strokeWidth={1}
            />
            <Circle
                x={cellSize * 5.6}
                y={cellSize * 4.74}
                radius={cellSize * 0.09}
                fill="#F5D66B"
                stroke="#3C2A10"
                strokeWidth={1}
            />
            <Rect
                x={cellSize * 4.76}
                y={cellSize * 3.5}
                width={cellSize * 0.48}
                height={cellSize * 0.24}
                cornerRadius={cellSize * 0.04}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: 0, y: cellSize * 0.24 }}
                fillLinearGradientColorStops={[0, "#3C2453", 1, "#1B0F28"]}
                stroke="#B25CFF"
                strokeWidth={1}
            />
            <RegularPolygon
                x={cellSize * 5}
                y={cellSize * 3.58}
                sides={4}
                radius={cellSize * 0.38}
                rotation={45}
                fillLinearGradientStartPoint={{ x: -cellSize * 0.28, y: -cellSize * 0.28 }}
                fillLinearGradientEndPoint={{ x: cellSize * 0.28, y: cellSize * 0.28 }}
                fillLinearGradientColorStops={[0, "#F4FFFF", 0.4, "#7DF4FF", 0.72, "#43BFFF", 1, "#2A62FF"]}
                shadowEnabled={true}
                shadowColor="#5FF5FF"
                shadowBlur={34}
            />
            <Line
                points={[cellSize * 5, cellSize * 3.2, cellSize * 5, cellSize * 3.96]}
                stroke="#C8F4FF"
                strokeWidth={1}
                opacity={0.55}
            />
        </Group>
    ), [cellSize]);

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
    }, [laser, cellSize, reference, currentPlayer]);

    return (
        <>
            <Layer ref={reference}>
                {drawBoardBackdrop()}
                {drawGrid()}
                {drawDiamondObjective()}
                {drawPieces()}
                {drawPossibleMovesHighlight()}
                {drawDeployHighlights()}
            </Layer>
            <Layer>
                {drawLaser()}
            </Layer>
        </>
    );
};

export default BoardLayer;
