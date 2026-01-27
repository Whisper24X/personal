/**
 * 限制并发上传数量的管道函数
 * @param {UploadFile[]} files 文件列表
 * @param {Function} handler 处理函数
 * @param {number} limit 并发限制数量
 */
function limitLoad(files: any[], handler: (file: any) => Promise<void>, limit: number) {
  // 对数组进行一个拷贝
  const sequence = [...files]
  let promises: Promise<number>[] = []

  // 实现并发请求达到最大值
  promises = sequence.splice(0, limit).map((file, index) => {
    // 这里返回的 index 是任务在数组 promises 的脚标
    // 用于在 Promise.race 后找到完成的任务脚标
    return handler(file).then(() => {
      return index
    })
  })

  // 利用数组的 reduce 方法来以队列的形式执行
  return sequence
    .reduce((last, file, currentIndex) => {
      return last
        .then(() => {
          // 返回最快改变状态的 Promise
          return Promise.race(promises)
        })
        .catch(err => {
          // 这里的 catch 不仅用来捕获前面 then 方法抛出的错误
          // 更重要的是防止中断整个链式调用
          // 此处错误捕获，目的是用来捕获分片上传时，文件片段上传失败，并进行重试
          console.error(err)
        })
        .then(res => {
          // 用新的 Promise 替换掉最快改变状态的 Promise
          promises[res] = handler(sequence[currentIndex]).then(() => {
            return res
          })
        })
    }, Promise.resolve())
    .then(() => {
      return Promise.all(promises)
    })
}

export default limitLoad
