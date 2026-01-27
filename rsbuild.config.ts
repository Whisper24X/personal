import { defineConfig } from '@rsbuild/core'
import { pluginVue } from '@rsbuild/plugin-vue'
import { pluginBabel } from '@rsbuild/plugin-babel'
import { pluginVueJsx } from '@rsbuild/plugin-vue-jsx'
import UploadFiles from '@guanghe-pub/onion-oss-webpack-plugin'
import path from 'path'
const projectName = process.env.APP_PROJECT_NAME
const mode = process.env.NODE_ENV

const publicPath =
  mode === 'development'
    ? `/${projectName}`
    : `//fp.yangcong345.com/${projectName}`

export default defineConfig({
  source: {
    entry: {
      index: './src/main',
    },
    alias: {
      '@': './src',
      '@utils': './src/utils',
      '@store': './src/store/modules',
      '@pages': './src/pages',
      '@routers': './src/routers/modules',
      '@components': './src/components',
    },
    define: {
      'process.env.ENV': JSON.stringify(process.env.ENV),
      'process.env.APP_PROJECT_NAME': JSON.stringify(
        process.env.APP_PROJECT_NAME,
      ),
      'process.env.BASE_API_URL': JSON.stringify(process.env.BASE_API_URL),
      'process.env.APP_NAME': JSON.stringify(process.env.APP_NAME),
      'process.env.H5_BASE_URL': JSON.stringify(process.env.H5_BASE_URL),
    },
  },
  plugins: [
    pluginVue(),
    pluginBabel({
      include: /\.(?:jsx|tsx|mjs)$/,
      exclude: /[\\/]node_modules[\\/](?!element-plus[\\/])/,
    }),
    pluginVueJsx(),
  ],
  tools: {
    rspack: (config) => {
      config.resolve = config.resolve || {};
      config.resolve.extensions = ['.mjs', '.js', '.jsx', '.ts', '.tsx'];
      config.module = config.module || {};
      config.module.rules = config.module.rules || [];
      
      config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
      });

      config.module.rules.push({
        test: /\.js$/,
        include: /node_modules[/\\]element-plus/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { modules: false }]
              ],
              plugins: [
                ['@babel/plugin-transform-runtime', { corejs: 3 }]
              ]
            }
          }
        ]
      });

      config.module.rules.push({
        test: /\.scss$/,
        include: /node_modules[/\\]element-plus/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                outputStyle: 'compressed',
              },
            },
          },
        ],
      });

      if (mode !== 'development') {
        config.plugins?.push(
          new UploadFiles({
            output: path.join(__dirname, 'dist'),
            rootDir: projectName,
          }),
        )
      }
      return config
    },
  },
  html: {
    template: './public/index.html',
  },
  output: {
    assetPrefix: publicPath,
  },
  server: {
    port: 5176,
  },
  performance: {
    chunkSplit: {
      strategy: 'split-by-module',
      override: {
        cacheGroups: {
          elementPlus: {
            test: /[\\/]node_modules[\\/]element-plus/,
            name: 'element-plus',
            chunks: 'all',
            priority: 10,
          },
        },
      },
    },
  },
})
