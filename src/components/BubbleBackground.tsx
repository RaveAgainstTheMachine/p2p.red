import React, { useImperativeHandle, useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

type SpringOptions = any;

type BubbleBackgroundProps = React.ComponentProps<'div'> & {
  interactive?: boolean;
  transition?: SpringOptions;
  colors?: {
    first: string;
    second: string;
    third: string;
    fourth: string;
    fifth: string;
    sixth: string;
  };
};

const BubbleBackground = React.forwardRef<HTMLDivElement, BubbleBackgroundProps>(
  (
    {
      className,
      children,
      interactive = true,
      transition = { stiffness: 100, damping: 20 },
      colors = {
        first: '59,130,246', // blue-500
        second: '168,85,247', // purple-500
        third: '236,72,153', // pink-500
        fourth: '96,165,250', // blue-400
        fifth: '192,132,252', // purple-400
        sixth: '244,114,182', // pink-400
      },
      ...props
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const springX = useSpring(mouseX, transition);
    const springY = useSpring(mouseY, transition);

    useEffect(() => {
      if (!interactive) return;

      const handleMouseMove = (e: MouseEvent) => {
        const x = e.clientX - window.innerWidth / 2;
        const y = e.clientY - window.innerHeight / 2;
        mouseX.set(x);
        mouseY.set(y);
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [interactive, mouseX, mouseY]);

    return (
      <div
        ref={containerRef}
        data-slot="bubble-background"
        className={`overflow-hidden ${className || 'absolute inset-0 w-full h-full'}`}
        {...props}
      >
        <style>
          {`
            :root {
              --first-color: ${colors.first};
              --second-color: ${colors.second};
              --third-color: ${colors.third};
              --fourth-color: ${colors.fourth};
              --fifth-color: ${colors.fifth};
              --sixth-color: ${colors.sixth};
            }
          `}
        </style>

        <div className="absolute inset-0" style={{ filter: 'blur(20px)' }}>
          <motion.div
            className="absolute rounded-full w-[80%] h-[80%] top-[10%] left-[10%] mix-blend-normal"
            style={{ background: 'radial-gradient(circle at center, rgba(var(--first-color), 0.8) 0%, rgba(var(--first-color), 0) 50%)' }}
            animate={{ y: [-50, 50, -50] }}
            transition={{ duration: 30, ease: 'easeInOut', repeat: Infinity }}
          />

          <motion.div
            className="absolute inset-0 flex justify-center items-center origin-[calc(50%-400px)]"
            animate={{ rotate: 360 }}
            transition={{
              duration: 20,
              ease: 'linear',
              repeat: Infinity,
              repeatType: 'loop',
            }}
          >
            <div 
              className="rounded-full w-[80%] h-[80%] top-[10%] left-[10%] mix-blend-normal"
              style={{ background: 'radial-gradient(circle at center, rgba(var(--second-color), 0.8) 0%, rgba(var(--second-color), 0) 50%)' }}
            />
          </motion.div>

          <motion.div
            className="absolute inset-0 flex justify-center items-center origin-[calc(50%+400px)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
          >
            <div 
              className="absolute rounded-full w-[80%] h-[80%] mix-blend-normal top-[calc(50%+200px)] left-[calc(50%-500px)]"
              style={{ background: 'radial-gradient(circle at center, rgba(var(--third-color), 0.8) 0%, rgba(var(--third-color), 0) 50%)' }}
            />
          </motion.div>

          <motion.div
            className="absolute rounded-full w-[80%] h-[80%] top-[10%] left-[10%] mix-blend-normal opacity-70"
            style={{ background: 'radial-gradient(circle at center, rgba(var(--fourth-color), 0.8) 0%, rgba(var(--fourth-color), 0) 50%)' }}
            animate={{ x: [-50, 50, -50] }}
            transition={{ duration: 40, ease: 'easeInOut', repeat: Infinity }}
          />

          <motion.div
            className="absolute inset-0 flex justify-center items-center origin-[calc(50%_-_800px)_calc(50%_+_200px)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
          >
            <div 
              className="absolute rounded-full w-[160%] h-[160%] mix-blend-normal top-[calc(50%-80%)] left-[calc(50%-80%)]"
              style={{ background: 'radial-gradient(circle at center, rgba(var(--fifth-color), 0.8) 0%, rgba(var(--fifth-color), 0) 50%)' }}
            />
          </motion.div>

          {interactive && (
            <motion.div
              className="absolute rounded-full w-full h-full mix-blend-normal opacity-70"
              style={{
                background: 'radial-gradient(circle at center, rgba(var(--sixth-color), 0.8) 0%, rgba(var(--sixth-color), 0) 50%)',
                x: springX,
                y: springY,
              }}
            />
          )}
        </div>

        {children}
      </div>
    );
  }
);

BubbleBackground.displayName = 'BubbleBackground';

export default BubbleBackground;
