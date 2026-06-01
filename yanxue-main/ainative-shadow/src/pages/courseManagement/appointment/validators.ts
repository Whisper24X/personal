import type { FormRules } from 'element-plus'

/**
 * 手机号验证规则
 */
export const validatePhone = (rule: any, value: string, callback: Function) => {
    if (!value) {
        callback(new Error('请输入手机号'))
    } else if (!/^1[3-9]\d{9}$/.test(value)) {
        callback(new Error('请输入正确的手机号'))
    } else {
        callback()
    }
}

/**
 * 身份证号验证规则
 */
export const validateIdNumber = (rule: any, value: string, callback: Function) => {
    if (!value) {
        callback(new Error('请输入身份证号'))
    } else if (!/^\d{17}[\dXx]$/.test(value)) {
        callback(new Error('请输入正确的身份证号'))
    } else {
        callback()
    }
}

/**
 * 获取预约表单验证规则
 * @returns 表单验证规则
 */
export function getAppointmentFormRules(): FormRules {
    return {
        courseId: [{ required: true, message: '请选择课程', trigger: 'change' }],
        courseDate: [{ required: true, message: '请选择课程日期', trigger: 'change' }],
        coursePeriod: [{ required: true, message: '请选择课程时段', trigger: 'change' }],
        childName: [{ required: true, message: '请输入孩子姓名', trigger: 'blur' }],
        idNumber: [{ required: true, validator: validateIdNumber, trigger: 'blur' }],
        gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
        age: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
        parentName: [{ required: true, message: '请输入家长姓名', trigger: 'blur' }],
        parentPhone: [{ required: true, validator: validatePhone, trigger: 'blur' }],
        parentAccompany: [{ required: true, message: '请选择家长是否陪同', trigger: 'change' }],
    }
} 