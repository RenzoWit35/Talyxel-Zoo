import { Maximize, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { isLineKind, minPoints, type HabitatKind } from '../../../shared/constants';
import {
  bounds,
  clampPoint,
  clampedTranslate,
  formatArea,
  formatLength,
  labelPoint,
  lineMidpoint,
  pointInPolygon,
  polygonArea,
  polylineLength,
  roundPoint,
  type Point,
} from '../../../shared/geometry';
import type { Habitat } from '../../../shared/types';
import { shade } from '../../lib/color';
import { drawOrder, pointsAttr } from '../../lib/shapes';
import { HoverCard } from './HoverCard';
import { ShapeDecor, TerrainDefs, TerrainGround, TerrainShadows, terrainUnit } from './terrain';

export type Tool = 'select' | 'polygon' | 'rect' | 'line' | 'pan';

interface Props {
  width: number;
  height: number;
  habitats: Habitat[];
  background?: { url: string; opacity: number } | null;
  editable?: boolean;
  tool?: Tool;
  snap?: boolean;
  selectedId?: number | null;
  /** Shape types switched off in the layers menu; they're neither drawn nor clickable. */
  hiddenKinds?: ReadonlySet<HabitatKind>;
  onSelect?: (id: number | null) => void;
  /** Called once a drag / nudge / vertex edit finishes, with the habitat's new outline. */
  onChangePoints?: (id: number, points: Point[]) => void;
  onCreateShape?: (points: Point[]) => void;
  onDeleteRequest?: (id: number) => void;
  onDraftChange?: (pointCount: number) => void;
  hoverHint?: string;
}

interface View {
  scale: number; // screen px per metre
  cx: number;
  cy: number;
}

type Interaction =
  | { type: 'pan'; pointerId: number; sx: number; sy: number; cx: number; cy: number; moved: boolean; clickId: number | null; click: 'select' | 'draw' | null }
  | { type: 'move'; pointerId: number; id: number; start: Point; original: Point[]; sx: number; sy: number; moved: boolean }
  | { type: 'vertex'; pointerId: number; id: number; index: number; original: Point[] }
  | { type: 'rect'; pointerId: number; start: Point }
  | { type: 'pinch'; startDist: number; startScale: number; world: Point };

const GRID_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const SCALE_BAR = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
const MAX_SCALE = 60;
const CLICK_SLOP = 4;
const NO_KINDS: ReadonlySet<HabitatKind> = new Set();

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Lucide's map pin, drawn at constant screen size (24 px) with its tip on the anchor point. */
const PIN_PATH = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0';

/** Small chevrons along a walk route, pointing the way it was drawn. */
function routeArrows(points: Point[], px: number): Point[][] {
  const arrows: Point[][] = [];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len / px < 64) continue;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const s = 3.6 * px;
    arrows.push([
      [mx + ux * s, my + uy * s],
      [mx - ux * s - uy * s, my - uy * s + ux * s],
      [mx - ux * s * 0.35, my - uy * s * 0.35],
      [mx - ux * s + uy * s, my - uy * s - ux * s],
    ]);
  }
  return arrows;
}

