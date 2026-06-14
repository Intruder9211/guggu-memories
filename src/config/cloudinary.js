const CLOUDINARY_CONFIG = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "",
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "",
};

export const isCloudinaryConfigured =
  !!(CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset);

console.log("Cloud Name status:", CLOUDINARY_CONFIG.cloudName ? `LOADED (length: ${CLOUDINARY_CONFIG.cloudName.length})` : "MISSING ❌");
console.log("Preset status:", CLOUDINARY_CONFIG.uploadPreset ? `LOADED (length: ${CLOUDINARY_CONFIG.uploadPreset.length})` : "MISSING ❌");
console.log("Cloudinary Configured:", isCloudinaryConfigured);

// Keep track of ongoing upload signatures to prevent duplicate uploads
const activeUploads = new Set();
/**
 * Validates file format and size limits.
 * @param {File} file - File object to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateFile(file) {
  if (!file) return { valid: false, error: "No file selected." };

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: "Unsupported file format. Please select an image or a video."
    };
  }

  // 10MB limit for images
  if (isImage && file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: "Image exceeds maximum size limit of 10MB."
    };
  }

  // 50MB limit for videos
  if (isVideo && file.size > 50 * 1024 * 1024) {
    return {
      valid: false,
      error: "Video exceeds maximum size limit of 50MB."
    };
  }

  return { valid: true };
}

/**
 * Checks if a file is already in the process of being uploaded.
 * @param {File} file
 * @returns {boolean}
 */
export function isUploadDuplicate(file) {
  const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
  return activeUploads.has(fileKey);
}

/**
 * Registers a file upload to prevent duplicates.
 * @param {File} file
 */
export function registerUpload(file) {
  const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
  activeUploads.add(fileKey);
}

/**
 * Unregisters a completed/failed file upload.
 * @param {File} file
 */
export function unregisterUpload(file) {
  const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
  activeUploads.delete(fileKey);
}

/**
 * Core Cloudinary upload function using XMLHttpRequest for progress feedback.
 */
function uploadToCloudinaryXHR(file, onProgress) {
  return new Promise((resolve, reject) => {
    const cloudName = CLOUDINARY_CONFIG.cloudName;
    const uploadPreset = CLOUDINARY_CONFIG.uploadPreset;
    
    if (!cloudName || !uploadPreset) {
      reject(new Error("Cloudinary credentials are not defined in the environment. Please check your VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET."));
      return;
    }
    
    const xhr = new XMLHttpRequest();
    const type = file.type.startsWith("video") ? "video" : "image";
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/upload`;
    
    xhr.open("POST", url, true);
    
    // Set 60 seconds timeout
    xhr.timeout = 60000;
    
    xhr.upload.onprogress = (event) => {
      try {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      } catch (err) {
        console.error("Error inside onprogress handler:", err);
      }
    };
    
    xhr.onload = () => {
      try {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          if (response && response.secure_url) {
            resolve(response.secure_url);
          } else {
            reject(new Error("Cloudinary response succeeded but did not return a secure_url."));
          }
        } else {
          let errorMsg = `Upload failed with status ${xhr.status}`;
          try {
            const err = JSON.parse(xhr.responseText || "{}");
            errorMsg = err.error?.message || errorMsg;
          } catch (e) {
            // Response was not JSON (e.g. HTML error page or empty response)
            if (xhr.responseText) {
              errorMsg = `${errorMsg}: ${xhr.responseText.substring(0, 150)}`;
            } else {
              errorMsg = `${errorMsg} (Empty response from server)`;
            }
          }
          reject(new Error(errorMsg));
        }
      } catch (err) {
        reject(err);
      }
    };
    
    xhr.onerror = () => {
      reject(new Error("Network error during upload (possible CORS issue or connection failure)"));
    };
    
    xhr.ontimeout = () => {
      reject(new Error("Cloudinary upload request timed out after 60 seconds"));
    };
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    
    xhr.send(formData);
  });
}

/**
 * Uploads a file directly to Cloudinary with automatic retries.
 * @param {File} file - File object to upload
 * @param {Function} onProgress - Progress callback function (0-100)
 * @param {number} [retries=3] - Number of retry attempts
 * @param {number} [delay=1500] - Base delay before retry (ms)
 * @returns {Promise<string>} Secure URL of the uploaded media
 */
export async function uploadFileToCloudinary(file, onProgress, retries = 3, delay = 1500) {
  let attempt = 0;
  
  while (true) {
    try {
      return await uploadToCloudinaryXHR(file, onProgress);
    } catch (error) {
      attempt++;
      if (attempt > retries) {
        throw error;
      }
      console.warn(`Cloudinary upload attempt ${attempt} failed. Retrying in ${delay}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

/**
 * Utility to inject transformations (f_auto, q_auto, width resize) into Cloudinary URLs
 * for performance optimization.
 */
export function optimizeMediaUrl(url, type, width) {
  if (!url || !url.includes("cloudinary.com")) return url;
  
  if (type === "video") {
    if (url.includes("/video/upload/")) {
      const parts = url.split("/video/upload/");
      const transformations = ["f_auto", "q_auto"];
      if (width) {
        transformations.push(`w_${width}`);
      }
      return `${parts[0]}/video/upload/${transformations.join(",")}/${parts[1]}`;
    }
  } else {
    if (url.includes("/image/upload/")) {
      const parts = url.split("/image/upload/");
      const transformations = ["f_auto", "q_auto"];
      if (width) {
        transformations.push(`w_${width}`);
      }
      return `${parts[0]}/image/upload/${transformations.join(",")}/${parts[1]}`;
    }
  }
  return url;
}
