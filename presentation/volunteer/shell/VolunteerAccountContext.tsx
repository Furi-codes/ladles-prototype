"use client";

/**
 * Shares the volunteer sign-out action with nested account controls.
 * The context lets the profile reuse the shell's sign-out behaviour rather than creating a
 * second session flow.
 */

import { createContext, useContext } from "react";

export const VolunteerAccountContext = createContext<(() => void) | null>(null);

export function useVolunteerSignOut() {
  const requestSignOut = useContext(VolunteerAccountContext);
  if (!requestSignOut) throw new Error("Volunteer account controls require VolunteerShell.");
  return requestSignOut;
}
