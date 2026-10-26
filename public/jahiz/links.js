export function customerPageUrl(venue, origin) {
  if (!venue || typeof venue.slug !== "string"
      || venue.slug.length < 3 || venue.slug.length > 48
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(venue.slug)) {
    throw new Error("A valid venue is required to generate its customer link.");
  }
  const base = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && local)) {
    throw new Error("Customer links require HTTPS.");
  }
  const url = new URL("/jahiz/s/", base.origin);
  url.searchParams.set("shop", venue.slug);
  return url.href;
}
