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

function App() {
	const [stageWidth, setStageWidth] = useState(700);

	const selectedPieceLocation = useSelector(state => state.game.selectedPieceLocation);
	const currentPlayer = useSelector(state => state.game.currentPlayer);
	const laser = useSelector(state => state.game.laser);
	const winner = useSelector(state => state.game.winner);
	const winnerReason = useSelector(state => state.game.winnerReason);
	const mirrorReserve = useSelector(state => state.game.mirrorReserve);
	const pendingPlacement = useSelector(state => state.game.pendingPlacement);

	const stagePiecesRef = useRef();
	const stageContainerRef = useRef();
	const topSectionRef = useRef();
	const bottomSectionRef = useRef();
	const dispatch = useDispatch();

	const getBoardSize = useCallback(() => {
		return stageWidth;
	}, [stageWidth]);

	const getCellSize = useCallback(() => {
		return getBoardSize() / 10;
	}, [getBoardSize]);

	const refreshBoardSize = () => {
		const width = stageContainerRef.current?.offsetWidth ?? (window.innerWidth - 32);
		const topSectionHeight = topSectionRef.current?.offsetHeight ?? 0;
		const bottomSectionHeight = bottomSectionRef.current?.offsetHeight ?? 0;
		const reservedVerticalSpace = topSectionHeight + bottomSectionHeight + 64;
		const availableBoardHeight = Math.max(280, window.innerHeight - reservedVerticalSpace);
		const maxBoardWidthFromHeight = Math.max(320, (availableBoardHeight - 28) / 0.8);
		setStageWidth(Math.min(width, maxBoardWidthFromHeight));
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

	const renderRotationControls = useCallback((playerType) => {
		const isCurrentPlayer = currentPlayer === playerType;
		const accentClass = playerType === PlayerTypesEnum.BLUE ? "is-blue" : "is-red";
		const label = playerType === PlayerTypesEnum.BLUE ? "Blue Crew" : "Red Crew";
		const reserveCount = mirrorReserve[playerType];
		const isPlacementActive = pendingPlacement?.playerType === playerType;
		const copy = isCurrentPlayer
			? isPlacementActive
				? `Mirror queued at ${pendingPlacement.orientation}°. Click a highlighted square to place it.`
				: "Move your burglar or place a mirror. The laser fires after every move."
			: "Protect your burglar. Control the mirror lanes.";

		const triggerRotation = (movementType, clockwise) => {
			if (isCurrentPlayer && isPlacementActive) {
				dispatch(rotatePendingPlacement({ clockwise }));
				return;
			}

			if (isCurrentPlayer && selectedPieceLocation) {
				dispatch(unselectPiece());
				const movement = new Movement(movementType, selectedPieceLocation, null);
				Board.presentPieceMovement(stagePiecesRef, movement, getCellSize());
				setTimeout(() => {
					dispatch(applyMovement({ movement: movement.serialize() }));
				}, 332);
			}
		};

		return (
			<div className={`player-controls ${accentClass}`}>
				<div className="player-meta">
					<span className="player-emblem" />
					<div className="player-copy">
						<h4>{label}</h4>
						<p>{copy}</p>
					</div>
				</div>
				{isCurrentPlayer && <span className={`turn-pill ${accentClass}`}>Your turn</span>}
				<div className="control-buttons">
					<button
						type="button"
						className={`mirror-reserve-btn ${isPlacementActive ? "is-active" : ""}`}
						onClick={() => {
							if (!isCurrentPlayer || reserveCount <= 0) {
								return;
							}

							if (isPlacementActive) {
								dispatch(cancelMirrorPlacement());
							} else {
								dispatch(startMirrorPlacement());
							}
						}}
						disabled={!isCurrentPlayer || reserveCount <= 0}
					>
						<span>{isPlacementActive ? "Cancel Mirror" : "Place Mirror"}</span>
						<strong>{reserveCount} left</strong>
					</button>
					<IconButton
						className="lc-btn-control"
						onClick={() => triggerRotation(MovementTypesEnum.ROTATION_C_CLOCKWISE, false)}
						disabled={(!isPlacementActive && selectedPieceLocation === null) || !isCurrentPlayer}
						aria-label={`rotate ${label} piece left`}
					>
						<RotateLeftIcon />
					</IconButton>
					<IconButton
						className="lc-btn-control"
						onClick={() => triggerRotation(MovementTypesEnum.ROTATION_CLOCKWISE, true)}
						disabled={(!isPlacementActive && selectedPieceLocation === null) || !isCurrentPlayer}
						aria-label={`rotate ${label} piece right`}
					>
						<RotateRightIcon />
					</IconButton>
				</div>
			</div>
		);
	}, [currentPlayer, dispatch, getCellSize, mirrorReserve, pendingPlacement, selectedPieceLocation]);

	const winnerLabel = winner ? winner.toUpperCase() : "";
	const winnerHeadline = winnerReason === WinReasonsEnum.DIAMOND
		? `${winnerLabel} crew secured the diamond`
		: `${winnerLabel} crew zapped the rival burglar`;
	const winnerSubline = winnerReason === WinReasonsEnum.DIAMOND
		? "The heist is over before the laser could answer."
		: "One burglar got caught in the beam.";

	return (
		<div className="portrait-container">
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

			<div className="player-section red-section" ref={topSectionRef}>
				{renderRotationControls(PlayerTypesEnum.RED)}
			</div>

			<div className="board-container">
				<div className="board-shell">
					<div className="board" ref={stageContainerRef}>
						<ReactReduxContext.Consumer>
							{({ store }) => (
								<Stage
									id="stage"
									className="stage"
									width={getBoardSize()}
									height={getBoardSize() - (2 * getCellSize())}
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

				</div>
			</div>

			<div className="player-section blue-section" ref={bottomSectionRef}>
				{renderRotationControls(PlayerTypesEnum.BLUE)}
			</div>
		</div>
	);
}

export default App;
