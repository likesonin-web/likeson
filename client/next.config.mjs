/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Wildcard for all HTTPS domains
      },
      {
        protocol: 'http',
        hostname: '**', // Wildcard for all HTTP domains
      },
    ],
  },
  // Optional but highly recommended if preload warnings persist with webkit browsers:
  // optimizeFonts: true, 
};

export default nextConfig;