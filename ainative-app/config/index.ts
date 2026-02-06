import { defineConfig, type UserConfigExport } from "@tarojs/cli"
import { resolve } from "path"
import * as fs from "fs"
import * as path from "path"

import devConfig from "./dev"
import prodConfig from "./prod"

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<"vite">(async (merge, { command, mode }) => {
  const env = mode || "development"
  console.log("构建环境:", command, "目标环境:", env)

  // 根据环境获取CI配置文件
  let ciConfig = {}
  if (["test", "development"].includes(mode)) {
    const ciConfigPath = path.resolve(__dirname, "../ci.test.config.js")
    console.log("ciConfigPath", ciConfigPath)
    if (fs.existsSync(ciConfigPath)) {
      ciConfig = require(ciConfigPath)
    }
  } else {
    const ciConfigPath = path.resolve(__dirname, "../ci.config.js")
    if (fs.existsSync(ciConfigPath)) {
      ciConfig = require(ciConfigPath)
    }
  }
  // 小程序CI插件配置
  const CIPluginOpt = {
    weapp: {
      appid: ciConfig["WEAPP_APPID"] || "微信小程序appid",
      privateKeyPath: ciConfig["WEAPP_PRIVATE_KEY_PATH"] || "key/private.key"
    },
    version: ciConfig["WEAPP_VERSION"] || "1.0.0",
    desc: ciConfig["WEAPP_DESC"] || `${env}环境构建版本`,
    qrcodeOutputDest: path.resolve(__dirname, "../qrcode/preview.png")
    // hooks: {
    //   beforePreview: (config) => {
    //     console.log("预览前配置:", JSON.stringify(config, null, 2))
    //     return config
    //   },
    //   beforeUpload: (config) => {
    //     console.log("上传前配置:", JSON.stringify(config, null, 2))
    //     return config
    //   },
    //   afterUpload: (res) => {
    //     console.log("上传结果:", JSON.stringify(res, null, 2))
    //     return res
    //   },
    // },
  }

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
      ["@tarojs/plugin-mini-ci", CIPluginOpt],
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
