import { createRemoteJWKSet, jwtVerify } from "jose";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export class JwtValidationError extends Error {
  constructor(message = "Invalid JWT") {
    super(message);
    this.name = "JwtValidationError";
  }
}

export async function validateGoogleJwt(
  token: string,
  googleClientId: string
): Promise<{ sub: string }> {
  try {
    const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: googleClientId,
    });
    if (typeof payload.sub !== "string" || !payload.sub) {
      throw new JwtValidationError("Missing sub claim");
    }
    return { sub: payload.sub };
  } catch (error) {
    if (error instanceof JwtValidationError) {
      throw error;
    }
    throw new JwtValidationError();
  }
}
