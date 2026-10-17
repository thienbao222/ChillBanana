/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["images.unsplash.com", "m.media-amazon.com", "static.mercdn.net", "thumbnail.image.rakuten.co.jp"],
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
};

export default nextConfig;
