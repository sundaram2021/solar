"use client";

import { useState, useCallback } from "react";
import { signInWithGithubOAuth, signOutGithubUser } from "@/lib/github-helpers";
import { SolarUser } from "@/types/solar-types";

export function useAuth(initialUser: SolarUser | null = null) {
  const [user, setUser] = useState<SolarUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginWithGithub = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGithubOAuth();
      // Success navigates away via OAuth; if we're still here (popup
      // blocked), stop spinning so the button is usable again.
      setIsLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "GitHub authentication failed";
      setError(message);
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      try {
        localStorage.removeItem("solar:v1:repo");
        localStorage.removeItem("solar:v1:thread");
        // Legacy keys (pre-v1) — best-effort cleanup.
        localStorage.removeItem("solar-active-repo");
        localStorage.removeItem("solar-thread-id");
      } catch {
        // storage unavailable
      }
      await signOutGithubUser();
      setUser(null);
      window.location.href = "/login";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Logout failed";
      setError(message);
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isLoading,
    error,
    loginWithGithub,
    logout,
  };
}
