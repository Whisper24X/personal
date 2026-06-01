<!--suppress CssInvalidPseudoSelector -->
<template>
    <div>
        <div class="image-splitter-container">
            <el-switch v-model="longImageChecked" active-text="长图上传" inactive-text="多张上传" style="margin-bottom: 20px" />

            <div v-if="!longImageChecked" class="upload-section">
                <div class="form-item-tip">不自动切图</div>
                <YcPcUpload :env="uploadEnv" accept="image/png, image/jpeg, image/jpg" :limit="5"
                    :size="4 * 1024 * 1024" filePath="yanxue/img" :uploadErrorAbort="true" :getToken="fetchToken"
                    :fileList="imgFileDetailList" :fileNameType="1" listType="picture-card"
                    :fileUploadEndHandler="fileUploadEndHandler" :fileListUploadEndHandler="fileListUploadEndHandler"
                    :fileUploadErrorHandler="fileUploadErrorHandler" :beforeUploadFileHandler="beforeUploadFileHandler"
                    :previewHandler="previewHandlerForYcUpload" :removeHandler="removeHandlerForYcUpload">
                    <template #default>
                        <!-- 空内容，使用函数插槽 -->
                        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                    </template>
                </YcPcUpload>
            </div>

            <div v-if="longImageChecked" class="upload-section">
                <div class="form-item-tip">仅允许上传700px以下图片，并且支持自动分割为每张高度500px的多张图</div>
                <el-upload v-model:file-list="longImageFile" list-type="picture-card" name="file" :multiple="false"
                    accept="image/png, image/jpeg, image/jpg" :limit="1" :auto-upload="false"
                    :on-preview="handlePreview" :on-remove="handleRemove" :before-upload="beforeUpload"
                    @change="handleUploadChange">
                    <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                </el-upload>

                <div class="img-list" v-loading.fullscreen.lock="fullscreenLoading">
                    <div v-for="(item, index) in splitImageUrl" :key="index">
                        <el-image :src="item" style="max-width: 400px; margin-top: 1px"></el-image>
                    </div>
                </div>
                <YcPcUpload1 v-show="false" ref="longImageUpload" :env="uploadEnv"
                    accept="image/png, image/jpeg, image/jpg" :limit="100" :multiple="true" :size="4 * 1024 * 1024"
                    filePath="yanxue/img" :uploadErrorAbort="true" :getToken="fetchToken" :fileList="fileListEmpty"
                    :fileNameType="1" :fileUploadEndHandler="fileUploadEndHandlerLong"
                    :fileListUploadEndHandler="fileListUploadEndHandlerLong"
                    :fileUploadErrorHandler="fileUploadErrorHandlerLong"
                    :beforeUploadFileHandler="beforeUploadFileHandlerLong"
                    :previewHandler="previewHandlerForYcUploadLong" :removeHandler="removeHandlerForYcUploadLong">
                    <template #default>
                        <!-- 空内容，使用函数插槽 -->
                        <upload-filled />
                    </template>
                </YcPcUpload1>
            </div>
        </div>

        <el-dialog v-model="previewVisible" title="预览图片">
            <el-image :src="previewImage" style="width: 100%"></el-image>
        </el-dialog>
    </div>
