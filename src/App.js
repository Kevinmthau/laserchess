import React, { useCallback, useRef, useState, useEffect } from "react";
import { Stage } from "react-konva";
import BoardLayer from "./components/BoardLayer";
import { pieceAnimDuration, pieceAnimEasing } from "./components/BoardPiece";
import "./App.scss";
import { Provider, ReactReduxContext, useDispatch, useSelector } from "react-redux";
import { setBoardType, applyMovement, cancelMirrorPlacement, finishMovement, resetGame, rotatePendingPlacement, startMirrorPlacement, unselectPiece } from "./redux/slices/gameSlice";
import { MovementTypesEnum, PlayerTypesEnum, WinReasonsEnum } from "./models/Enums";
import Board from "./models/Board";
import { IconButton } from "@material-ui/core";
import RotateLeftIcon from "@material-ui/icons/RotateLeft";
import RotateRightIcon from "@material-ui/icons/RotateRight";
import Movement from "./models/Movement";
import { VISUAL_BOARD_ASPECT, VISUAL_BOARD_COLS } from "./constants/boardLayout";

function App() {
	const [boardWidth, setBoardWidth] = useState(700);

	const selectedPieceLocation = useSelector(state => state.game.selectedPieceLocation);
	const currentPlayer = useSelector(state => state.game.currentPlayer);
	const laser = useSelector(state => state.game.laser);
	const winner = useSelector(state => state.game.winner);
	const winnerReason = useSelector(state => state.game.winnerReason);
	const mirrorReserve = useSelector(state => state.game.mirrorReserve);
	const pendingPlacement = useSelector(state => state.game.pendingPlacement);

	const stagePiecesRef = useRef();
	const stageContainerRef = useRef();
	const dispatch = useDispatch();

	const getCellSize = useCallback(() => boardWidth / VISUAL_BOARD_COLS, [boardWidth]);

	const refreshBoardSize = () => {
		const horizontalPadding = 32;
		const verticalPadding = 32;
		const availableWidth = Math.max(320, window.innerWidth - horizontalPadding);
		const availableHeight = Math.max(240, window.innerHeight - verticalPadding);
		const widthFromHeight = availableHeight * VISUAL_BOARD_ASPECT;
		setBoardWidth(Math.min(availableWidth, widthFromHeight));
	};

	useEffect(() => {
		dispatch(setBoardType());
		refreshBoardSize();
		window.addEventListener("resize", refreshBoardSize);

		return () => {
			window.removeEventListener("resize", refreshBoardSize);
		};
	}, [dispatch]);

	useEffect(() => {
		refreshBoardSize();
	}, [currentPlayer, pendingPlacement, winner]);

	useEffect(() => {
		if (laser.route.length > 0) {
			setTimeout(() => {
				dispatch(finishMovement());
			}, 1500);
		}
	}, [dispatch, laser.route]);

	const triggerRotation = useCallback((movementType, clockwise) => {
		const isPlacementActive = Boolean(pendingPlacement);
		if (isPlacementActive) {
			dispatch(rotatePendingPlacement({ clockwise }));
			return;
		}

		if (selectedPieceLocation) {
			dispatch(unselectPiece());
			const movement = new Movement(movementType, selectedPieceLocation, null);
			Board.presentPieceMovement(stagePiecesRef, movement, getCellSize());
			setTimeout(() => {
				dispatch(applyMovement({ movement: movement.serialize() }));
			}, 332);
		}
	}, [dispatch, getCellSize, pendingPlacement, selectedPieceLocation]);

	const isPlacementActive = Boolean(pendingPlacement);
	const reserveCount = mirrorReserve[currentPlayer];
	const canRotate = isPlacementActive || Boolean(selectedPieceLocation);

	const winnerLabel = winner ? winner.toUpperCase() : "";
	const winnerHeadline = winnerReason === WinReasonsEnum.DIAMOND
		? `${winnerLabel} crew secured the diamond`
		: `${winnerLabel} crew zapped the rival burglar`;
	const winnerSubline = winnerReason === WinReasonsEnum.DIAMOND
		? "The heist is over before the laser could answer."
		: "One burglar got caught in the beam.";

	const boardHeight = boardWidth / VISUAL_BOARD_ASPECT;

	return (
		<div className="heist-stage">
			{winner && (
				<div className="winner-banner">
					<p className="winner-eyebrow">Heist Complete</p>
					<h4>{winnerHeadline}</h4>
					<p className="winner-detail">{winnerSubline}</p>
					<IconButton
						className="lc-btn-control play-again-btn-inline"
						onClick={() => dispatch(resetGame())}
						aria-label="play again"
					>
						Play Again
					</IconButton>
				</div>
			)}

			<div
				className="board-shell"
				style={{ width: boardWidth, height: boardHeight }}
			>
				<div className="board" ref={stageContainerRef}>
					<ReactReduxContext.Consumer>
						{({ store }) => (
							<Stage
								key={`stage-${boardWidth}-${boardHeight}`}
								id="stage"
								className="stage"
								width={boardWidth}
								height={boardHeight}
							>
								<Provider store={store}>
									<BoardLayer
										reference={stagePiecesRef}
										cellSize={getCellSize()}
										onBoardPieceMove={(movement, srcPieceXY) => {
											if (movement.type === MovementTypesEnum.SPECIAL) {
												const [destBoardPiece] = stagePiecesRef.current.find(`#${movement.destLocation.an}`);
												destBoardPiece.to({
													x: srcPieceXY.x,
													y: srcPieceXY.y,
													duration: pieceAnimDuration,
													easing: pieceAnimEasing
												});
											}

											const delayed = !(movement.type === MovementTypesEnum.ROTATION_CLOCKWISE || movement.type === MovementTypesEnum.ROTATION_C_CLOCKWISE);
											if (delayed) {
												setTimeout(() => {
													dispatch(applyMovement({ movement: movement.serialize() }));
												}, 332);
											} else {
												dispatch(applyMovement({ movement: movement.serialize() }));
											}
										}}
									/>
								</Provider>
							</Stage>
						)}
					</ReactReduxContext.Consumer>
				</div>

				<button type="button" className="nav-arrow left" aria-label="previous">
					<span>&larr;</span>
				</button>
				<button type="button" className="nav-arrow right" aria-label="next">
					<span>&rarr;</span>
				</button>

				<div className="control-dock">
					<div className="control-dock-label">Actions</div>
					<div className="control-dock-buttons">
						<button
							type="button"
							className={`mirror-reserve-btn ${isPlacementActive ? "is-active" : ""}`}
							onClick={() => {
								if (reserveCount <= 0) {
									return;
								}
								if (isPlacementActive) {
									dispatch(cancelMirrorPlacement());
								} else {
									dispatch(startMirrorPlacement());
								}
							}}
							disabled={reserveCount <= 0}
						>
							<span>{isPlacementActive ? "Cancel" : "Mirror"}</span>
							<strong>{reserveCount}</strong>
						</button>
						<IconButton
							className="lc-btn-control"
							onClick={() => triggerRotation(MovementTypesEnum.ROTATION_C_CLOCKWISE, false)}
							disabled={!canRotate}
							aria-label="rotate counter-clockwise"
						>
							<RotateLeftIcon />
						</IconButton>
						<IconButton
							className="lc-btn-control"
							onClick={() => triggerRotation(MovementTypesEnum.ROTATION_CLOCKWISE, true)}
							disabled={!canRotate}
							aria-label="rotate clockwise"
						>
							<RotateRightIcon />
						</IconButton>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
