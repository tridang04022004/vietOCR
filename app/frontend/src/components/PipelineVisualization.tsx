import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCcw, Layers } from 'lucide-react';
import { apiClient } from '../api/client';
import type { VisualizationResponse, VisualizationMetadata, LayerState, StageMode, BoundingBox } from '../types/visualization';

interface Props {
  documentId: number;
  pageNumber: number;
  totalPages: number;
}

// Color scheme for layout overlays
const COLORS = {
  layout: {
    text: { fill: 'rgba(59, 130, 246, 0.3)', stroke: 'rgb(59, 130, 246)' },
    title: { fill: 'rgba(34, 197, 94, 0.3)', stroke: 'rgb(34, 197, 94)' },
    table: { fill: 'rgba(239, 68, 68, 0.3)', stroke: 'rgb(239, 68, 68)' },
    figure: { fill: 'rgba(168, 85, 247, 0.3)', stroke: 'rgb(168, 85, 247)' },
    list: { fill: 'rgba(249, 115, 22, 0.3)', stroke: 'rgb(249, 115, 22)' },
  },
};

export function PipelineVisualization({ documentId, pageNumber, totalPages }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [metadata, setMetadata] = useState<VisualizationMetadata | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Layer controls
  const [layers, setLayers] = useState<LayerState>({
    layout: true,
    lines: false,
    tables: false,
  });

  // Stage mode - only layout now
  const [stageMode, setStageMode] = useState<StageMode>('layout');

  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Hover state
  const [hoveredBox, setHoveredBox] = useState<BoundingBox | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Load visualization data
  useEffect(() => {
    loadVisualization();
  }, [documentId, pageNumber]);

  // Keep only layout layer enabled
  useEffect(() => {
    setLayers({ layout: true, lines: false, tables: false });
  }, [stageMode]);

  // Redraw canvas when state changes
  useEffect(() => {
    if (image && metadata) {
      drawCanvas();
    }
  }, [image, metadata, layers, scale, offset, hoveredBox]);

  const loadVisualization = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiClient.getVisualization(documentId, pageNumber);

      // Load image
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setMetadata(data.metadata);
        setLoading(false);
      };
      img.onerror = () => {
        setError('Failed to load image');
        setLoading(false);
      };
      img.src = `data:image/png;base64,${data.image_base64}`;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load visualization data');
      setLoading(false);
    }
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !metadata) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context state
    ctx.save();

    // Apply transformations
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Draw image
    const imgScale = Math.min(canvas.width / image.width, canvas.height / image.height) * 0.9;
    const imgWidth = image.width * imgScale;
    const imgHeight = image.height * imgScale;
    const imgX = (canvas.width / scale - imgWidth) / 2;
    const imgY = (canvas.height / scale - imgHeight) / 2;

    ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);

    // Calculate scale factor for bounding boxes
    // Use the actual displayed image dimensions, not metadata dimensions
    const bboxScaleX = imgWidth / image.width;
    const bboxScaleY = imgHeight / image.height;

    // Draw layout boxes
    if (layers.layout && metadata.layout) {
      metadata.layout.forEach((box) => {
        const [x1, y1, x2, y2] = box.bbox;
        const color = COLORS.layout[box.class as keyof typeof COLORS.layout] || COLORS.layout.text;

        ctx.fillStyle = color.fill;
        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = 2 / scale;

        const bx = imgX + x1 * bboxScaleX;
        const by = imgY + y1 * bboxScaleY;
        const bw = (x2 - x1) * bboxScaleX;
        const bh = (y2 - y1) * bboxScaleY;

        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);

        // Draw label
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(bx, by - 20 / scale, bw, 20 / scale);
        ctx.fillStyle = 'white';
        ctx.font = `${12 / scale}px sans-serif`;
        ctx.fillText(`${box.class} (${(box.confidence * 100).toFixed(0)}%)`, bx + 4 / scale, by - 6 / scale);
      });
    }

    // Restore context state
    ctx.restore();
  }, [image, metadata, layers, scale, offset]);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, scale * delta));

    // Zoom towards cursor position
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale);
      const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale);

      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    }
  }, [scale, offset]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
    setMousePos({ x: e.clientX, y: e.clientY });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(5, prev * 1.2));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.1, prev / 1.2));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading visualization...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-lg border border-blue-100 p-4 space-y-4">
        {/* Info text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <Layers className="inline w-4 h-4 mr-1" />
            Showing layout detection results with bounding boxes for text, titles, tables, figures, and lists.
          </p>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors ml-2"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 ml-4">
            Scroll to zoom, drag to pan
          </span>
        </div>

        {/* Color legend */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Color Legend
          </label>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center">
              <div className="w-4 h-4 rounded mr-1" style={{ backgroundColor: 'rgb(59, 130, 246)' }}></div>
              <span>Text</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded mr-1" style={{ backgroundColor: 'rgb(34, 197, 94)' }}></div>
              <span>Title</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded mr-1" style={{ backgroundColor: 'rgb(239, 68, 68)' }}></div>
              <span>Table</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded mr-1" style={{ backgroundColor: 'rgb(168, 85, 247)' }}></div>
              <span>Figure</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded mr-1" style={{ backgroundColor: 'rgb(249, 115, 22)' }}></div>
              <span>List</span>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="bg-gray-50 rounded-lg border border-blue-100 overflow-hidden"
        style={{ height: '600px' }}
      >
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-move"
        />
      </div>
    </div>
  );
}
