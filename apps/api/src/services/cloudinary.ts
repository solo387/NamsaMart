import { v2 as cloudinary } from "cloudinary";
import { config } from "../lib/config.js";
import { HttpError } from "../lib/errors.js";

export function uploadFile(file: Express.Multer.File, folder: string) {
  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
    throw new HttpError(503, "File uploads are not configured. Contact your administrator.");
  }
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET
  });
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `namsamart/${folder}`,
        resource_type: file.mimetype.startsWith("video/") ? "video" : file.mimetype.startsWith("image/") ? "image" : "raw"
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
