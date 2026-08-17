/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["fogewise.io.vn"],
    },
  },
};

export default nextConfig;
