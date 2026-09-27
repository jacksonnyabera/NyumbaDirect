import cloudinary
import cloudinary.uploader

from app.config import settings


def configure_cloudinary():
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )


def upload_property_image(file):
    configure_cloudinary()

    result = cloudinary.uploader.upload(
        file,
        folder="nyumbadirect/properties",
        resource_type="image",
    )

    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
    }