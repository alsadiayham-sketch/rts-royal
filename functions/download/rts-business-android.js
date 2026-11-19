const APK_URL = "https://github.com/alsadiayham-sketch/rts-business-android-releases/releases/latest/download/RTS-Business.apk";

function downloadAndroid() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: APK_URL,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const onRequestGet = downloadAndroid;
export const onRequestHead = downloadAndroid;
