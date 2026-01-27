declare module '@guanghe-pub/yc-pc-upload-vue' {
  import { DefineComponent } from 'vue'

  interface UploadFile {
    name: string
    url: string
    uid?: string
    status?: string
    response?: any
    [key: string]: any
  }

  const component: DefineComponent<{
    accept: string
    limit: number
    fileNameType: number
    env: string
    filePath: string
    fileList: UploadFile[]
    getToken: () => Promise<string>
    fileUploadEndHandler: (file: UploadFile | null) => void
    fileListUploadEndHandler?: (files: UploadFile[]) => void
    fileUploadErrorHandler?: (err: any, file: UploadFile, files: UploadFile[]) => void
    beforeUploadFileHandler?: (file: any, files: any) => Promise<boolean>
    previewHandler?: (file: UploadFile, files: UploadFile[]) => void
    removeHandler: () => void
    uploadErrorAbort?: boolean
    size?: number
    multiple?: boolean
    listType?: string
  }>
  export default component
}
