import { useEffect, useMemo, useRef, useState } from "react";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const INTERACTIVE_SELECTOR =
  "button, input, select, textarea, a, label, [role='button'], [data-no-drag='true']";

let globalZIndex = 40;

function clampOffsetToViewport(offset) {
  if (typeof window === "undefined") return offset;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxX = Math.max(0, viewportWidth / 2 - 72);
  const minX = -maxX;
  const minY = -(viewportHeight - 140);
  const maxY = 28;
  return {
    x: clamp(offset.x, minX, maxX),
    y: clamp(offset.y, minY, maxY),
  };
}

export default function DraggablePanel({
  enabled = false,
  panelId,
  defaultOffset = { x: 0, y: 0 },
  panelWidth = "340px",
  children,
}) {
  const [offset, setOffset] = useState(() => clampOffsetToViewport(defaultOffset));
  const [dragging, setDragging] = useState(false);
  const [zIndex, setZIndex] = useState(() => {
    globalZIndex += 1;
    return globalZIndex;
  });
  const dragStateRef = useRef(null);

  const panelStyle = useMemo(
    () => ({
      "--panel-offset-x": `${offset.x}px`,
      "--panel-offset-y": `${offset.y}px`,
      "--panel-max-width": panelWidth,
      zIndex,
    }),
    [offset.x, offset.y, panelWidth, zIndex],
  );

  useEffect(() => {
    setOffset(clampOffsetToViewport(defaultOffset));
  }, [panelId, defaultOffset.x, defaultOffset.y]);

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => {
      setOffset((current) => clampOffsetToViewport(current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const beginDrag = (event, force = false) => {
    if (!enabled) return;
    if (event.button !== 0) return;
    if (!force) {
      const target = event.target;
      if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) {
        return;
      }
    }
    event.preventDefault();

    const startOffset = { ...offset };
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset,
    };
    globalZIndex += 1;
    setZIndex(globalZIndex);
    setDragging(true);

    const onPointerMove = (moveEvent) => {
      const activeDrag = dragStateRef.current;
      if (!activeDrag || moveEvent.pointerId !== activeDrag.pointerId) return;
      const nextOffset = {
        x: activeDrag.startOffset.x + (moveEvent.clientX - activeDrag.startX),
        y: activeDrag.startOffset.y + (moveEvent.clientY - activeDrag.startY),
      };
      setOffset(clampOffsetToViewport(nextOffset));
    };

    const onPointerEnd = (endEvent) => {
      const activeDrag = dragStateRef.current;
      if (!activeDrag || endEvent.pointerId !== activeDrag.pointerId) return;
      dragStateRef.current = null;
      setDragging(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
  };

  const onHandlePointerDown = (event) => beginDrag(event, true);
  const onContentPointerDown = (event) => beginDrag(event, false);

  if (!enabled) {
    return children;
  }

  return (
    <div className={`draggable-panel ${dragging ? "is-dragging" : ""}`} style={panelStyle}>
      <div
        className="draggable-panel-handle"
        role="button"
        tabIndex={0}
        aria-label="Drag panel"
        title="Drag panel"
        onPointerDown={onHandlePointerDown}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
        }}
      >
        <span className="draggable-panel-handle-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="draggable-panel-handle-label">Move</span>
      </div>
      <div className="draggable-panel-content" onPointerDown={onContentPointerDown}>
        {children}
      </div>
    </div>
  );
}
