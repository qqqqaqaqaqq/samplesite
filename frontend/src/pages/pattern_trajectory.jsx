import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import "./styles/pattern_trajectory.scss";

export default function PatternGame({ isDragging, setIsDragging, setScore }) {
  const containerRef = useRef(null);
  const [targetIdx, setTargetIdx] = useState(4);
  const targetIdxRef = useRef(targetIdx);
  const isUpdating = useRef(false);
  
  // 모바일 대응을 위한 가변 사이즈 상태
  const [dimensions, setDimensions] = useState({ size: 300, spacing: 80, offset: 70 });

  // 1. 화면 크기에 따른 그리드 수치 계산
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      // 부모 너비의 최대 95%까지만 사용
      const parentWidth = containerRef.current.parentElement.offsetWidth;
      const availableSize = Math.min(parentWidth * 0.95, 400); // 최대 400px
      
      setDimensions({
        size: availableSize,
        spacing: availableSize * 0.3, // 간격을 너비의 30%로 유동적 설정
        offset: availableSize * 0.2   // 여백을 너비의 20%로 설정
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // 2. 가변 수치를 바탕으로 그리드 좌표 계산
  const gridPoints = useMemo(() => {
    const points = [];
    const { spacing, offset } = dimensions;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        points.push({
          x: col * spacing + offset,
          y: row * spacing + offset,
        });
      }
    }
    return points;
  }, [dimensions]);

  const mX = useMotionValue(0);
  const mY = useMotionValue(0);

  // 사이즈가 결정되면 공을 중앙(4번 점)으로 이동
  useEffect(() => {
    if (gridPoints[4]) {
      mX.set(gridPoints[4].x);
      mY.set(gridPoints[4].y);
    }
  }, [gridPoints, mX, mY]);

  useEffect(() => {
    targetIdxRef.current = targetIdx;
    isUpdating.current = false;
  }, [targetIdx]);

  useEffect(() => {
    if (!isDragging && gridPoints[4]) {
      animate(mX, gridPoints[4].x, { type: "spring", stiffness: 200, damping: 25 });
      animate(mY, gridPoints[4].y, { type: "spring", stiffness: 200, damping: 25 });
    }
  }, [isDragging, gridPoints, mX, mY]);

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      if (e.type === 'touchmove') e.preventDefault();

      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      let nextX = clientX - rect.left;
      let nextY = clientY - rect.top;

      // 계산된 가변 사이즈 내부로 클램핑
      nextX = Math.max(0, Math.min(nextX, dimensions.size));
      nextY = Math.max(0, Math.min(nextY, dimensions.size));

      mX.set(nextX);
      mY.set(nextY);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("touchmove", handleMove, { passive: false });
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
    };
  }, [isDragging, mX, mY, dimensions]);

  useEffect(() => {
    const checkArrival = () => {
      const currentTarget = gridPoints[targetIdxRef.current];
      if (!currentTarget) return;
      const d = Math.sqrt(Math.pow(mX.get() - currentTarget.x, 2) + Math.pow(mY.get() - currentTarget.y, 2));

      if (d < 25 && !isUpdating.current && isDragging) {
        isUpdating.current = true;
        setScore(s => s + 1);
        setTargetIdx(prev => {
          let next;
          do { next = Math.floor(Math.random() * gridPoints.length); } while (next === prev);
          return next;
        });
      }
    };
    const unsubX = mX.on("change", checkArrival);
    const unsubY = mY.on("change", checkArrival);
    return () => { unsubX(); unsubY(); };
  }, [gridPoints, mX, mY, isDragging, setScore]);

  return (
    <div className="game-wrapper">
      <div 
        ref={containerRef}
        className={`pattern-container ${isDragging ? 'active' : ''}`}
        style={{ 
            width: dimensions.size, 
            height: dimensions.size, 
            position: 'relative',
            touchAction: 'none'
        }}
      >
        {gridPoints.map((point, i) => (
          <div key={i} className={`grid-dot ${i === targetIdx ? 'is-target' : ''}`} style={{ left: point.x, top: point.y, position: 'absolute' }}>
            {i === targetIdx && <motion.div layoutId="pulse" className="target-pulse" />}
          </div>
        ))}

        <motion.div
          className="player-ball"
          onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); setIsDragging(true); } }}
          onTouchStart={(e) => { e.stopPropagation(); setIsDragging(true); }}
          style={{ x: mX, y: mY, left: -20, top: -20, position: 'absolute' }}
          animate={{ 
            scale: isDragging ? 0.9 : 1.1,
            backgroundColor: isDragging ? "#007bff" : "#dee2e6"
          }}
        />
      </div>
    </div>
  );
}