import { createPosUserHandlers } from "../_lib/pos-user-management.js";

export const { onRequestGet, onRequestPost, onRequestPatch, onRequestDelete } = createPosUserHandlers({ desktop: true });
