<template>
  <div id="app">
    <div class="app-title">大文件上传</div>
    <div class="app-upload">
      <el-upload action="#" :auto-upload="false" :show-file-list="false" :on-change="handleChange">
        <div class="upload-handle">上传文件</div>
      </el-upload>
    </div>
    <div class="app-progress">
      <el-progress :percentage="fakeUploadPercentage"></el-progress>
    </div>
    <div class="app-operate">
      <el-button type="primary" @click="handlePause">暂停</el-button>
      <el-button @click="handleResume">继续上传</el-button>
    </div>
  </div>
</template>

<script>
/* eslint-disable */
import axios from 'axios'

import { uploadApi } from '@/api/upload'

const CHUNK_SIZE = 2 * 1024 * 1024
const controller = new AbortController()
export default {
  name: 'App',
  data() {
    return {
      fileData: null,
      chunkList: [],
      fileList: [],
      requestList: [], // 上传切片请求列表
      workerInstance: null, // worker实例
      fileHash: '', // 文件唯一hash
      fakeUploadPercentage: 0
    }
  },
  computed: {
    // 计算总进度
    uploadPercentage() {
      if (!this.fileData || !this.fileList.length) return 0
      const loaded = this.fileList.map(item => item.size * item.percentage).reduce((acc, cur) => acc + cur)
      return parseInt((loaded / this.fileData.size).toFixed(2))
    }
  },
  watch: {
    uploadPercentage(now) {
      console.log(now)
      if (now > this.fakeUploadPercentage) {
        this.fakeUploadPercentage = now
      }
    }
  },
  methods: {
    // 上传前验证
    handleBeforeUpload(file) {
      const { name, size } = file
      const fileExtension = name.split('.').pop()
      const limitTypeList = ['jpg', 'png']
      const limitType = limitTypeList.includes(fileExtension)
      if (!limitType) {
        this.$message.error(`不支持${name}文件类型上传！`)
      }
      const limitSize = size / 1024 / 1024 < 100
      if (!limitSize) {
        this.$message.warning(`${name}文件不可大于 100M！`)
      }
      return limitType && limitSize
    },

    // 上传
    async handleChange(file) {
      this.fileData = file.raw
      console.log(this.fileData)
      
      // 上传前格式大小验证
      // if (!this.handleBeforeUpload(this.fileData)) return

      // 创建切片
      const chunkList = this.createFileChunk(this.fileData, 2)
      console.log('切片列表', chunkList)

      // 生成文件hash值
      this.fileHash = await this.calculateHash(chunkList)

      // 判断该文件是否已上传
      const { shouldUpload, uploadedList } = await this.verifyUpload(this.fileData.name, this.fileHash)
      if (!shouldUpload) {
        this.$message.success('skip upload：file upload success')
        return
      }

      // 创建上传列表
      this.fileList = chunkList.map((item, index) => {
        return {
          fileHash: this.fileHash, // 唯一hash
          chunk: item.file,
          hash: `${this.fileHash}-${index}`,
          size: item.file.size,
          percentage: uploadedList.includes(index) ? 100 : 0,
          index
        }
      })

      // 批量上传，传入已上传列表
      this.batchUploadChunk(uploadedList)
    },

    // 暂停上传
    handlePause() {
      // console.log(this.requestList)
      // this.requestList.forEach(xhr => xhr?.abort())
      controller.abort()
      this.requestList = []
    },

    // 继续上传
    async handleResume() {
      const { uploadedList } = await this.verifyUpload(this.fileData.name, this.fileHash)
      await this.batchUploadChunk(uploadedList)
    },

    /**
     * @desc 生成切片文件
     * @param {File} file 文件流数据
     * @param {Number} size 切片大小默认2M
     * */
    createFileChunk(file, size = 2) {
      const chunkList = []
      // 切片大小
      const chunkSize = size * 1024 * 1024
      let sumSize = 0
      if (chunkSize < file.size) {
        while (sumSize < file.size) {
          chunkList.push({
            file: file.slice(sumSize, sumSize + chunkSize)
          })
          sumSize += chunkSize
        }
      } else {
        chunkList.push({
          file: file
        })
      }
      return chunkList
    }, // 生成文件 hash（web-worker）

    // 计算切片文件的md5唯一hash值
    calculateHash(fileChunkList) {
      return new Promise(resolve => {
        // 添加 worker 属性
        this.workerInstance = new Worker('/hash.js')
        this.workerInstance.postMessage({ fileChunkList })
        this.workerInstance.onmessage = e => {
          const { percentage, hash } = e.data
          // this.hashPercentage = percentage
          if (hash) {
            resolve(hash)
          }
        }
      })
    },

    // 批量上传切片文件
    async batchUploadChunk(uploadedList = []) {
      const requestList = []
      // 过滤掉已上传的
      const filterList = this.fileList.filter(item => !uploadedList.includes(item.hash))
      // 创建formData批量请求
      filterList.forEach((item, index) => {
        console.log('1111', item)
        // 创建formData
        const formData = new FormData()
        formData.append('chunk', item.chunk)
        formData.append('fileHash', this.fileHash)
        formData.append('hash', item.hash)
        formData.append('filename', this.fileData.name)

        const requestObj = uploadApi(formData, {
          signal: controller.signal,
          onUploadProgress: this.createProgressHandler(index) // 计算进度条
        })
        // .then(res => {
        //   console.log(res)
        // }).catch(err => {
        //   console.log(err)
        // })

        // const requestObj = this.request({
        //   url: 'http://localhost:3003/upload',
        //   data: formData,
        //   onProgress: this.createProgressHandler(index), // 计算进度条
        //   requestList: this.requestList
        // })
        requestList.push(requestObj)
      })

      // 发送所有切片
      await Promise.allSettled(requestList)

      // 之前上传的切片数量 + 本次上传的切片数量 = 所有切片数量时合并切片
      if (uploadedList.length + requestList.length === this.fileList.length) {
        // 合并切片
        await this.mergeRequest()
      }
    },

    // 单个接口上传进度
    createProgressHandler(index) {
      return e => {
        this.fileList[index].percentage = parseInt(String((e.loaded / e.total) * 100))
      }
    },

    // 验证文件有没有上传过
    async verifyUpload(filename, fileHash) {
      const { data } = await this.request({
        url: 'http://localhost:3003/verify',
        headers: {
          'content-type': 'application/json'
        },
        data: JSON.stringify({
          filename,
          fileHash
        })
      })
      return JSON.parse(data)
    },

    // 合并请求，告诉服务器文件发送完成
    async mergeRequest() {
      await this.request({
        url: 'http://localhost:3003/merge',
        headers: {
          'content-type': 'application/json'
        },
        data: JSON.stringify({
          size: CHUNK_SIZE,
          fileHash: this.fileHash,
          filename: this.fileData.name
        })
      })
    },


    requestFn(config) {
      return new Promise(resolve, reject => {
        axios.post({
          ...config
        }).then(res => {
          resolve(res)
        }).catch(err => {
          reject(err)
        })

      })
    },

    // 封装请求接口
    request({ url, method = 'post', data, headers = {}, onProgress = e => e, requestList }) {
      return new Promise(resolve => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = onProgress
        xhr.open(method, url)
        Object.keys(headers).forEach(key => xhr.setRequestHeader(key, headers[key]))
        xhr.send(data)
        xhr.onload = e => {
          // 将请求成功的 xhr 从列表中删除
          if (requestList) {
            const xhrIndex = requestList.findIndex(item => item === xhr)
            requestList.splice(xhrIndex, 1)
          }
          resolve({
            data: e.target.response
          })
        }
        // 暴露当前 xhr 给外部
        requestList?.push(xhr)
      })
    }
  }
}
</script>

<style lang="scss" scoped>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}


.app-title {
  margin-bottom: 30px;
  font-size: 20px;
}
.app-upload {
  .upload-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100px;
    height: 100px;
    border: 1px dashed #ccc;
    border-radius: 4px;
  }
}
.app-progress {
  width: 500px;
  margin: 0 auto;
}
</style>
