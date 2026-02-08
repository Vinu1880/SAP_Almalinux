import type { NextConfig } from "next";
import * as path from "path";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: __dirname,
  webpack: (config, { isServer, webpack }) => {
    // Fix pour Windows - limiter les chemins de recherche
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      "node_modules",
    ];

    // Désactiver complètement le cache
    config.cache = false;

    // Ignorer les liens symboliques Windows
    config.resolve.symlinks = false;

    // Ajouter un plugin pour ignorer les erreurs de glob sur les dossiers système
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource: string, context: string) {
          // Ignorer les ressources dans les dossiers système Windows
          const systemPaths = [
            'Application Data',
            'Cookies',
            'Application\ Data',
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
