export async function onRequest(context) {
  const upstream = await context.next();
  const response = new Response(upstream.body, upstream);
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; '));
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (!['/jahiz', '/jahiz/'].includes(new URL(context.request.url).pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}
