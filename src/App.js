import React, { useCallback, useRef, useState, useEffect } from "react";
import { Stage } from "react-konva";
import BoardLayer from "./components/BoardLayer";
import { pieceAnimDuration, pieceAnimEasing } from "./components/BoardPiece";
import "./App.scss";
import LogoPNG from "./assets/logo.png";
import BluePlayerProfile from "./assets/ui/blue-player-profile.png";
import RedPlayerProfile from "./assets/ui/red-player-profile.png";
import { Provider, ReactReduxContext, useDispatch, useSelector } from "react-redux";
import { setBoardType, applyMovement, finishMovement, unselectPiece, resetGame } from "./redux/slices/gameSlice";
import { MovementTypesEnum, PlayerTypesEnum } from "./models/Enums";
import Board from "./models/Board";
import { IconButton } from "@material-ui/core";
import RotateLeftIcon from "@material-ui/icons/RotateLeft";
import RotateRightIcon from "@material-ui/icons/RotateRight";
import Movement from "./models/Movement";



function App() {

	// The stage width. This is dynamic, and changes on window resize.
	const [stageWidth, setStageWidth] = useState(700);

	const selectedPieceLocation = useSelector(state => state.game.selectedPieceLocation);
	const currentPlayer = useSelector(state => state.game.currentPlayer); // It's blue by default!
	const laser = useSelector(state => state.game.laser); // So i can enable the laser after the player has moved.
	// const status = useSelector(state => state.game.status); // Current game state
	const winner = useSelector(state => state.game.winner); // The winner of this match!

	const stagePiecesRef = useRef(); // A reference to the stage, used to find BoardPieces afterwards.
	const stageContainerRef = useRef(); // A reference to the Div containing the stage
	const dispatch = useDispatch();


	// Methods
	const getBoardSize = useCallback(() => {
		return stageWidth;
	}, [stageWidth]);


	const getCellSize = useCallback(() => {
		return getBoardSize() / 10;
	}, [getBoardSize]);


	/**
	 * Resizes the stage width to match the DIV parent.
	 * For page responsiveness.
	 * This function is called on the "resize" event of the window.
	 */
	const refreshBoardSize = () => {
		const width = stageContainerRef.current.offsetWidth;
		setStageWidth(Math.min(width, window.innerHeight * 0.5)); // Limit board size for portrait
	};

	useEffect(() => {
		// Setup the board pieces.
		dispatch(setBoardType());

		// Handle stage responsiveness
		// take a look here https://developers.google.com/web/updates/2016/10/resizeobserver
		// for simplicity I will just listen window resize
		refreshBoardSize();
		window.addEventListener("resize", refreshBoardSize);

		return () => {
			// clear on unmount to prevent memory leak!
			window.removeEventListener("resize", refreshBoardSize);
		};
	}, [dispatch]);


	useEffect(() => {
		// Shows the laser path, after each move for the player on the move.
		// Automatically hides it after 2 sec.
		// ? Maybe add an option to define for how long the laser beam should be shown
		if (laser.route.length > 0) {
			setTimeout(() => {
				// finish the movement for the current player.
				dispatch(finishMovement());
			}, 1500);
		}
	}, [dispatch, laser.route]);



	// Renderers
	return (
		<div className="portrait-container">
			{winner && (
				<div className="winner-banner">
					<h4>🎉 {winner.toUpperCase()} player wins!</h4>
					<IconButton 
						className="lc-btn-control play-again-btn-inline"
						onClick={() => dispatch(resetGame())}
						aria-label="play again">
						🔄 Play Again
					</IconButton>
				</div>
			)}

			{/* Red Player Section - Top (Rotated) */}
			<div className="player-section red-section">
				<div className="player-controls rotated-180">
					<div className="player-info">
						<img height={36} src={RedPlayerProfile} alt="rpp" />
						<h4 className={currentPlayer === PlayerTypesEnum.RED ? "text-danger" : "text-muted"}>
							Red Player
						</h4>
						{currentPlayer === PlayerTypesEnum.RED && (
							<span className="badge rounded-pill bg-dark text-light">Your turn</span>
						)}
					</div>
					<div className="control-buttons">
						<IconButton 
							className="lc-btn-control"
							onClick={() => {
								if (currentPlayer === PlayerTypesEnum.RED && selectedPieceLocation) {
									dispatch(unselectPiece());
									const movement = new Movement(MovementTypesEnum.ROTATION_C_CLOCKWISE, selectedPieceLocation, null);
									Board.presentPieceMovement(stagePiecesRef, movement, getCellSize());
									setTimeout(() => {
										dispatch(applyMovement({ movement: movement.serialize() }));
									}, 332);
								}
							}}
							disabled={selectedPieceLocation === null || currentPlayer !== PlayerTypesEnum.RED}
							aria-label="rotate piece left">
							<RotateLeftIcon />
						</IconButton>
						<IconButton 
							className="lc-btn-control"
							onClick={() => {
								if (currentPlayer === PlayerTypesEnum.RED && selectedPieceLocation) {
									dispatch(unselectPiece());
									const movement = new Movement(MovementTypesEnum.ROTATION_CLOCKWISE, selectedPieceLocation, null);
									Board.presentPieceMovement(stagePiecesRef, movement, getCellSize());
									setTimeout(() => {
										dispatch(applyMovement({ movement: movement.serialize() }));
									}, 332);
								}
							}}
							disabled={selectedPieceLocation === null || currentPlayer !== PlayerTypesEnum.RED}
							aria-label="rotate piece right">
							<RotateRightIcon />
						</IconButton>
					</div>
				</div>
			</div>

			{/* Game Board - Center */}
			<div className="board-container">
				<div className="board" ref={stageContainerRef}>
					<ReactReduxContext.Consumer>
						{({ store }) => (
							<Stage 
								id="stage" 
								className="stage"
								onClick={(e) => {
									// if (!e.target.id()) {
									// 	dispatch(unselectPiece()); // unselect
									// }
								}}
								onTap={(e) => {
									// if (!e.target.id()) {
									// 	dispatch(unselectPiece()); // unselect
									// }
								}}
								width={getBoardSize()}
								height={getBoardSize() - (2 * (getCellSize()))}>

								<Provider store={store}>
									<BoardLayer
										reference={stagePiecesRef}
										cellSize={getCellSize()}
										onBoardPieceMove={(movement, srcPieceXY) => {
											// For Special move only, we need to animate the switch manually.
											if (movement.type === MovementTypesEnum.SPECIAL) {
												const [destBoardPiece] = stagePiecesRef.current.find(`#${movement.destLocation.an}`);
												destBoardPiece.to({
													x: srcPieceXY.x,
													y: srcPieceXY.y,
													duration: pieceAnimDuration,
													easing: pieceAnimEasing
												});
											}

											// Perform the movement
											let delayed = !(movement.type === MovementTypesEnum.ROTATION_CLOCKWISE || movement.type === MovementTypesEnum.ROTATION_C_CLOCKWISE);
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

			{/* Blue Player Section - Bottom */}
			<div className="player-section blue-section">
				<div className="player-controls">
					<div className="player-info">
						<img height={36} src={BluePlayerProfile} alt="bpp" />
						<h4 className={currentPlayer === PlayerTypesEnum.BLUE ? "text-primary" : "text-muted"}>
							Blue Player
						</h4>
						{currentPlayer === PlayerTypesEnum.BLUE && (
							<span className="badge rounded-pill bg-dark text-light">Your turn</span>
						)}
					</div>
					<div className="control-buttons">
						<IconButton 
							className="lc-btn-control"
							onClick={() => {
								if (currentPlayer === PlayerTypesEnum.BLUE && selectedPieceLocation) {
									dispatch(unselectPiece());
									const movement = new Movement(MovementTypesEnum.ROTATION_C_CLOCKWISE, selectedPieceLocation, null);
									Board.presentPieceMovement(stagePiecesRef, movement, getCellSize());
									setTimeout(() => {
										dispatch(applyMovement({ movement: movement.serialize() }));
									}, 332);
								}
							}}
							disabled={selectedPieceLocation === null || currentPlayer !== PlayerTypesEnum.BLUE}
							aria-label="rotate piece left">
							<RotateLeftIcon />
						</IconButton>
						<IconButton 
							className="lc-btn-control"
							onClick={() => {
								if (currentPlayer === PlayerTypesEnum.BLUE && selectedPieceLocation) {
									dispatch(unselectPiece());
									const movement = new Movement(MovementTypesEnum.ROTATION_CLOCKWISE, selectedPieceLocation, null);
									Board.presentPieceMovement(stagePiecesRef, movement, getCellSize());
									setTimeout(() => {
										dispatch(applyMovement({ movement: movement.serialize() }));
									}, 332);
								}
							}}
							disabled={selectedPieceLocation === null || currentPlayer !== PlayerTypesEnum.BLUE}
							aria-label="rotate piece right">
							<RotateRightIcon />
						</IconButton>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;