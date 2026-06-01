// 定义上传文件的接口
export interface UploadFile {
    uid: string;
    name: string;
    status?: 'error' | 'success' | 'uploading' | 'done' | 'removed';
    response?: any;
    url?: string;
    preview?: string;
    originFileObj?: File;
    percent?: number;
    thumbUrl?: string;
    size?: number;
    type?: string;
    [key: string]: any;
}

// 定义上传响应的接口
export interface UploadResponse {
    success: boolean;
    message: string;
    data?: any;
} 