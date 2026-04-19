import React from "react";
import { Circle, Group, Rect } from "react-konva";
import { MovementTypesEnum } from "../models/Enums";

const PieceMoveHighlight = ({ cellSize, movement, onChoose }) => {
    const isSpecialMove = movement.type === MovementTypesEnum.SPECIAL;
    const accent = isSpecialMove ? "#FF7A99" : "#61F3FF";
    const inset = cellSize * 0.16;

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
                cornerRadius={cellSize * 0.16}
                stroke={accent}
                strokeWidth={2}
                shadowEnabled={true}
                shadowColor={accent}
                shadowBlur={14}
                opacity={0.95}
            />
            <Circle
                x={cellSize / 2}
                y={cellSize / 2}
                radius={isSpecialMove ? cellSize * 0.12 : cellSize * 0.09}
                fill={accent}
                shadowEnabled={true}
                shadowColor={accent}
                shadowBlur={18}
            />
        </Group>
    );
};

export default PieceMoveHighlight;
