'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';

interface AnimateOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
}

export function AnimateOnScroll({ children, className = '', delay = 0, direction = 'up' }: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => setIsVisible(true), delay);
          } else {
            setIsVisible(true);
          }
          observer.unobserve(element);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [delay]);

  const hiddenTransform = {
    up: 'translate-y-4',
    left: 'translate-x-4',
    right: '-translate-x-4',
  }[direction];

  const visibleTransform = {
    up: 'translate-y-0',
    left: 'translate-x-0',
    right: 'translate-x-0',
  }[direction];

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        isVisible ? `opacity-100 ${visibleTransform}` : `opacity-0 ${hiddenTransform}`
      } ${className}`}
    >
      {children}
    </div>
  );
}
