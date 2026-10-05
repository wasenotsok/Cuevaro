export type Actor = { userId: string; householdId: string };
export type Membership = {
  userId: string;
  householdId: string;
  role: "owner" | "member" | "viewer";
  revoked: boolean;
};
export function authorize(
  actor: Actor,
  membership: Membership | undefined,
  write = false,
): void {
  if (
    !membership ||
    membership.revoked ||
    membership.userId !== actor.userId ||
    membership.householdId !== actor.householdId ||
    (write && membership.role === "viewer")
  )
    throw new Error("ACCESS_DENIED");
}
