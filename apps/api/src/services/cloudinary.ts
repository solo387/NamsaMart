import { v2 as cloudinary } from "cloudinary";
import { HttpError } from "../lib/errors.js";
import { getIntegrationConfig } from "./provider-settings.js";

export async function uploadFile(file: Express.Multer.File, folder: string) {
  const credentials = await getIntegrationConfig("cloudinary");
  cloudinary.config({
    cloud_name: credentials.cloudName,
    api_key: credentials.apiKey,
    api_secret: credentials.apiSecret
  });
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `namsamart/${folder}`,
        resource_type: file.mimetype === "application/pdf" || file.mimetype.startsWith("image/")
          ? "image"
          : file.mimetype.startsWith("video/")
            ? "video"
            : "raw"
      },
      (error, result) => {
        if (error) {
          reject(new HttpError(502, `File upload failed: ${error.message}`));
          return;
        }
        if (!result) {
          reject(new HttpError(502, "File upload returned no result."));
          return;
        }
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(file.buffer);
  });
}
