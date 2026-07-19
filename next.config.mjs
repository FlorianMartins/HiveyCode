/** @type {import('next').NextConfig} */
const nextConfig = {
  // node-unrar-js pulls in `fs` + a .wasm binary — keep it OUT of the webpack bundle and load it from
  // node_modules at runtime (server-side only, in the /api/unrar route).
  experimental: {
    serverComponentsExternalPackages: ["node-unrar-js"],
  },
};

export default nextConfig;
