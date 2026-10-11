export function getPosStoreMode(store) {
  if (store?.productType === "clinic" || store?.type === "clinic" || store?.id === "rts-testing") {
    return "clinic";
  }
  return "business";
}
