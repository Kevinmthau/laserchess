import React from "react";
import { Group, Line } from "react-konva";

const DeflectorDirectionOverlay = ({ cellSize, color, glowColor, opacity = 1 }) => {
    const halfCell = cellSize / 2;
    const borderInset = cellSize * 0.16;
    const diagonalInset = cellSize * 0.18;

    return (
        <Group listening={false} opacity={opacity}>
            <Line
                points={[
                    -halfCell + borderInset,
                    -halfCell + borderInset,
                    -halfCell + borderInset,
                    halfCell - borderInset,
                    halfCell - borderInset,
                    halfCell - borderInset
                ]}
                stroke="rgba(13, 16, 28, 0.95)"
                strokeWidth={cellSize * 0.32}
                lineCap="round"
                lineJoin="round"
                opacity={0.9}
            />
            <Line
                points={[
                    -halfCell + borderInset,
                    -halfCell + borderInset,
                    -halfCell + borderInset,
                    halfCell - borderInset,
                    halfCell - borderInset,
                    halfCell - borderInset
                ]}
                stroke={color}
                strokeWidth={cellSize * 0.19}
                lineCap="round"
                lineJoin="round"
                shadowEnabled={true}
                shadowColor={glowColor}
                shadowBlur={12}
                shadowOpacity={0.52}
            />
            <Line
                points={[
                    -halfCell + diagonalInset,
                    -halfCell + diagonalInset,
                    halfCell - diagonalInset,
                    halfCell - diagonalInset
                ]}
                stroke="rgba(255, 255, 255, 0.98)"
                strokeWidth={cellSize * 0.12}
                lineCap="round"
                shadowEnabled={true}
                shadowColor="#FFFFFF"
                shadowBlur={10}
                shadowOpacity={0.4}
            />
        </Group>
    );
};

export default DeflectorDirectionOverlay;
