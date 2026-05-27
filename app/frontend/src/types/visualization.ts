/**
 * Visualization types for pipeline stage overlays
 */

export interface BoundingBox {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  class?: string;
  confidence?: number;
  block_id?: number;
  line_id?: number;
}

export interface LayoutBox extends BoundingBox {
  class: string;
  confidence: number;
  block_id: number;
}

export interface LineBox extends BoundingBox {
  line_id: number;
}

export interface TableCell {
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TableData {
  cells: TableCell[];
  grid: {
    rows: number;
    cols: number;
  };
}

export interface VisualizationMetadata {
  image_width: number;
  image_height: number;
  layout: LayoutBox[];
  lines: Record<string, LineBox[]>;
  tables: Record<string, TableData>;
}

export interface VisualizationResponse {
  image_base64: string;
  metadata: VisualizationMetadata;
  page_number: number;
  total_pages: number;
}

export interface LayerState {
  layout: boolean;
  lines: boolean;
  tables: boolean;
}

export type StageMode = 'layout' | 'layout-lines' | 'layout-lines-tables';
