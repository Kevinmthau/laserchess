import React from "react";
import { Group, Rect } from "react-konva";
import { MovementTypesEnum } from "../models/Enums";

const PieceMoveHighlight = ({ cellSize, movement, onChoose }) => {
    const isSpecialMove = movement.type === MovementTypesEnum.SPECIAL;
    const accent = isSpecialMove ? "#FFB46B" : "#7FE39B";
    const fill = isSpecialMove ? "rgba(255, 180, 107, 0.22)" : "rgba(127, 227, 155, 0.22)";
    const inset = cellSize * 0.08;

    return (
        <Group
            x={movement.destLocation.colIndex * cellSize}
            y={movement.destLocation.rowIndex * cellSize}
            onClick={() => onChoose(movement)}
            onTap={() => onChoose(movement)}
        >
            <Rect
                x={inset}
                y={inset}
                width={cellSize - (inset * 2)}
                height={cellSize - (inset * 2)}
                cornerRadius={cellSize * 0.18}
                fill={fill}
                stroke={accent}
                strokeWidth={2}
                shadowEnabled={true}
                shadowColor={accent}
                shadowBlur={18}
                opacity={0.95}
            />
        </Group>
    );
};

export default PieceMoveHighlight;
