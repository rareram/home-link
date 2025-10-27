import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  /* Cross-origin 허용 도메인 명시 */
  allowedDevOrigins: ['arkdata.iptime.org', 'lab.iarkdata.com', '*.iarkdata.com']
};

export default nextConfig;
