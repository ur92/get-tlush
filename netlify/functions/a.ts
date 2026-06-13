import type { Handler } from "@netlify/functions";
import {
  createSupabaseStore,
  handleIngest,
  validateGoogleJwt,
} from "@tlush/ingest";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cachedStore: ReturnType<typeof createSupabaseStore> | undefined;

function getStore() {
  if (!cachedStore) {
    cachedStore = createSupabaseStore(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
    );
  }
  return cachedStore;
}

export const handler: Handler = async (event) => {
  const body = event.body ?? "";
  const bodyByteLength = event.isBase64Encoded
    ? Buffer.from(body, "base64").byteLength
    : Buffer.byteLength(body, "utf8");

  const response = await handleIngest(
    {
      method: event.httpMethod,
      path: event.path,
      headers: event.headers as Record<string, string | undefined>,
      body: event.isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body,
      bodyByteLength,
    },
    {
      contributorTokenSecret: requiredEnv("CONTRIBUTOR_TOKEN_SECRET"),
      googleClientId: requiredEnv("GOOGLE_CLIENT_ID"),
    },
    {
      validateJwt: validateGoogleJwt,
      store: getStore(),
    }
  );

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
  };
};
