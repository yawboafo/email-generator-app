import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  
  // Optimize for Vercel deployment
  compress: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  // Turbopack configuration (required for Next.js 16)
  turbopack: {},
  
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['@/data', '@/lib'],
  },
};

export default nextConfig;
