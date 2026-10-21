import type { NextConfig } from "next";
import * as path from "path";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://login.microsoftonline.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com",
              "frame-src https://login.microsoftonline.com",
              "form-action 'self'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  outputFileTracingRoot: __dirname,
  webpack: (config, { webpack }) => {
    // Windows: resolve modules from the project only.
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      "node_modules",
    ];

    // No persistent cache.
    config.cache = false;

    // Do not follow Windows symlinks.
    config.resolve.symlinks = false;

    // Skip Windows system folders, whose globbing fails during the build.
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource: string, context: string) {
          const systemPaths = [
            'Application Data',
            'Cookies',
            'C:\\Windows',
            'C:\\ProgramData'
          ];
          return systemPaths.some(p => resource.includes(p) || context.includes(p));
        },
      })
    );

    return config;
  },
};

export default withNextIntl(nextConfig);
