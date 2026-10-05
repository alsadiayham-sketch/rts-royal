import { DEFAULT_DOWNLOAD_URL } from "../_lib/constants.js";
import { isAllowedDownloadUrl } from "../_lib/validation.js";

export const DOWNLOAD_FILENAME = "RTS-Business-Setup.exe";

async function getDownloadUrl(env) {
  const row = await env.DB.prepare("SELECT download_url FROM site_settings WHERE id = 1").first();
  const downloadUrl = row?.download_url || DEFAULT_DOWNLOAD_URL;
  if (!isAllowedDownloadUrl(downloadUrl)) {
    throw new Error("Configured installer URL is invalid.");
  }
  return downloadUrl;
}

function createDownloadHeaders(upstreamHeaders) {
  const headers = new Headers(upstreamHeaders);
  headers.set(
    "Content-Disposition",
    `attachment; filename="${DOWNLOAD_FILENAME}"; filename*=UTF-8''RTS-Business-Setup.exe`
  );
  headers.set("Content-Type", "application/vnd.microsoft.portable-executable");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

async function serveInstaller({ request, env }) {
  try {
    const downloadUrl = await getDownloadUrl(env);
    const forwardedHeaders = new Headers();
    for (const name of ["Range", "If-Range"]) {
      const value = request.headers.get(name);
      if (value) forwardedHeaders.set(name, value);
    }

    const upstream = await fetch(downloadUrl, {
      method: request.method,
      headers: forwardedHeaders,
      redirect: "follow",
    });
    if (!upstream.ok) {
      return new Response("The RTS Business installer is temporarily unavailable.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: createDownloadHeaders(upstream.headers),
    });
  } catch {
    return new Response("The RTS Business installer is temporarily unavailable.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export const onRequestGet = serveInstaller;
export const onRequestHead = serveInstaller;
