import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

interface SpatialCardProps {
  children: React.ReactNode;
  className?: string;
  tilt?: boolean;
  delay?: number;
  maxTilt?: number;
}

export const SpatialCard: React.FC<SpatialCardProps> = ({
  children,
  className = '',
  tilt = true,
  delay = 0,
  maxTilt = 4.5,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);

  const rotateX = useSpring(rawRotateX, { stiffness: 260, damping: 24, mass: 0.5 });
  const rotateY = useSpring(rawRotateY, { stiffness: 260, damping: 24, mass: 0.5 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    const py = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    rawRotateY.set(px * maxTilt * 2);
    rawRotateX.set(-py * maxTilt * 2);
  };

  const handleMouseLeave = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 14, rotateX: 4 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{
        duration: 0.36,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{
        transformPerspective: 1100,
        rotateX: tilt ? rotateX : 0,
        rotateY: tilt ? rotateY : 0,
      }}
      className={`spatial-panel ${tilt ? 'spatial-panel-interactive' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
};
