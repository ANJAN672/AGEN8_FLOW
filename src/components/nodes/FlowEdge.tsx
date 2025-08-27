import { memo, useState } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, useReactFlow } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

export const FlowEdge = memo((props: EdgeProps) => {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style } = props;
  const [isHovered, setIsHovered] = useState(false);
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getBezierPath({ 
    sourceX, 
    sourceY, 
    targetX, 
    targetY, 
    sourcePosition, 
    targetPosition 
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  return (
    <g>
      {/* Animated dotted edge path - LIVE flowing animation */}
      <BaseEdge 
        id={id} 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{ 
          stroke: isHovered ? '#ef4444' : '#6b7280', 
          strokeWidth: isHovered ? 3 : 2,
          strokeDasharray: '8 4',
          strokeLinecap: 'round',
          animation: 'dash-flow 2s linear infinite',
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
          ...style 
        }} 
      />
      
      {/* Invisible wider path for better hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={30}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      
      {/* Delete button that appears on hover */}
      {isHovered && (
        <g>
          {/* Background circle for the delete button */}
          <circle
            cx={labelX}
            cy={labelY}
            r={14}
            fill="#ef4444"
            stroke="#ffffff"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
            onClick={handleDelete}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          />
          {/* Simple X icon for delete */}
          <g 
            onClick={handleDelete}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* X mark */}
            <path
              d={`M${labelX - 4} ${labelY - 4} L${labelX + 4} ${labelY + 4} M${labelX + 4} ${labelY - 4} L${labelX - 4} ${labelY + 4}`}
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        </g>
      )}
      
      {/* CSS Animation for flowing dots */}
      <style>{`
        @keyframes dash-flow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -24; }
        }
      `}</style>
    </g>
  );
});

FlowEdge.displayName = 'FlowEdge';
