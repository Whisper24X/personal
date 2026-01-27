class ImageCropUploader {
    static getBase64Size(base64String: string) {
        // 去掉 data:image/...;base64, 头部
        let base64 = base64String.split(',')[1];

        // Base64 每4个字符表示3个字节
        let padding = (base64.match(/=+$/) || [''])[0].length;
        let sizeInBytes = base64.length * 0.75 - padding;

        return sizeInBytes;
    }

    // 示例：获取 KB 大小
    static formatBytes(bytes: number) {
        return (bytes / 1024).toFixed(2) + ' KB';
    }

    /**
     * @param {string} url - 要加载的图片URL
     * @param {number} segmentHeight - 每段图片的高度
     * @param {function} uploadCallback - 回调函数处理每个文件上传，接收两个参数：file 和 index
     */
    static cropAndUploadImage(url: string, segmentHeight: number, uploadCallback: (file: File, index: number, imageUrl: string) => void, uploadEnd: () => void) {
        const image = new Image()
        image.crossOrigin = 'anonymous' // 允许跨域加载
        image.src = url

        image.onload = function () {
            const imageHeight = image.naturalHeight // 获取图片的实际高度
            const imageWidth = image.naturalWidth // 获取图片的实际宽度
            const numSegments = Math.ceil(imageHeight / segmentHeight) // 计算需要分割的块数

            console.log('imageHeight', imageHeight)
            console.log('imageWidth', imageWidth)
            console.log('numSegments', numSegments)

            for (let i = 0; i < numSegments; i++) {
                // 创建临时 canvas
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')

                // 设置每个 canvas 的宽度和高度
                canvas.width = imageWidth
                const remainingHeight = imageHeight - i * segmentHeight
                const drawHeight = Math.min(segmentHeight, remainingHeight) // 确保不会超出图片高度
                canvas.height = drawHeight

                // 将图片的每一段绘制到对应的 canvas
                ctx?.drawImage(image, 0, i * segmentHeight, imageWidth, drawHeight, 0, 0, imageWidth, drawHeight)

                // 导出每一部分为 base64 的 URL
                const imageUrl = canvas.toDataURL('image/png')

                // 打印出图片体积
                let size = ImageCropUploader.getBase64Size(imageUrl);
                console.log('图片大小：' + ImageCropUploader.formatBytes(size));

                const now = new Date().getTime();
                // 将 base64 转为 File 对象
                const imgFile = ImageCropUploader.base64ToFile(imageUrl, `detail_${i}_${now}.png`)

                // 调用上传回调函数
                uploadCallback(imgFile, i, imageUrl)
            }
            uploadEnd()
        }
    }

    /**
     * 将 base64 数据转换为 File 对象
     * @param {string} base64Data - Base64 图片数据
     * @param {string} filename - 文件名称
     * @returns {File} 返回 File 对象
     */
    static base64ToFile(base64Data: string, filename: string) {
        const arr = base64Data.split(',')
        const mime = arr[0]?.match(/:(.*?);/)?.[1] // 获取 MIME 类型
        const bstr = atob(arr[1]) // 解码 Base64
        let n = bstr.length
        const u8arr = new Uint8Array(n)

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n)
        }

        // 返回一个 File 对象
        return new File([u8arr], filename, { type: mime })
    }
}

// 导出模块，以便在其他地方使用
export default ImageCropUploader
