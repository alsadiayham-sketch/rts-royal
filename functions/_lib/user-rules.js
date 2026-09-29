import { ApiError } from "./http.js";

export function assertUserStatusChangeAllowed({
  actorUsername,
  targetUsername,
  nextActive,
  targetCurrentlyActive,
  activeAdminCount,
}) {
  if (nextActive) {
    return;
  }

  if (!targetCurrentlyActive) {
    return;
  }

  if (actorUsername === targetUsername) {
    throw new ApiError(400, "SELF_DEACTIVATE_FORBIDDEN", "You cannot deactivate your own account.");
  }

  if (activeAdminCount <= 1) {
    throw new ApiError(400, "LAST_ADMIN_FORBIDDEN", "Cannot deactivate the last active admin.");
  }
}
