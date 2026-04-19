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
            fill: "#16374B",
            insetFill: "#194B67",
            stroke: "#60EAFF"
        };
    }

    switch (square.type) {
        case SquareTypesEnum.LASER_BLUE:
            return {
                fill: "#143047",
                insetFill: "#235687",
                stroke: "#79E8FF"
            };
        case SquareTypesEnum.LASER_RED:
            return {
                fill: "#43192F",
                insetFill: "#8E3358",
                stroke: "#FFC3D3"
            };
        case SquareTypesEnum.RESERVED_BLUE:
            return {
                fill: "#182844",
                insetFill: "#213D67",
                stroke: "#5D9BFF"
            };
        case SquareTypesEnum.RESERVED_RED:
            return {
                fill: "#331A2A",
                insetFill: "#5A2742",
                stroke: "#FF799C"
            };
        default:
            return {
                fill: "#161C3B",
                insetFill: "#1B2348",
                stroke: "rgba(183, 198, 255, 0.16)"
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

    const drawBoardBackdrop = useCallback(() => (
        <Group listening={false}>
            <Rect
                x={0}
                y={0}
                width={cellSize * 10}
                height={cellSize * 8}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: cellSize * 10, y: cellSize * 8 }}
                fillLinearGradientColorStops={[0, "#1B2047", 0.35, "#2C3468", 0.65, "#232B59", 1, "#151B3A"]}
            />
            <Circle
                x={cellSize * 5}
                y={cellSize * 4}
                radius={cellSize * 1.6}
                fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientStartRadius={0}
                fillRadialGradientEndRadius={cellSize * 1.6}
                fillRadialGradientColorStops={[0, "rgba(104, 241, 255, 0.28)", 1, "rgba(104, 241, 255, 0)"]}
            />
            <Circle
                x={cellSize * 3}
                y={cellSize * 3}
                radius={cellSize * 1.4}
                fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientStartRadius={0}
                fillRadialGradientEndRadius={cellSize * 1.4}
                fillRadialGradientColorStops={[0, "rgba(255, 111, 154, 0.18)", 1, "rgba(255, 111, 154, 0)"]}
            />
            <Circle
                x={cellSize * 7.4}
                y={cellSize * 2.8}
                radius={cellSize * 1.45}
                fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientStartRadius={0}
                fillRadialGradientEndRadius={cellSize * 1.45}
                fillRadialGradientColorStops={[0, "rgba(107, 175, 255, 0.2)", 1, "rgba(107, 175, 255, 0)"]}
            />
        </Group>
    ), [cellSize]);

    const drawGrid = useCallback(() => {
        const inset = cellSize * 0.05;
        return flattenedSquares.map(square => {
            const palette = getSquarePalette(square);
            return (
                <Group key={`grid--${square.location.an}`} listening={false}>
                    <Rect
                        x={Location.getX(square.location.colIndex, cellSize, false) + inset}
                        y={Location.getY(square.location.rowIndex, cellSize, false) + inset}
                        width={cellSize - (inset * 2)}
                        height={cellSize - (inset * 2)}
                        cornerRadius={cellSize * 0.12}
                        fill={palette.fill}
                        stroke={palette.stroke}
                        strokeWidth={1.5}
                    />
                    <Rect
                        x={Location.getX(square.location.colIndex, cellSize, false) + (inset * 1.85)}
                        y={Location.getY(square.location.rowIndex, cellSize, false) + (inset * 1.85)}
                        width={cellSize - (inset * 3.7)}
                        height={cellSize - (inset * 3.7)}
                        cornerRadius={cellSize * 0.1}
                        fill={palette.insetFill}
                        opacity={0.38}
                    />
                </Group>
            );
        });
    }, [cellSize, flattenedSquares]);

    const drawDiamondObjective = useCallback(() => (
        <Group listening={false}>
            {[
                { x: cellSize * 4, y: cellSize * 3 },
                { x: cellSize * 5, y: cellSize * 3 },
                { x: cellSize * 4, y: cellSize * 4 },
                { x: cellSize * 5, y: cellSize * 4 }
            ].map(({ x, y }, index) => (
                <Rect
                    key={`goal-square-${index}`}
                    x={x + (cellSize * 0.08)}
                    y={y + (cellSize * 0.08)}
                    width={cellSize * 0.84}
                    height={cellSize * 0.84}
                    cornerRadius={cellSize * 0.18}
                    stroke="#6BF1FF"
                    strokeWidth={1.6}
                    opacity={0.5}
                />
            ))}
            <Rect
                x={cellSize * 4.28}
                y={cellSize * 3.35}
                width={cellSize * 1.44}
                height={cellSize * 1.32}
                cornerRadius={cellSize * 0.22}
                fill="rgba(11, 29, 58, 0.94)"
                stroke="#6BF1FF"
                strokeWidth={2.2}
                shadowEnabled={true}
                shadowColor="#5FF5FF"
                shadowBlur={24}
            />
            <Circle
                x={cellSize * 5}
                y={cellSize * 4}
                radius={cellSize * 0.95}
                fill="rgba(95, 245, 255, 0.2)"
                shadowEnabled={true}
                shadowColor="#5FF5FF"
                shadowBlur={42}
            />
            <RegularPolygon
                x={cellSize * 5}
                y={cellSize * 4.18}
                sides={4}
                radius={cellSize * 0.22}
                rotation={45}
                fill="#16314B"
                opacity={0.9}
            />
            <RegularPolygon
                x={cellSize * 5}
                y={cellSize * 3.92}
                sides={4}
                radius={cellSize * 0.42}
                rotation={45}
                fillLinearGradientStartPoint={{ x: -cellSize * 0.28, y: -cellSize * 0.28 }}
                fillLinearGradientEndPoint={{ x: cellSize * 0.28, y: cellSize * 0.28 }}
                fillLinearGradientColorStops={[0, "#F4FFFF", 0.4, "#7DF4FF", 0.72, "#43BFFF", 1, "#2A62FF"]}
                shadowEnabled={true}
                shadowColor="#5FF5FF"
                shadowBlur={34}
            />
            <Line
                points={[cellSize * 5, cellSize * 3.18, cellSize * 5, cellSize * 4.82]}
                stroke="#8EEFFF"
                strokeWidth={1.2}
                opacity={0.8}
            />
            <Line
                points={[cellSize * 4.18, cellSize * 4, cellSize * 5.82, cellSize * 4]}
                stroke="#8EEFFF"
                strokeWidth={1.2}
                opacity={0.8}
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

            const selectedPieceHighlight = (
                <Rect
                    key="selectedPiece"
                    stroke="#F6E88F"
                    cornerRadius={cellSize * 0.12}
                    shadowEnabled={true}
                    shadowColor="#F6E88F"
                    shadowBlur={18}
                    listening={false}
                    strokeWidth={2}
                    width={cellSize * 0.84}
                    height={cellSize * 0.84}
                    x={(selectedPieceLocation.colIndex * cellSize) + (cellSize * 0.08)}
                    y={(selectedPieceLocation.rowIndex * cellSize) + (cellSize * 0.08)}
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
    }, [cellSize, dispatch, placementModeActive, reference, selectedPieceLocation, squares]);

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
