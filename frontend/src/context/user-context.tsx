"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { USERS, type User } from "@/lib/rbac";

interface UserContextValue {
  currentUser: User;
  setCurrentUser: (user: User) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

const STORAGE_KEY = "governance_current_user";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User>(USERS[0]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const found = USERS.find((u) => u.name === stored);
      if (found) setCurrentUserState(found);
    }
    setMounted(true);
  }, []);

  function setCurrentUser(user: User) {
    setCurrentUserState(user);
    localStorage.setItem(STORAGE_KEY, user.name);
  }

  if (!mounted) return null;

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
