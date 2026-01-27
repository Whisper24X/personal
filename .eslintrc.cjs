module.exports = {
  extends: [
    './.eslintrc-auto-import.json',
    '@guanghe-pub/eslint-config-vue3',
    'prettier',
  ],
  globals: {
    defineProps: 'readonly',
    defineEmits: 'readonly',
    defineExpose: 'readonly',
    withDefaults: 'readonly',
    YcType: 'readonly',
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-unused-vars': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'vue/multi-word-component-names': 'off',
    'func-call-spacing': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
}
