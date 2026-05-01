/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "@napi-rs/canvas"];
    }
    return config;
  },
};

module.exports = nextConfig;
