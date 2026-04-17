/**
 * POC: single dev-user, no auth.
 * All v2 rows belong to this user until we replace this with real auth.
 */

const DEFAULT_DEV_USER_ID = "b108d5d5-c01a-4284-8485-510982ae3acb";

export function v2DevUserId(): string {
  return process.env.V2_DEV_USER_ID ?? DEFAULT_DEV_USER_ID;
}

export async function v2Session(): Promise<{ user: { id: string } }> {
  return { user: { id: v2DevUserId() } };
}