export function MapCanvas({
  width,
  height,
  habitats,
  background,
  editable = false,
  tool = 'select',
  snap = true,
  selectedId = null,
  hiddenKinds = NO_KINDS,
  onSelect,
  onChangePoints,
  onCreateShape,
  onDeleteRequest,
  onDraftChange,
  hoverHint,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ id: number; points: Point[] } | null>(null);
  const [draft, setDraft] = useState<Point[]>([]);
  const [rect, setRect] = useState<[Point, Point] | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [dragging, setDragging] = useState(false);
  const interaction = useRef<Interaction | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastMouse = useRef({ x: 0, y: 0 });
  const toolRef = useRef(tool);
  toolRef.current = tool;

  const visible = useMemo(() => (hiddenKinds.size ? habitats.filter((h) => !hiddenKinds.has(h.kind)) : habitats), [habitats, hiddenKinds]);
  const drawingTool = tool === 'polygon' || tool === 'rect' || tool === 'line';

  // ---------- viewport ----------

  useLayoutEffect(() => {
    const el = containerRef.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitScale = size.w && size.h ? Math.min(size.w / (width * 1.08), size.h / (height * 1.08)) : 1;
  const minScale = fitScale / 3;

  const fit = useCallback(() => setView({ scale: fitScale, cx: width / 2, cy: height / 2 }), [fitScale, width, height]);

  // Fit on first layout and whenever the map itself changes size.
  const fittedFor = useRef('');
  useEffect(() => {
    if (!size.w || !size.h) return;
    const key = `${width}x${height}`;
    if (fittedFor.current !== key) {
      fittedFor.current = key;
      fit();
    }
  }, [size, width, height, fit]);

  const v = view ?? { scale: fitScale, cx: width / 2, cy: height / 2 };
  const vw = size.w / v.scale;
  const vh = size.h / v.scale;
  const vx = v.cx - vw / 2;
  const vy = v.cy - vh / 2;

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const r = containerRef.current!.getBoundingClientRect();
      return [vx + (clientX - r.left) / v.scale, vy + (clientY - r.top) / v.scale];
    },
    [vx, vy, v.scale],
  );

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      setView((prev) => {
        const cur = prev ?? { scale: fitScale, cx: width / 2, cy: height / 2 };
        const scale = Math.min(MAX_SCALE, Math.max(minScale, cur.scale * factor));
        if (clientX === undefined || clientY === undefined) return { ...cur, scale };
        const r = containerRef.current!.getBoundingClientRect();
        const sx = clientX - r.left - r.width / 2;
        const sy = clientY - r.top - r.height / 2;
        // keep the world point under the cursor fixed
        const wx = cur.cx + sx / cur.scale;
        const wy = cur.cy + sy / cur.scale;
        return { scale, cx: wx - sx / scale, cy: wy - sy / scale };
      });
    },
    [fitScale, minScale, width, height],
  );

  useEffect(() => {
    const el = containerRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // ---------- snapping ----------

  const gridStep = GRID_STEPS.find((s) => s * v.scale >= 14) ?? 500;

  const snapPoint = useCallback(
    (p: Point, opts: { excludeId?: number; extra?: Point[]; free?: boolean } = {}): Point => {
      const clamped = clampPoint(p, width, height);
      if (!snap || opts.free) return roundPoint(clamped);
      const tolerance = 9 / v.scale;
      let best: Point | null = null;
      let bestDist = tolerance;
      const consider = (q: Point) => {
        const d = Math.hypot(q[0] - clamped[0], q[1] - clamped[1]);
        if (d < bestDist) {
          bestDist = d;
          best = q;
        }
      };
      for (const h of visible) if (h.id !== opts.excludeId) h.points.forEach(consider);
      opts.extra?.forEach(consider);
      if (best) return [...(best as Point)] as Point;
      return roundPoint(clampPoint([Math.round(clamped[0] / gridStep) * gridStep, Math.round(clamped[1] / gridStep) * gridStep], width, height));
    },
    [snap, v.scale, visible, gridStep, width, height],
  );

  // ---------- drawing ----------

  const finishDraft = useCallback(
    (pts: Point[]) => {
      setDraft([]);
      setCursor(null);
      const ok = toolRef.current === 'line' ? pts.length >= 2 && polylineLength(pts) > 0.5 : pts.length >= 3 && polygonArea(pts) > 0.5;
      if (ok) onCreateShape?.(pts);
    },
    [onCreateShape],
  );

  useEffect(() => {
    onDraftChange?.(draft.length);
  }, [draft.length, onDraftChange]);

  useEffect(() => {
    // switching tools abandons any half-drawn shape
    setDraft([]);
    setRect(null);
    setCursor(null);
  }, [tool]);

  const addDraftPoint = (clientX: number, clientY: number, free: boolean) => {
    const raw = toWorld(clientX, clientY);
    const p = snapPoint(raw, { extra: tool === 'line' ? draft : draft.slice(0, 1), free });
    const last = draft[draft.length - 1];
    if (tool === 'line') {
      // Clicking the last point again (or double-clicking) ends the route.
      if (last && draft.length >= 2 && Math.hypot(last[0] - p[0], last[1] - p[1]) * v.scale < 10) return finishDraft(draft);
    } else if (draft.length >= 3) {
      const [fx, fy] = draft[0];
      if (Math.hypot(fx - p[0], fy - p[1]) * v.scale < 10) return finishDraft(draft);
    }
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) * v.scale < 3) return; // double-click duplicates
    setDraft([...draft, p]);
  };

  // ---------- pointer handling ----------

  const habitatById = useMemo(() => new Map(visible.map((h) => [h.id, h])), [visible]);

  const targetInfo = (target: EventTarget) => {
    const el = (target as Element).closest?.('[data-hid], [data-vertex], [data-mid]') as SVGElement | null;
    if (!el) return {};
    if (el.dataset.vertex !== undefined) return { vertex: Number(el.dataset.vertex) };
    if (el.dataset.mid !== undefined) return { mid: Number(el.dataset.mid) };
    return { hid: Number(el.dataset.hid) };
  };

  const startPan = (e: ReactPointerEvent, clickId: number | null, click: 'select' | 'draw' | null) => {
    interaction.current = { type: 'pan', pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, cx: v.cx, cy: v.cy, moved: false, clickId, click };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      interaction.current = { type: 'pinch', startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1, startScale: v.scale, world: toWorld(mid.x, mid.y) };
      setPreview(null);
      setRect(null);
      return;
    }
    if (pointers.current.size > 2) return;

    const info = targetInfo(e.target);
    if (e.button === 1 || tool === 'pan' || spaceHeld) return startPan(e, null, null);
    if (!editable) return startPan(e, info.hid ?? null, 'select');

    if (tool === 'polygon' || tool === 'line') return startPan(e, null, 'draw');
    if (tool === 'rect') {
      const p = snapPoint(toWorld(e.clientX, e.clientY), { free: e.altKey });
      interaction.current = { type: 'rect', pointerId: e.pointerId, start: p };
      setRect([p, p]);
      return;
    }

    // select tool
    const selected = selectedId !== null ? habitatById.get(selectedId) : undefined;
    if (selected && info.vertex !== undefined) {
      interaction.current = { type: 'vertex', pointerId: e.pointerId, id: selected.id, index: info.vertex, original: selected.points };
      setDragging(true);
      return;
    }
    if (selected && info.mid !== undefined) {
      const i = info.mid;
      const a = selected.points[i];
      const b = selected.points[(i + 1) % selected.points.length];
      const inserted = [...selected.points.slice(0, i + 1), roundPoint([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), ...selected.points.slice(i + 1)];
      interaction.current = { type: 'vertex', pointerId: e.pointerId, id: selected.id, index: i + 1, original: selected.points };
      setPreview({ id: selected.id, points: inserted });
      setDragging(true);
      return;
    }
    if (info.hid !== undefined) {
      const h = habitatById.get(info.hid);
      if (!h) return;
      if (info.hid !== selectedId) onSelect?.(info.hid);
      interaction.current = {
        type: 'move',
        pointerId: e.pointerId,
        id: h.id,
        start: toWorld(e.clientX, e.clientY),
        original: h.points,
        sx: e.clientX,
        sy: e.clientY,
        moved: false,
      };
      return;
    }
    startPan(e, null, null);
    onSelect?.(null);
  };

  const positionHoverCard = (clientX: number, clientY: number) => {
    const card = hoverRef.current;
    const box = containerRef.current?.getBoundingClientRect();
    if (!card || !box) return;
    const sx = clientX - box.left;
    const sy = clientY - box.top;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    let x = sx + 18;
    if (x + cw > box.width - 8) x = sx - cw - 18;
    x = Math.max(8, x);
    const bottom = Math.min(box.height, window.innerHeight - box.top) - 8;
    let y = sy + 18;
    if (y + ch > bottom) y = Math.max(8, Math.max(-box.top + 8, bottom - ch));
    card.style.transform = `translate(${x}px, ${y}px)`;
  };

  useLayoutEffect(() => {
    if (hoveredId !== null) positionHoverCard(lastMouse.current.x, lastMouse.current.y);
  }, [hoveredId]);

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    lastMouse.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const it = interaction.current;

    if (!it) {
      if (editable && drawingTool) {
        setCursor(snapPoint(toWorld(e.clientX, e.clientY), { extra: tool === 'line' ? draft : draft.slice(0, 1), free: e.altKey }));
      }
      if (e.pointerType === 'mouse') {
        const info = targetInfo(e.target);
        const id = info.hid ?? null;
        if (id !== hoveredId) setHoveredId(id);
        if (id !== null) positionHoverCard(e.clientX, e.clientY);
      }
      return;
    }

    switch (it.type) {
      case 'pinch': {
        if (pointers.current.size < 2) return;
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const scale = Math.min(MAX_SCALE, Math.max(minScale, it.startScale * (dist / it.startDist)));
        const r = containerRef.current!.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - r.left - r.width / 2;
        const my = (a.y + b.y) / 2 - r.top - r.height / 2;
        setView({ scale, cx: it.world[0] - mx / scale, cy: it.world[1] - my / scale });
        return;
      }
      case 'pan': {
        if (e.pointerId !== it.pointerId) return;
        const dx = e.clientX - it.sx;
        const dy = e.clientY - it.sy;
        if (!it.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
        if (!it.moved) {
          it.moved = true;
          setDragging(true);
          setHoveredId(null);
        }
        setView((cur) => ({ ...(cur ?? v), cx: it.cx - dx / v.scale, cy: it.cy - dy / v.scale }));
        return;
      }
      case 'move': {
        if (e.pointerId !== it.pointerId) return;
        if (!it.moved && Math.hypot(e.clientX - it.sx, e.clientY - it.sy) < CLICK_SLOP) return;
        if (!it.moved) {
          it.moved = true;
          setDragging(true);
          setHoveredId(null);
        }
        const p = toWorld(e.clientX, e.clientY);
        let dx = p[0] - it.start[0];
        let dy = p[1] - it.start[1];
        if (snap && !e.altKey) {
          dx = Math.round(dx / gridStep) * gridStep;
          dy = Math.round(dy / gridStep) * gridStep;
        }
        setPreview({ id: it.id, points: clampedTranslate(it.original, dx, dy, width, height).map((q) => roundPoint(q)) });
        return;
      }
      case 'vertex': {
        if (e.pointerId !== it.pointerId) return;
        const p = snapPoint(toWorld(e.clientX, e.clientY), { excludeId: it.id, free: e.altKey });
        setPreview((prev) => {
          const base = prev?.id === it.id ? prev.points : it.original;
          const next = base.slice();
          next[it.index] = p;
          return { id: it.id, points: next };
        });
        return;
      }
      case 'rect': {
        if (e.pointerId !== it.pointerId) return;
        setRect([it.start, snapPoint(toWorld(e.clientX, e.clientY), { free: e.altKey })]);
        return;
      }
    }
  };

  const endInteraction = (e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    pointers.current.delete(e.pointerId);
    const it = interaction.current;
    if (!it) return;
    if (it.type === 'pinch') {
      if (pointers.current.size < 2) interaction.current = null;
      return;
    }
    if (e.pointerId !== it.pointerId) return;
    interaction.current = null;
    setDragging(false);

    if (cancelled) {
      setPreview(null);
      setRect(null);
      return;
    }

    switch (it.type) {
      case 'pan':
        if (!it.moved && it.click === 'select') onSelect?.(it.clickId);
        if (!it.moved && it.click === 'draw') addDraftPoint(e.clientX, e.clientY, e.altKey);
        break;
      case 'move':
      case 'vertex':
        if (preview?.id === it.id) onChangePoints?.(it.id, preview.points);
        setPreview(null);
        break;
      case 'rect': {
        const [a, b] = rect ?? [it.start, it.start];
        setRect(null);
        if (Math.abs(a[0] - b[0]) >= 1 && Math.abs(a[1] - b[1]) >= 1) {
          onCreateShape?.([
            [Math.min(a[0], b[0]), Math.min(a[1], b[1])],
            [Math.max(a[0], b[0]), Math.min(a[1], b[1])],
            [Math.max(a[0], b[0]), Math.max(a[1], b[1])],
            [Math.min(a[0], b[0]), Math.max(a[1], b[1])],
          ]);
        }
        break;
      }
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (!editable) return;
    e.preventDefault();
    const info = targetInfo(e.target);
    const selected = selectedId !== null ? habitatById.get(selectedId) : undefined;
    if (selected && info.vertex !== undefined && selected.points.length > minPoints(selected.kind)) {
      onChangePoints?.(
        selected.id,
        selected.points.filter((_, i) => i !== info.vertex),
      );
    }
  };

  // ---------- keyboard ----------

  const latest = useRef({ draft, selectedId, tool, habitatById, gridStep, snap, width, height });
  latest.current = { draft, selectedId, tool, habitatById, gridStep, snap, width, height };

  useEffect(() => {
    if (!editable) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey) return;
      const s = latest.current;
      if (e.key === ' ') {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }
      if (e.key === 'Escape') {
        if (s.draft.length) setDraft([]);
        else onSelect?.(null);
        return;
      }
      if (e.key === 'Enter' && s.draft.length >= (s.tool === 'line' ? 2 : 3)) {
        e.preventDefault();
        finishDraft(s.draft);
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (s.draft.length) {
          e.preventDefault();
          setDraft(s.draft.slice(0, -1));
        } else if (s.selectedId !== null) {
          e.preventDefault();
          onDeleteRequest?.(s.selectedId);
        }
        return;
      }
      const arrows: Record<string, Point> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key] && s.selectedId !== null && s.tool === 'select') {
        const h = s.habitatById.get(s.selectedId);
        if (!h) return;
        e.preventDefault();
        const step = (s.snap ? s.gridStep : 1) * (e.shiftKey ? 5 : 1);
        const [dx, dy] = arrows[e.key];
        onChangePoints?.(h.id, clampedTranslate(h.points, dx * step, dy * step, s.width, s.height).map((p) => roundPoint(p)));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [editable, finishDraft, onChangePoints, onDeleteRequest, onSelect]);

  // ---------- render ----------

  const shapes = useMemo(
    () =>
      visible
        .map((h) => (preview?.id === h.id ? { ...h, points: preview.points } : h))
        .sort((a, b) => {
          if (a.id === selectedId) return 1;
          if (b.id === selectedId) return -1;
          return drawOrder(a, b);
        }),
    [visible, preview, selectedId],
  );
  const selected = shapes.find((h) => h.id === selectedId);
  const selectedIsLine = !!selected && isLineKind(selected.kind);
  // While editing, the selected shape's details live in the side panel, so skip its hover card.
  const showHover = hoveredId !== null && !dragging && !draft.length && !rect && !(editable && (hoveredId === selectedId || tool !== 'select'));
  const hovered = showHover ? habitatById.get(hoveredId) : undefined;
  const px = 1 / v.scale; // one screen pixel in world units
  const scaleBar = SCALE_BAR.find((m) => m * v.scale >= 70) ?? 2000;
  const drawingLine = tool === 'line';

  const cursorClass =
    tool === 'pan' || spaceHeld || (!editable && dragging) ? (dragging ? 'is-grabbing' : 'is-grab') : editable && drawingTool ? 'is-crosshair' : '';

  const drawingLabel = (() => {
    if (rect) {
      const [a, b] = rect;
      return { at: b, text: `${formatLength(Math.abs(a[0] - b[0]))} × ${formatLength(Math.abs(a[1] - b[1]))}` };
    }
    if (draft.length && cursor) {
      const last = draft[draft.length - 1];
      const seg = Math.hypot(cursor[0] - last[0], cursor[1] - last[1]);
      if (drawingLine) return { at: cursor, text: `${formatLength(seg)} · route ${formatLength(polylineLength([...draft, cursor]))}` };
      const area = draft.length >= 2 ? ` · ${formatArea(polygonArea([...draft, cursor]))}` : '';
      return { at: cursor, text: `${formatLength(seg)}${area}` };
    }
    return null;
  })();

  const prefix = `m${useId().replace(/:/g, '')}`;
  const u = terrainUnit(width, height);

  const shapeClass = (h: Habitat) =>
    `shape kind-${h.kind} status-${h.status}${h.id === selectedId ? ' selected' : ''}${h.id === hoveredId ? ' hovered' : ''}`;

  return (
    <div
      ref={containerRef}
      className={`map-canvas ${cursorClass}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endInteraction(e)}
      onPointerCancel={(e) => endInteraction(e, true)}
      onPointerLeave={() => {
        setHoveredId(null);
        setCursor(null);
      }}
      onDoubleClick={() => editable && draft.length >= (drawingLine ? 2 : 3) && (tool === 'polygon' || drawingLine) && finishDraft(draft)}
      onContextMenu={onContextMenu}
    >
      {size.w > 0 && (
        <svg width={size.w} height={size.h} viewBox={`${vx} ${vy} ${vw} ${vh}`} className="map-svg">
          <defs>
            <pattern id="grid-minor" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
              <path d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`} fill="none" stroke="var(--ground-line)" strokeWidth={px} />
            </pattern>
            <pattern id="grid-major" width={gridStep * 5} height={gridStep * 5} patternUnits="userSpaceOnUse">
              <path d={`M ${gridStep * 5} 0 L 0 0 0 ${gridStep * 5}`} fill="none" stroke="var(--ground-line-major)" strokeWidth={px * 1.2} />
            </pattern>
            <pattern id="building-stripes" width={10 * px} height={10 * px} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={4 * px} height={10 * px} fill="rgba(255,255,255,0.35)" />
            </pattern>
            <pattern id="utility-hatch" width={7 * px} height={7 * px} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <rect width={1.4 * px} height={7 * px} fill="rgba(20,28,36,0.28)" />
            </pattern>
            <TerrainDefs prefix={prefix} u={u} />
          </defs>

          <rect x={0} y={0} width={width} height={height} className="map-ground" />
          <TerrainGround prefix={prefix} width={width} height={height} u={u} />
          {background && <image href={background.url} x={0} y={0} width={width} height={height} preserveAspectRatio="none" opacity={background.opacity} />}
          <rect x={0} y={0} width={width} height={height} fill="url(#grid-minor)" pointerEvents="none" />
          <rect x={0} y={0} width={width} height={height} fill="url(#grid-major)" pointerEvents="none" />
          <rect x={0} y={0} width={width} height={height} className="map-border" vectorEffect="non-scaling-stroke" />

          <TerrainShadows shapes={shapes} u={u} />
          <g className="map-shapes">
            {shapes.map((h) =>
              isLineKind(h.kind) ? (
                <g key={h.id} data-hid={h.id} className={shapeClass(h)}>
                  <polyline points={pointsAttr(h.points)} className="route-hit" vectorEffect="non-scaling-stroke" />
                  <polyline points={pointsAttr(h.points)} className="route-casing" stroke={shade(h.color, -0.5)} vectorEffect="non-scaling-stroke" />
                  <polyline points={pointsAttr(h.points)} className="route-line" stroke={h.color} vectorEffect="non-scaling-stroke" />
                  {routeArrows(h.points, px).map((a, i) => (
                    <polygon key={i} points={pointsAttr(a)} className="route-arrow" fill={shade(h.color, -0.55)} pointerEvents="none" />
                  ))}
                  <circle cx={h.points[0][0]} cy={h.points[0][1]} r={4.2 * px} className="route-start" stroke={shade(h.color, -0.5)} pointerEvents="none" />
                  <circle
                    cx={h.points[h.points.length - 1][0]}
                    cy={h.points[h.points.length - 1][1]}
                    r={4.2 * px}
                    className="route-end"
                    fill={shade(h.color, -0.5)}
                    pointerEvents="none"
                  />
                </g>
              ) : (
                <g key={h.id} data-hid={h.id} className={shapeClass(h)}>
                  <polygon
                    points={pointsAttr(h.points)}
                    fill={h.color}
                    stroke={shade(h.color, -0.38)}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                  <ShapeDecor shape={h} u={u} prefix={prefix} />
                  {h.kind === 'utility' && <polygon points={pointsAttr(h.points)} fill="url(#utility-hatch)" pointerEvents="none" />}
                  {h.status === 'building' && <polygon points={pointsAttr(h.points)} fill="url(#building-stripes)" pointerEvents="none" />}
                </g>
              ),
            )}
          </g>

          <g className="map-labels" pointerEvents="none">
            {shapes.map((h) => {
              if (isLineKind(h.kind)) {
                if (polylineLength(h.points) / px < 70) return null;
                const { point, angle } = lineMidpoint(h.points);
                const upright = angle > 90 || angle < -90 ? angle + 180 : angle;
                const maxChars = Math.max(4, Math.floor(polylineLength(h.points) / px / 9));
                const name = h.name.length > maxChars ? `${h.name.slice(0, maxChars - 1)}…` : h.name;
                return (
                  <text
                    key={h.id}
                    x={point[0]}
                    y={point[1]}
                    dy={-9 * px}
                    fontSize={11 * px}
                    textAnchor="middle"
                    className="map-label map-label-route"
                    transform={`rotate(${upright} ${point[0]} ${point[1]})`}
                  >
                    {name}
                  </text>
                );
              }
              const b = bounds(h.points);
              const wPx = b.width * v.scale;
              if (h.kind === 'interest') {
                const [ix, iy] = labelPoint(h.points);
                const showName = wPx >= 46;
                const name = h.name.length > 22 ? `${h.name.slice(0, 21)}…` : h.name;
                return (
                  <g key={h.id}>
                    <g transform={`translate(${ix - 12 * px} ${iy - 22 * px}) scale(${px})`} className="map-pin">
                      <path d={PIN_PATH} fill={h.color} stroke="#fff" strokeWidth={1.8} />
                      <circle cx={12} cy={10} r={3} fill="#fff" />
                    </g>
                    {showName && (
                      <text x={ix} y={iy + 13 * px} fontSize={11.5 * px} textAnchor="middle" className="map-label">
                        {name}
                      </text>
                    )}
                  </g>
                );
              }
              if (wPx < 46 || b.height * v.scale < 18) return null;
              const maxChars = Math.max(4, Math.floor(wPx / 7.2));
              const name = h.name.length > maxChars ? `${h.name.slice(0, maxChars - 1)}…` : h.name;
              if (h.kind === 'zone') {
                // Themed areas hold rides, so their name goes along the top edge instead of the middle.
                const top: Point = [(b.minX + b.maxX) / 2, b.minY + 16 * px];
                const [zx, zy] = pointInPolygon(top, h.points) ? top : labelPoint(h.points);
                return (
                  <text key={h.id} x={zx} y={zy} fontSize={11 * px} textAnchor="middle" className="map-label map-label-zone">
                    {name.toUpperCase()}
                  </text>
                );
              }
              const [lx, ly] = labelPoint(h.points);
              const showSpecies = h.species && b.height * v.scale > 44;
              const species = h.species.length > maxChars ? `${h.species.slice(0, maxChars - 1)}…` : h.species;
              return (
                <text key={h.id} x={lx} y={ly} fontSize={12.5 * px} textAnchor="middle" className="map-label">
                  <tspan x={lx} dy={showSpecies ? -2 * px : 4 * px} fontWeight={650}>
                    {name}
                  </tspan>
                  {showSpecies && (
                    <tspan x={lx} dy={14 * px} fontSize={11 * px} fontStyle="italic" className="map-label-sub">
                      {species}
                    </tspan>
                  )}
                </text>
              );
            })}
          </g>

          {editable && selected && tool === 'select' && (
            <g className="map-handles">
              {selectedIsLine ? (
                <polyline points={pointsAttr(selected.points)} className="selection-outline" vectorEffect="non-scaling-stroke" pointerEvents="none" />
              ) : (
                <polygon points={pointsAttr(selected.points)} className="selection-outline" vectorEffect="non-scaling-stroke" pointerEvents="none" />
              )}
              {selected.points.map((a, i) => {
                if (selectedIsLine && i === selected.points.length - 1) return null; // lines don't close
                const b = selected.points[(i + 1) % selected.points.length];
                if (Math.hypot(b[0] - a[0], b[1] - a[1]) * v.scale < 24) return null;
                return <circle key={`m${i}`} data-mid={i} cx={(a[0] + b[0]) / 2} cy={(a[1] + b[1]) / 2} r={4 * px} className="handle-mid" />;
              })}
              {selected.points.map((p, i) => (
                <circle key={`v${i}`} data-vertex={i} cx={p[0]} cy={p[1]} r={5.5 * px} className="handle-vertex" />
              ))}
            </g>
          )}

          {draft.length > 0 && (
            <g className="map-draft" pointerEvents="none">
              {!drawingLine && draft.length >= 2 && <polygon points={pointsAttr(cursor ? [...draft, cursor] : draft)} className="draft-fill" />}
              <polyline
                points={pointsAttr(cursor ? [...draft, cursor] : draft)}
                className={`draft-line${drawingLine ? ' draft-route' : ''}`}
                vectorEffect="non-scaling-stroke"
              />
              {draft.map((p, i) => {
                const closing = !drawingLine && i === 0 && draft.length >= 3;
                const ending = drawingLine && i === draft.length - 1 && draft.length >= 2;
                return <circle key={i} cx={p[0]} cy={p[1]} r={(closing || ending ? 7 : 4.5) * px} className={closing || ending ? 'draft-start' : 'draft-vertex'} />;
              })}
            </g>
          )}
          {rect && (
            <polygon
              points={pointsAttr([rect[0], [rect[1][0], rect[0][1]], rect[1], [rect[0][0], rect[1][1]]])}
              className="draft-fill draft-rect"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {editable && cursor && drawingTool && !dragging && <circle cx={cursor[0]} cy={cursor[1]} r={3.5 * px} className="draft-cursor" pointerEvents="none" />}
          {drawingLabel && (
            <text x={drawingLabel.at[0] + 12 * px} y={drawingLabel.at[1] - 10 * px} fontSize={12 * px} className="draft-measure" pointerEvents="none">
              {drawingLabel.text}
            </text>
          )}
        </svg>
      )}

      {hovered && <HoverCard ref={hoverRef} habitat={hovered} hint={hoverHint} />}

      <div className="map-scale" aria-hidden="true">
        <span style={{ width: scaleBar * v.scale }} />
        {formatLength(scaleBar)}
      </div>
      <svg className="map-compass" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="18" />
        <path d="M20 5 L25 21 L20 18 L15 21 Z" className="needle-n" />
        <path d="M20 35 L15 19 L20 22 L25 19 Z" className="needle-s" />
        <text x="20" y="13.5" textAnchor="middle">N</text>
      </svg>
      <div className="map-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button className="btn btn-icon btn-sm" onClick={() => zoomAt(1.3)} aria-label="Zoom in" title="Zoom in">
          <Plus />
        </button>
        <button className="btn btn-icon btn-sm" onClick={() => zoomAt(1 / 1.3)} aria-label="Zoom out" title="Zoom out">
          <Minus />
        </button>
        <button className="btn btn-icon btn-sm" onClick={fit} aria-label="Fit map" title="Fit whole map">
          <Maximize />
        </button>
      </div>
    </div>
  );
}
