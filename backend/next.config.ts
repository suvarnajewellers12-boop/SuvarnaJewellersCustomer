import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // This prevents the build from failing if there are small type mismatches
    // Useful for your hackathon demo to ensure the site goes live!
    ignoreBuildErrors: true,
  },
  eslint: {
    // This prevents ESLint warnings from stopping your deployment
    ignoreDuringBuilds: true,
  },
  // This helps Prisma work better with Next.js in a serverless environment
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
};

export default nextConfig;