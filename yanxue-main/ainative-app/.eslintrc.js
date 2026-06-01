module.exports = {
  env: {
    node: true,
    browser: true
  },
  extends: ["plugin:vue/vue3-recommended", "eslint:recommended", "prettier"],
  parser: "vue-eslint-parser",
  parserOptions: {
    parser: "@typescript-eslint/parser",
    ecmaVersion: 2021,
    sourceType: "module"
  },
  plugins: ["@typescript-eslint", "prettier"],
  globals: {
    defineProps: "readonly",
    defineEmits: "readonly",
    defineExpose: "readonly",
    withDefaults: "readonly",
    // 微信小程序全局对象
    wx: "readonly",
    getCurrentPages: "readonly",
    getApp: "readonly",
    App: "readonly",
    Page: "readonly",
    Component: "readonly",
    Behavior: "readonly",
    // Taro 全局配置
    defineAppConfig: "readonly",
    // 环境类型全局变量
    __ENV_TYPE: "readonly"
  },
  rules: {
    // 在海报生成时需要保留驼峰
    "vue/attribute-hyphenation": "off",
    // 移除console
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    "vue/multi-word-component-names": 0,
    camelcase: 0,
    "vue/require-default-prop": 0,
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        prefer: "type-imports"
      }
    ],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    "no-case-declarations": "warn",
    "prefer-promise-reject-errors": 0,
    semi: ["error", "never"],
    "prettier/prettier": "error"
  }
}