</template>
<script setup lang="ts">
import { ref, watch, defineProps, defineEmits, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import YcPcUpload from '@guanghe-pub/yc-pc-upload-vue'
import YcPcUpload1 from '@guanghe-pub/yc-pc-upload-vue'
import '@guanghe-pub/yc-pc-upload-vue/dist/style.css'
import getUploadParams from '@/utils/getUploadParams'
import ImageCropUploader from './ImageSpilt'
import type { UploadProps, UploadFile, UploadUserFile, ElLoading } from 'element-plus'
import type { UploadFile as CustomUploadFile } from './utils/uploader'

// 为了兼容YcPcUpload的类型定义
interface YcUploadFile {
    name: string
    url: string
    uid?: string
    status?: string
    response?: any
    [key: string]: any
}

// 定义组件属性
const props = defineProps({
    defaultImages: {
        type: Array as () => string[],
        default: () => []
    }
})

// 定义组件事件
const emit = defineEmits(['upload-complete'])

// 长图裁剪后上传引用
const longImageUpload = ref()

// 图片列表
const imgFileDetailList = ref<YcUploadFile[]>([])
const imgFileDetailSplitList = ref<YcUploadFile[]>([])
const fileListEmpty = ref<YcUploadFile[]>([])

// 是否选择长图上传详情页图
const longImageChecked = ref(false)

// 添加全屏loading状态
const fullscreenLoading = ref(false)

// 长图文件
const longImageFile = ref<UploadUserFile[]>([])

// 页面渲染使用
const splitImageUrl = ref<string[]>([])

// 长图拆分后的文件
const longImageSplitFile = ref<any[]>([])

// 触发上传完成事件
const emitUploadComplete = () => {
    fullscreenLoading.value = false
    // 根据当前模式选择要发送的图片列表
    const imageList = longImageChecked.value
        ? imgFileDetailSplitList.value.map(item => ({ ...item } as CustomUploadFile))
        : imgFileDetailList.value.map(item => ({ ...item } as CustomUploadFile))

    emit('upload-complete', imageList)
}

// 监听默认图片变化
watch(() => props.defaultImages, (newImages, oldImages) => {
    // 如果新旧值相同，不做处理
    if (JSON.stringify(newImages) === JSON.stringify(oldImages)) {
        return
    }

    if (newImages && newImages.length > 0) {
        // 将字符串数组转换为YcUploadFile数组
        imgFileDetailList.value = newImages.map(url => ({
            url: url,  // 确保url不为undefined
            name: url ? url.split('/').pop() || 'image.jpg' : 'image.jpg',
            uid: Math.random().toString(36).substring(2),
            status: 'success'
        }))

        // 触发上传完成事件，但不在初始化时触发
        if (oldImages !== undefined) {
            emitUploadComplete()
        }
    }
}, { immediate: true })

// 组件挂载后的初始化
onMounted(() => {
    console.log('ImageSplitter mounted, defaultImages:', props.defaultImages)
    // 如果有默认图片，确保它们被正确处理
    if (props.defaultImages && props.defaultImages.length > 0) {
        console.log('Processing default images on mount')
        // 这里不需要重复处理，因为watch已经处理了
    }
})

// YcPcUpload 处理函数
const fileUploadEndHandler = (file: any) => {
    // 文件上传结束处理
}

const fileListUploadEndHandler = (files: any) => {
    imgFileDetailList.value = files.map((file: any) => ({
        ...file,
        url: file.url || ''  // 确保url有值
    })) as YcUploadFile[]
    // 上传完成，关闭loading
    // fullscreenLoading.value = false
    emitUploadComplete()
}

const fileUploadErrorHandler = (err: any, f: any, files: any) => {
    console.log('file upload err~')
    console.log(err, f, files)
    // 上传出错，关闭loading
    // fullscreenLoading.value = false
    ElMessage.error('上传失败，请重试')
}

const beforeUploadFileHandler = (f: any, files: any): Promise<boolean> => {
    // 开始上传，显示loading
    fullscreenLoading.value = true
    return checkImageSize(f.f, 800, -1).then(result => !!result) // 确保返回布尔值
}

const previewHandlerForYcUpload = (f: any, files: any) => {
    handlePreview(f)
}

const removeHandlerForYcUpload = (f: any) => {
    console.log('removeHandlerForYcUpload', f)
    // 删除文件后，删除对应的图片
    const index = imgFileDetailList.value.findIndex(item => item.url === f.url)
    if (index !== -1) {
        imgFileDetailSplitList.value.splice(index, 1)
        imgFileDetailList.value.splice(index, 1)
    }
    // 删除文件后直接触发上传完成事件
    emitUploadComplete()
}

// YcPcUpload1 处理函数
const fileUploadEndHandlerLong = (file: any) => {
    // 长图文件上传结束处理
}

const fileListUploadEndHandlerLong = (files: any) => {
    imgFileDetailSplitList.value = files.map((file: any) => ({
        ...file,
        url: file.url || ''  // 确保url有值
    })) as YcUploadFile[]
    // 上传完成，关闭loading
    // fullscreenLoading.value = false
    emitUploadComplete()
}

const fileUploadErrorHandlerLong = (err: any, f: any, files: any) => {
    console.log('longImageFile file upload err~')
    console.log(err, f, files)
    // 上传出错，关闭loading
    // fullscreenLoading.value = false
    ElMessage.error('上传失败，请重试')
}

const beforeUploadFileHandlerLong = (f: any, files: any): Promise<boolean> => {
    // 开始上传，显示loading
    fullscreenLoading.value = true
    return checkImageSize(f.f, 800, -1).then(result => !!result) // 确保返回布尔值
}

const previewHandlerForYcUploadLong = (f: any, files: any) => {
    handlePreview(f)
}

const removeHandlerForYcUploadLong = () => {
    // 删除长图文件后直接触发上传完成事件
    emitUploadComplete()
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    console.log('beforeUpload triggered', file)
    // 开始上传，显示loading
    fullscreenLoading.value = true

    // 返回一个Promise
    return new Promise((resolve) => {
        try {
            const fileItem = file as unknown as any
            console.log('Checking image size for:', fileItem)

            checkImageSize(fileItem, 800, -1)
                .then((valid) => {
                    console.log('checkImageSize result:', valid)
                    if (!valid) {
                        console.log('Image validation failed')
                        // 验证失败，关闭loading
                        fullscreenLoading.value = false
                        resolve(false)
                        return
                    }

                    console.log('Setting longImageFile')
                    // 清除上次的长图裁剪记录 - 使用一次性赋值而不是多次修改响应式数据
                    const tempSplitFiles: any[] = []
                    const tempSplitUrls: string[] = []

                    // 一次性重置所有相关数据
                    longImageSplitFile.value = []
                    imgFileDetailSplitList.value = []
                    splitImageUrl.value = []

                    // 判断当前是否支持使用FileReader
                    if (window.FileReader) {
                        console.log('FileReader supported, reading file')
                        // 创建读取文件的对象
                        const fr = new FileReader()
                        // 以读取文件字符串的方式读取文件
                        fr.readAsDataURL(file)
                        fr.onloadend = function () {
                            console.log('File read complete, starting crop')
                            try {
                                ImageCropUploader.cropAndUploadImage(
                                    fr.result as string,
                                    500,
                                    function (file: any, index: any, imageUrl: any) {
                                        console.log(`Adding split image ${index}`)
                                        // 先收集到临时数组，避免频繁修改响应式数据
                                        tempSplitFiles.push(file)
                                        tempSplitUrls.push(imageUrl)
                                    },
                                    () => {
                                        // 一次性更新响应式数据
                                        longImageSplitFile.value = [...tempSplitFiles]
                                        splitImageUrl.value = [...tempSplitUrls]

                                        // 上传到服务器
                                        console.log('All images split, uploading files:', longImageSplitFile.value.length)
                                        try {
                                            console.log('longImageUpload.value', longImageUpload.value)
                                            console.log('longImageUpload.value.uploadFiles', longImageUpload.value.uploadFiles)
                                            console.log('uploadFiles is function', longImageUpload.value && typeof longImageUpload.value.uploadFiles === 'function')
                                            if (longImageUpload.value && typeof longImageUpload.value.uploadFiles === 'function') {
                                                console.log('uploadFiles', longImageSplitFile.value)
                                                longImageUpload.value.uploadFiles(longImageSplitFile.value)
                                            } else {
                                                console.error('longImageUpload.value.uploadFiles is not a function', longImageUpload.value)
                                                // 上传失败，关闭loading
                                                fullscreenLoading.value = false
                                            }
                                        } catch (e) {
                                            console.error('Error uploading files:', e)
                                            // 上传失败，关闭loading
                                            fullscreenLoading.value = false
                                        }
                                        resolve(false) // 我们自己处理上传，所以返回false阻止el-upload默认上传
                                    },
                                )
                            } catch (e) {
                                console.error('Error in cropAndUploadImage:', e)
                                // 发生错误，关闭loading
                                fullscreenLoading.value = false
                                resolve(false)
                            }
                        }
                        fr.onerror = function (e) {
                            console.error('FileReader error:', e)
                            // 发生错误，关闭loading
                            fullscreenLoading.value = false
                            resolve(false)
                        }
                    } else {
                        console.log('FileReader not supported')
                        // 不支持FileReader，关闭loading
                        fullscreenLoading.value = false
                        resolve(false)
                    }
                })
                .catch((error) => {
                    console.error('Error in checkImageSize:', error)
                    // 发生错误，关闭loading
                    fullscreenLoading.value = false
                    resolve(false)
                })
        } catch (e) {
            console.error('Unexpected error in beforeUpload:', e)
            // 发生错误，关闭loading
            fullscreenLoading.value = false
            resolve(false)
        }
    })
}

const handleRemove = (file: UploadFile) => {
    // 清除上次的长图裁剪记录
    longImageFile.value = []
    longImageSplitFile.value = []
    imgFileDetailSplitList.value = []
    splitImageUrl.value = []
}

const { fetchToken, uploadEnv } = getUploadParams()

let _URL = window.URL || window.webkitURL
const checkImageSize = async (file: any, width: any, height: any): Promise<boolean> => {
    return await new Promise((resolve, reject) => {
        let img = new Image()
        img.onload = function () {
            // 如果宽度超过700px，则返回false
            resolve(true)
        }
        img.onerror = function () {
            reject(new Error('Error loading image'))
        }
        img.src = _URL.createObjectURL(file)
    })
}

const previewVisible = ref(false)
const previewImage = ref('')

function getBase64(file: any) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result)
        reader.onerror = (error) => reject(error)
    })
}

const handlePreview = async (file: any) => {
    if (file.raw) {
        const preview = await getBase64(file.raw) as string
        previewImage.value = preview
    } else {
        previewImage.value = file.url || ''
    }
    previewVisible.value = true
}

const handleUploadChange = (uploadFile: any, uploadFiles: any) => {
    console.log('handleUploadChange', uploadFile, uploadFiles)
    // 如果beforeUpload没有被触发，我们可以在这里手动处理文件
    if (uploadFile.status === 'ready') {
        const file = uploadFile.raw
        if (file) {
            console.log('Manually triggering beforeUpload from handleUploadChange')
            beforeUpload(file)
        }
    } else if (uploadFile.status === 'fail') {
        // 上传失败，关闭loading
        fullscreenLoading.value = false
    }
}
</script>

<style lang="scss" scoped>
.image-splitter-container {
    padding: 0;
}

.upload-section {
    margin-top: 10px;
}

.form-item-tip {
    color: #909399;
    font-size: 12px;
    margin-bottom: 8px;
}

.img-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    margin-top: 16px;
}
</style>