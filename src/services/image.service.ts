import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../utils/appError";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class ImageService {
  public async upload(file: Express.Multer.File): Promise<{ imageUrl: string; publicId: string }> {
    if (!file || !file.buffer) {
      throw new AppError("No image buffer provided for upload", 400);
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "na_tailors/products",
          resource_type: "image",
        },
        (error, result) => {
          if (error || !result) {
            return reject(new AppError("Cloudinary upload failed", 500));
          }
          resolve({
            imageUrl: result.secure_url,
            publicId: result.public_id,
          });
        }
      );

      stream.end(file.buffer);
    });
  }

  public async delete(publicId: string): Promise<void> {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
  }
}