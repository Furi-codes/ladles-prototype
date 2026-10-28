"use client";

/** Shared spring defaults. Reduced-motion preferences also apply to layout animations. */
import { MotionConfig } from 'motion/react';

export default function ExperienceProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 380, damping: 32, mass: .8 }}>{children}</MotionConfig>;
}
