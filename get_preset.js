import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const getUnsignedPreset = async () => {
    try {
        const presets = await cloudinary.api.upload_presets();
        const unsigned = presets.presets.find(p => p.unsigned);

        if (unsigned) {
            console.log(`PRESET_FOUND:${unsigned.name}`);
        } else {
            console.log("No unsigned preset found, creating one...");
            const result = await cloudinary.api.create_upload_preset({
                name: "progz_unsigned_preset",
                unsigned: true,
                folder: "progz_uploads",
            });
            console.log(`PRESET_FOUND:${result.name}`);
        }
    } catch (error) {
        console.error("Error fetching presets:", error);
    }
};

getUnsignedPreset();
