import nodemailer from "nodemailer";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { config } from "../lib/config.js";
import { HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-secrets.js";

export const integrationSchemas = {
  daily: z.object({
    apiKey: z.string().trim().min(1).max(2048)
  }).strict(),
  cloudinary: z.object({
    cloudName: z.string().trim().min(1).max(255),
    apiKey: z.string().trim().min(1).max(2048),
    apiSecret: z.string().trim().min(1).max(2048)
  }).strict(),
  smtp: z.object({
    host: z.string().trim().min(1).max(255),
    port: z.coerce.number().int().min(1).max(65535),
    secure: z.boolean(),
    user: z.string().trim().min(1).max(255),
    password: z.string().min(1).max(2048),
    from: z.string().trim().min(3).max(255)
  }).strict()
} as const;

export type IntegrationProvider = keyof typeof integrationSchemas;
type ProviderSettings = {
  daily: z.infer<typeof integrationSchemas.daily>;
  cloudinary: z.infer<typeof integrationSchemas.cloudinary>;
  smtp: z.infer<typeof integrationSchemas.smtp>;
};

const providerKeys: IntegrationProvider[] = ["daily", "cloudinary", "smtp"];

function environmentSettings(): ProviderSettings {
  return {
    daily: { apiKey: config.DAILY_API_KEY ?? "" },
    cloudinary: {
      cloudName: config.CLOUDINARY_CLOUD_NAME ?? "",
      apiKey: config.CLOUDINARY_API_KEY ?? "",
      apiSecret: config.CLOUDINARY_API_SECRET ?? ""
    },
    smtp: {
      host: config.SMTP_HOST ?? "",
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE === "true",
      user: config.SMTP_USER ?? "",
      password: config.SMTP_PASSWORD ?? "",
      from: config.SMTP_FROM
    }
  };
}

async function storedSettings(): Promise<Partial<ProviderSettings>> {
  const rows = await prisma.integrationSecret.findMany({ where: { provider: { in: providerKeys } } });
  const settings: Partial<ProviderSettings> = {};
  for (const row of rows) {
    const parsedProvider = z.enum(providerKeys).safeParse(row.provider);
    if (!parsedProvider.success) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(decryptIntegrationSecret(row.ciphertext));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, "Stored integration settings are invalid. Re-enter the provider credentials.");
    }
    if (parsedProvider.data === "daily") {
      const parsed = integrationSchemas.daily.safeParse(payload);
      if (!parsed.success) throw new HttpError(500, "Stored Daily.co settings are invalid. Re-enter the provider credentials.");
      settings.daily = parsed.data;
    } else if (parsedProvider.data === "cloudinary") {
      const parsed = integrationSchemas.cloudinary.safeParse(payload);
      if (!parsed.success) throw new HttpError(500, "Stored Cloudinary settings are invalid. Re-enter the provider credentials.");
      settings.cloudinary = parsed.data;
    } else {
      const parsed = integrationSchemas.smtp.safeParse(payload);
      if (!parsed.success) throw new HttpError(500, "Stored SMTP settings are invalid. Re-enter the provider credentials.");
      settings.smtp = parsed.data;
    }
  }
  return settings;
}

export async function getIntegrationSettings() {
  const [stored, environment] = await Promise.all([storedSettings(), Promise.resolve(environmentSettings())]);
  return {
    encryptionAvailable: Boolean(config.INTEGRATION_SECRETS_KEY),
    integrations: {
      daily: {
        configured: Boolean(stored.daily?.apiKey || environment.daily.apiKey),
        source: stored.daily ? "app" : environment.daily.apiKey ? "environment" : "missing"
      },
      cloudinary: {
        configured: Boolean(
          (stored.cloudinary?.cloudName || environment.cloudinary.cloudName)
          && (stored.cloudinary?.apiKey || environment.cloudinary.apiKey)
          && (stored.cloudinary?.apiSecret || environment.cloudinary.apiSecret)
        ),
        source: stored.cloudinary ? "app" : environment.cloudinary.apiKey ? "environment" : "missing"
      },
      smtp: {
        configured: Boolean(
          (stored.smtp?.host || environment.smtp.host)
          && (stored.smtp?.user || environment.smtp.user)
          && (stored.smtp?.password || environment.smtp.password)
        ),
        source: stored.smtp ? "app" : environment.smtp.user ? "environment" : "missing"
      }
    }
  };
}

export function getIntegrationConfig(provider: "daily"): Promise<ProviderSettings["daily"]>;
export function getIntegrationConfig(provider: "cloudinary"): Promise<ProviderSettings["cloudinary"]>;
export function getIntegrationConfig(provider: "smtp"): Promise<ProviderSettings["smtp"]>;
export async function getIntegrationConfig(provider: IntegrationProvider) {
  const [stored, environment] = await Promise.all([storedSettings(), Promise.resolve(environmentSettings())]);
  const merged = { ...environment[provider], ...stored[provider] };
  if (provider === "daily") {
    const parsed = integrationSchemas.daily.safeParse(merged);
    if (!parsed.success) throw new HttpError(503, "Daily.co is not configured. Ask an administrator to add the provider credentials.");
    return parsed.data;
  }
  if (provider === "cloudinary") {
    const parsed = integrationSchemas.cloudinary.safeParse(merged);
    if (!parsed.success) throw new HttpError(503, "Cloudinary is not configured. Ask an administrator to add the provider credentials.");
    return parsed.data;
  }
  const parsed = integrationSchemas.smtp.safeParse(merged);
  if (!parsed.success) throw new HttpError(503, "SMTP is not configured. Ask an administrator to add the provider credentials.");
  return parsed.data;
}

export async function testIntegrationConfig(provider: IntegrationProvider) {
  try {
    if (provider === "daily") {
      const { apiKey } = await getIntegrationConfig("daily");
      const response = await fetch("https://api.daily.co/v1/", {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!response.ok) throw new HttpError(502, "Daily.co rejected the API key. Check it in the provider dashboard.");
    } else if (provider === "cloudinary") {
      const credentials = await getIntegrationConfig("cloudinary");
      cloudinary.config({
        cloud_name: credentials.cloudName,
        api_key: credentials.apiKey,
        api_secret: credentials.apiSecret
      });
      await cloudinary.api.ping();
    } else {
      const settings = await getIntegrationConfig("smtp");
      const transport = nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        auth: { user: settings.user, pass: settings.password }
      });
      try {
        await transport.verify();
      } finally {
        transport.close();
      }
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, `Could not connect to ${provider}. Verify its settings and try again.`);
  }
}

export async function saveIntegrationConfig<P extends IntegrationProvider>(
  provider: P,
  values: unknown
) {
  const parsedUpdate = integrationSchemas[provider].partial().safeParse(values);
  if (!parsedUpdate.success) throw new HttpError(400, "Enter valid credentials for this provider.");
  const [stored, environment] = await Promise.all([storedSettings(), Promise.resolve(environmentSettings())]);
  const merged = { ...environment[provider], ...stored[provider], ...parsedUpdate.data };
  const parsed = integrationSchemas[provider].safeParse(merged);
  if (!parsed.success) {
    throw new HttpError(400, `Complete all required ${provider} settings before saving.`);
  }
  await prisma.integrationSecret.upsert({
    where: { provider },
    create: { provider, ciphertext: encryptIntegrationSecret(JSON.stringify(parsed.data)) },
    update: { ciphertext: encryptIntegrationSecret(JSON.stringify(parsed.data)) }
  });
}

export async function removeIntegrationConfig(provider: IntegrationProvider) {
  await prisma.integrationSecret.deleteMany({ where: { provider } });
}
