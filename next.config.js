/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
    // Force Next.js / Vercel to trace and include the pdfjs-dist worker and fonts
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/pdfjs-dist/**/*"],
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "@napi-rs/canvas"];
    }
    return config;
  },
};

module.exports = nextConfig;
