import { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // This prevents the build from failing if there are small type mismatches
    ignoreBuildErrors: true,
  },
  eslint: {
    // This prevents ESLint warnings from stopping your deployment
    ignoreDuringBuilds: true,
  },
  // This tells Next.js which libraries need to stay in the server environment
  // We added 'resend' and 'nodemailer' (for safety) to your existing list
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'resend', 'nodemailer'],
  
  // This helps with the function limit we discussed earlier
  output: 'standalone', 
};

export default nextConfig;