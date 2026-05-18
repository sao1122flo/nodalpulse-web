import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getOnboardingState } from "./actions"
import { OnboardingClient } from "./OnboardingClient"

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  const state = await getOnboardingState()

  // Already completed onboarding — skip back to dashboard
  if (state.step >= 5) redirect("/dashboard")

  // Resume at next uncompleted step (step 0 → start at 1)
  const initialStep = Math.min(state.step + 1, 5)

  return <OnboardingClient initialStep={initialStep} initialState={state} />
}
