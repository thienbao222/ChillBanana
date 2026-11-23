/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "static.mercdn.net" },
      { protocol: "https", hostname: "thumbnail.image.rakuten.co.jp" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "dropbox.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/?auth=login",
        permanent: false,
      },
    ];
  },
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

export default nextConfig;
