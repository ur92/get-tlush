/**
 * Proxies OAuth token exchange to Google with client_secret (server-only).
 * .mjs + node_bundler=none avoids CJS/ESM mismatch under @tlush/web monorepo dev.
 */
export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "oauth_not_configured" }),
    };
  }

  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : (event.body ?? "");

  const params = new URLSearchParams(body);
  params.set("client_id", clientId);
  params.set("client_secret", clientSecret);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const responseBody = await tokenRes.text();
  return {
    statusCode: tokenRes.status,
    headers: { "Content-Type": "application/json" },
    body: responseBody,
  };
}
