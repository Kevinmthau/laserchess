import React, { useEffect, useState, useCallback } from "react";
import { isEqual } from "lodash";
import Konva from "konva";
import Location from "../models/Location";
import useImage from "use-image";
import { MovementTypesEnum, PieceTypesEnum, PlayerTypesEnum } from "../models/Enums";
import { Group, Image } from "react-konva";
import Board from "../models/Board";
import BlueBurglarSVG from "../assets/pieces/blue-burglar.svg";
import RedBurglarSVG from "../assets/pieces/red-burglar.svg";
import DeflectorDirectionOverlay from "./DeflectorDirectionOverlay";
import { recordClientError, setDebugSnapshot } from "../utils/debug";
import {
	ACTIVE_BOARD_COL_OFFSET,
	ACTIVE_BOARD_ROW_OFFSET,
	VISUAL_BOARD_COLS,
	VISUAL_BOARD_ROWS
} from "../constants/boardLayout";

/**
 * @constant
 * The duration of the animation of a piece movement.
 */
export const pieceAnimDuration = 0.332;

/**
 * @constant
 * The easing of the tween for any piece movement
 */
export const pieceAnimEasing = Konva.Easings.BackEaseOut;

const BoardPiece = ({ id, square: { piece, location }, squares, offboardPieces, onMove, onSelect, onGrab, cellSize, currentPlayer, movementIsLocked }) => {
	const [lastXY, setLastXY] = useState({ x: undefined, y: undefined });
	const isDraggablePiece = piece.type !== PieceTypesEnum.LASER;
	const pieceImageSource = piece.type === PieceTypesEnum.KING
		? (piece.color === PlayerTypesEnum.BLUE ? BlueBurglarSVG : RedBurglarSVG)
		: `https://laserchess.s3.us-east-2.amazonaws.com/pieces/${piece.imageName}.svg`;
	const [pieceImage] = useImage(pieceImageSource);
	const pieceGlowColor = piece.color === PlayerTypesEnum.BLUE ? "#6FE7FF" : "#FF7A99";
	const deflectorBackBorderColor = piece.color === PlayerTypesEnum.BLUE ? "#8CD8FF" : "#FF9DB3";
	const pieceGlowBlur = piece.type === PieceTypesEnum.KING ? 22 : 10;
	const renderedPosition = useCallback(() => {
		if (piece.type === PieceTypesEnum.LASER) {
			if (piece.color === PlayerTypesEnum.RED) {
				return {
					x: Location.getX(-ACTIVE_BOARD_COL_OFFSET, cellSize),
					y: Location.getY(-ACTIVE_BOARD_ROW_OFFSET, cellSize)
				};
			}

			return {
				x: Location.getX(VISUAL_BOARD_COLS - ACTIVE_BOARD_COL_OFFSET - 1, cellSize),
				y: Location.getY(VISUAL_BOARD_ROWS - ACTIVE_BOARD_ROW_OFFSET - 1, cellSize)
			};
		}

		return {
			x: Location.getX(location.colIndex, cellSize),
			y: Location.getY(location.rowIndex, cellSize)
		};
	}, [cellSize, location.colIndex, location.rowIndex, piece.color, piece.type]);


	useEffect(() => {
		setLastXY(renderedPosition());
	}, [renderedPosition]);


	// Methods
	const selectThePiece = useCallback(() => {
		// Select the piece.
		// todo allow laser selections and show possible rotations for it!
		if (piece.type !== PieceTypesEnum.LASER) { // Just don't select the piece if it is LASER. TODO
			onSelect(location); // location (aka srcLocation) of the clicked peace
		}
	}, [location, onSelect, piece.type]);

	const resetToPosition = useCallback((node, x, y) => {
		node.to({
			x,
			y,
			duration: pieceAnimDuration,
			easing: pieceAnimEasing
		});
	}, []);


	return (
		<Group draggable={isDraggablePiece}
			id={id}
			onTap={selectThePiece}
			onClick={selectThePiece}
			onMouseEnter={(e) => {
				const container = e.target.getStage().container();
				container.style.cursor = isDraggablePiece ? "grab" : "pointer";
			}}
			onMouseLeave={(e) => {
				const container = e.target.getStage().container();
				container.style.cursor = "default";
			}}
			dragBoundFunc={(pos) => {
				// Limit drag to inside the canvas.
				const minX = Location.getX(-ACTIVE_BOARD_COL_OFFSET, cellSize);
				const maxX = Location.getX(VISUAL_BOARD_COLS - ACTIVE_BOARD_COL_OFFSET - 1, cellSize);
				const minY = Location.getY(-ACTIVE_BOARD_ROW_OFFSET, cellSize);
				const maxY = Location.getY(VISUAL_BOARD_ROWS - ACTIVE_BOARD_ROW_OFFSET - 1, cellSize);
				const newX = pos.x > maxX ? maxX : pos.x < minX ? minX : pos.x;
				const newY = pos.y > maxY ? maxY : pos.y < minY ? minY : pos.y;
				return {
					x: newX,
					y: newY
				};
			}}
			onDragStart={(e) => {
				// On piece drag, with mouse or touch
				onGrab(location);
				e.target.moveToTop(); // Move up the layer, so it doesn't get hidden beneath other Nodes (pieces)
				const container = e.target.getStage().container();
				container.style.cursor = "grabbing";
			}}
			onDragEnd={(e) => {
				const fallbackXY = renderedPosition();
				try {
					const startX = Number.isFinite(lastXY.x) ? lastXY.x : fallbackXY.x;
					const startY = Number.isFinite(lastXY.y) ? lastXY.y : fallbackXY.y;
					// Handle piece drag and dropping by snapping it to the grid.
					const rawEndX = e.target.x(); // the final X position
					const rawEndY = e.target.y(); // the final Y position
					const dragContext = {
						piece: {
							type: piece.type,
							color: piece.color,
							orientation: piece.orientation,
							imageName: piece.imageName
						},
						currentPlayer,
						location: location.serialize(),
						startXY: { x: startX, y: startY },
						rawEndXY: { x: rawEndX, y: rawEndY },
						fallbackXY,
						cellSize
					};
					setDebugSnapshot("lastDragAttempt", dragContext);
					if (
						!Number.isFinite(rawEndX) ||
						!Number.isFinite(rawEndY) ||
						!Number.isFinite(startX) ||
						!Number.isFinite(startY)
					) {
						recordClientError("boardpiece-drag-invalid-coordinates", dragContext);
						resetToPosition(e.target, fallbackXY.x, fallbackXY.y);
						const container = e.target.getStage().container();
						container.style.cursor = "grab";
						return;
					}

					// Calculate the X and Y used to draw the piece in the board. Having in consideration the margin and the piece offset.
					const endX = (Math.round((rawEndX + (cellSize / 2)) / cellSize) * cellSize) - (cellSize / 2);
					const endY = (Math.round((rawEndY + (cellSize / 2)) / cellSize) * cellSize) - (cellSize / 2);

					const originXY = { x: startX, y: startY };
					const hasChangedLocation = !isEqual(originXY, { x: endX, y: endY });
					if (hasChangedLocation) {
						const srcLocation = Location.fromXY(startX, startY, cellSize);
						const destLocation = Location.fromXY(endX, endY, cellSize);
						setDebugSnapshot("lastDragAttempt", {
							...dragContext,
							snappedEndXY: { x: endX, y: endY },
							srcLocation: srcLocation.serialize(),
							destLocation: destLocation.serialize()
						});

						// Validate!
						// Check if the destLocation square is a neighbor of the srcLocation.
						const isMovingToNeighbor = Board.isMovingToNeighborSquare(srcLocation, destLocation);
						if (!isMovingToNeighbor) {
							// Not a neighbor square of the srcLocation, so move is invalid by itself.
							// See game rules about piece movement https://github.com/kishannareshpal/docs/Guide.md

							// Reset the piece to where it was before moving.
							resetToPosition(e.target, startX, startY);

						} else {
							// We are moving to a neighbor, which is a valid move location.
							// But, now we check if we are not stepping into another piece being a piece other than a switch (moving to a square where another piece already exists is only valid for a Switch piece)
							const board = new Board({ squares, offboardPieces });
							const movement = board.checkMovePossibility(srcLocation, destLocation);
							// console.log("Move possibility", movement);

							if (!movement.isPossible) {
								// Oh-no, the movement is not possible!
								// The dest location already contains a piece on it and the srcPiece is not a Shield.
								// Or the destLocation is not a neighboring square.
								// Reset the piece to where it was before drag (to it's original location - src).
								resetToPosition(e.target, startX, startY);

							} else {
								onSelect(null); // Unselect the piece if moved to a different piece
								// Perfect! The movement is possible
								// Check the type of movement, which could be either "special" or "normal"
								if (movement.type === MovementTypesEnum.SPECIAL) {
									// Special move (Switch can swap)
									// Swap the piece from destLocation with the current piece!
									e.target.to({
										x: endX,
										y: endY,
										duration: pieceAnimDuration,
										easing: pieceAnimEasing
									});

									// Replaces the srcPiece with the destPiece and vice versa.
									// Pass the lastXY so we can animate the move of the destPiece to the srcLocation (the switch)!
									onMove(movement, originXY); // the other piece is moved to the srcLocation on the App.js

								} else if (movement.type === MovementTypesEnum.NORMAL) {
									// Normal move (moving to a new empty target square)
									e.target.to({
										x: endX,
										y: endY,
										duration: pieceAnimDuration,
										easing: pieceAnimEasing
									});

									onMove(movement, null);

								}

								// Update the last position to be this new one
								setLastXY({
									x: endX,
									y: endY
								});
							}
						}

					} else {
						// No movement made at all. Just align back to where it was before drag.
						resetToPosition(e.target, endX, endY);
					}
				} catch (error) {
					recordClientError("boardpiece-drag-error", {
						piece: {
							type: piece.type,
							color: piece.color,
							orientation: piece.orientation,
							imageName: piece.imageName
						},
						currentPlayer,
						location: location.serialize(),
						lastXY,
						fallbackXY,
						cellSize,
						error
					});
					resetToPosition(e.target, fallbackXY.x, fallbackXY.y);
					console.error("BoardPiece drag interaction failed", {
						error,
						piece,
						location,
						lastXY,
						fallbackXY,
						cellSize,
						currentPlayer
					});
				}

				const container = e.target.getStage().container();
				container.style.cursor = "grab";
			}}
			listening={(piece.color === currentPlayer) && (!movementIsLocked)}
			x={renderedPosition().x}
			y={renderedPosition().y}
			rotation={piece.orientation}
		>
			<Image
				x={-(cellSize / 2)}
				y={-(cellSize / 2)}
				image={pieceImage}
				shadowEnabled={true}
				shadowColor={pieceGlowColor}
				shadowBlur={pieceGlowBlur}
				shadowOpacity={0.65}
				width={cellSize}
				height={cellSize}
			/>
			{piece.type === PieceTypesEnum.DEFLECTOR && (
				<DeflectorDirectionOverlay
					cellSize={cellSize}
					color={deflectorBackBorderColor}
					glowColor={pieceGlowColor}
				/>
			)}
		</Group>
	);
};

export default BoardPiece;
