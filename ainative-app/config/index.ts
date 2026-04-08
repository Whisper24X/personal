import { defineConfig, type UserConfigExport } from "@tarojs/cli"
import { resolve } from "path"

import devConfig from "./dev"
import prodConfig from "./prod"

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<"vite">(async (merge, { command, mode }) => {
  const env = mode || "development"
  console.log("构建环境:", command, "目标环境:", env)

  const baseConfig: UserConfigExport<"vite"> = {
    projectName: "trip-miniprogram",
    date: "2025-3-28",
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: "src",
    outputRoot: "dist",
    alias: {
      "@": resolve(__dirname, "..", "src"),
      "@/components": resolve(__dirname, "..", "src/components"),
      "@/utils": resolve(__dirname, "..", "src/utils"),
      "@/api": resolve(__dirname, "..", "src/api"),
      "@/assets": resolve(__dirname, "..", "src/assets"),
      "@/styles": resolve(__dirname, "..", "src/styles"),
      "@/types": resolve(__dirname, "..", "src/types")
    },
    plugins: [
      [
        "@tarojs/plugin-inject",
        {
          components: {
            Text: {
              "data-index": "'dataIndex'",
              "data-text": "'dataText'"
            },
            View: {
              "data-index": "'dataIndex'",
              "data-text": "'dataText'"
            },
            ScrollView: {
              "data-observe": "'dataObserve'"
            }
          }
        }
      ]
    ],
    defineConstants: {
      __ENV_TYPE: JSON.stringify(env)
    },
    copy: {
      patterns: [],
      options: {}
    },
    framework: "vue3",
    compiler: "vite",
    mini: {
      optimizeMainPackage: {
        enable: true
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {
            designWidth: 375,
            unitPrecision: 5,
            selectorBlackList: [".ignore", ".hairlines", /^\.weui-/],
            minPixelValue: 1,
            mediaQuery: false
          }
        },
        autoprefixer: {
          enable: true,
          config: {
            overrideBrowserslist: ["Android >= 4.1", "iOS >= 8", "Chrome >= 50", "last 3 versions"]
          }
        },
        url: {
          enable: true,
          config: {
            limit: 10240
          }
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: "module",
            generateScopedName: "[name]__[local]___[hash:base64:5]"
          }
        }
      }
    },
    h5: {
      publicPath: "/",
      staticDirectory: "static",
      // 本地代理联调时约定 app 监听 8200
      ...(process.env.TARO_APP_API && {
        devServer: { port: 8200, host: "0.0.0.0", open: false }
      }),
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: "css/[name].[hash].css",
        chunkFilename: "css/[name].[chunkhash].css"
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {
            overrideBrowserslist: ["last 3 versions", "Android >= 4.1", "ios >= 8", "Chrome >= 50"]
          }
        },
        pxtorem: {
          enable: true,
          config: {
            rootValue: 16,
            unitPrecision: 5,
            propList: ["*"],
            selectorBlackList: [".ignore", ".hairlines", /^\.weui-/],
            minPixelValue: 1,
            mediaQuery: false
          }
        },
        viewportUnits: {
          enable: true,
          config: {
            viewportWidth: 375,
            viewportHeight: 667,
            unitPrecision: 5,
            viewportUnit: "vw",
            selectorBlackList: [".ignore", ".hairlines"],
            minPixelValue: 1,
            mediaQuery: false
          }
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: "module",
            generateScopedName: "[name]__[local]___[hash:base64:5]"
          }
        }
      }
    },
    rn: {
      appName: "taroDemo",
      postcss: {
        cssModules: {
          enable: false // 默认为 false，如需使用 css modules 功能，则设为 true
        }
      }
    }
  }

  process.env.BROWSERSLIST_ENV = process.env.NODE_ENV

  if (process.env.NODE_ENV === "development") {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})
