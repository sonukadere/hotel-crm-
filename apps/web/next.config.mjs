/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hotel/ui", "@hotel/types", "@hotel/utils", "@hotel/config"],
  images: {
    domains: ["images.unsplash.com"],
  },
};

export default nextConfig;
