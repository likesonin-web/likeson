/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // The double asterisk acts as a wildcard for all HTTPS domains
      },
      {
        protocol: 'http',
        hostname: '**', // Optional: Include this if you also have insecure HTTP image sources
      },
    ],
  },
};

export default nextConfig;