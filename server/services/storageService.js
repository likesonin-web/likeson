import ImageKit from 'imagekit';
import path from 'path';

export default function StorageService() {
  // Initialize ImageKit with environment variables
  const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
  });

  return {
    /**
     * Uploads a file buffer to ImageKit
     */
    async upload(buffer, key) {
      const res = await imagekit.upload({
        file: buffer.toString('base64'),
        fileName: path.basename(key),
        folder: `/${path.dirname(key)}`,
        useUniqueFileName: false
      });

      return { url: res.url };
    },

    /**
     * Generates a URL for a specific file key
     */
    getUrlForKey(key) {
      // Ensure the endpoint doesn't have a trailing slash before appending the key
      const endpoint = process.env.IMAGEKIT_URL_ENDPOINT.replace(/\/$/, '');
      return `${endpoint}/${key}`;
    }
  };
}