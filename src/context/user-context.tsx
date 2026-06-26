"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import type { SessionUser } from "@/lib/types"

interface UserContextType {
  user: SessionUser | null
  isLoading: boolean
  refresh: () => void
}

const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  refresh: () => {},
})

export function UserProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser?: SessionUser | null
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser ?? null)
  const [isLoading, setIsLoading] = useState(!initialUser)

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me")
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!initialUser) {
      fetchUser()
    }
  }, [initialUser])

  return (
    <UserContext.Provider value={{ user, isLoading, refresh: fetchUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser() {
  return useContext(UserContext)
}
