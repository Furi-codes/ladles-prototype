"use client";

import { createContext, useContext } from "react";

export const VolunteerAccountContext = createContext<(() => void) | null>(null);

export function useVolunteerSignOut() {
  const requestSignOut = useContext(VolunteerAccountContext);
  if (!requestSignOut) throw new Error("Volunteer account controls require VolunteerShell.");
  return requestSignOut;
}
