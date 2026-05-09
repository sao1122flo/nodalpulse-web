"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { authClient } from "@/lib/auth-client"

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/login")
  }

  return (
    <button
      onClick={handleSignOut}
      title="Sign out"
      className="
        flex items-center justify-center w-6 h-6
        rounded-[var(--np-radius-sm)]
        text-[var(--np-text-muted)]
        hover:text-[var(--np-text-strong)] hover:bg-[var(--np-surface-deep)]
        transition-colors cursor-pointer flex-shrink-0
      "
    >
      <LogOut size={13} />
    </button>
  )
}
