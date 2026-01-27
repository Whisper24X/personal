// babel-preset-taro 更多选项和默认值：
// https://docs.taro.zone/docs/next/babel-config
module.exports = {
  presets: [
    [
      "taro",
      {
        framework: "vue3",
        ts: true,
        compiler: "vite",
        // 固定使用false，避免使用process变量
        useBuiltIns: false,
      },
    ],
  ],
};
