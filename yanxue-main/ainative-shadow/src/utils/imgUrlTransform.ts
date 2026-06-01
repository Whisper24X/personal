/**
 * @Date         : 2025-01-10 18:02:21
 * @Description  :
 * @Autor        : xiaozhen
 * @LastEditors  : xiaozhen
 */

export const convertImageUrlToBase64 = (url: string) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const dataURL = canvas.toDataURL('image/png')
      resolve(dataURL)
    }
    img.onerror = (err) => {
      reject(err)
    }
    img.src = url
  })
}

export const convertImageUrlToBlob = (url: string) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Conversion to Blob failed'))
        }
      }, 'image/png')
    }
    img.onerror = (err) => {
      reject(err)
    }
    img.src = url
  })
}

export const copyToClipboardWithConvertType = (
  url: string,
  convertType = 'blob',
) => {
  return new Promise((resolve, reject) => {
    if (convertType === 'string') {
      if (navigator.clipboard === undefined) {
        // 注:此方法只能在localhost跟https协议下可用,http协议下不存在此方法
        reject(new Error('请在https协议下操作'))
      } else {
        copyToClipboard(url, 'string')
          .then(() => {
            resolve(url)
          })
          .catch((err) => {
            reject(err)
          })
      }
    } else if (convertType === 'blob') {
      convertImageUrlToBlob(url)
        .then((blob) => {
          if (navigator.clipboard === undefined) {
            // 注:此方法只能在localhost跟https协议下可用,http协议下不存在此方法
            reject(new Error('请在https协议下操作'))
          } else {
            copyToClipboard(blob, 'blob')
              .then(() => {
                resolve(url)
              })
              .catch((err) => {
                reject(err)
              })
          }
        })
        .catch((err) => {
          reject(err)
        })
    }
  })
}
export const copyToClipboard = (data: any, type = 'blob') => {
  return new Promise((resolve, reject) => {
    if (navigator.clipboard === undefined) {
      // 注:此方法只能在localhost跟https协议下可用,http协议下不存在此方法
      reject(new Error('请在https协议下操作'))
    } else if (type === 'blob') {
      navigator.clipboard
        .write([
          // eslint-disable-next-line no-undef
          new ClipboardItem({
            [data.type]: data,
          }),
        ])
        .then(() => {
          resolve(data)
        })
        .catch((err) => {
          reject(err)
        })
    } else if (type === 'string') {
      navigator.clipboard
        .writeText(data)
        .then(() => {
          resolve(data)
        })
        .catch((err) => {
          reject(err)
        })
    } else {
      reject(new Error('copyToClipboard 参数错误'))
    }
  })
}
