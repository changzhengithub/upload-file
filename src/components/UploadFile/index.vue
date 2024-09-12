<!-- 
 * author: changz
 * @desc 大文件上传
-->
<template>
  <div class="tos-upload-cls">
    <!-- 上传组件 -->
    <el-upload
      action="#"
      :drag="drag"
      :disabled="disabled"
      :accept="accept"
      :auto-upload="false"
      :show-file-list="false" 
      :on-change="handleChange"
    >
      <!-- 自定义上传样式 -->
      <slot>
        <el-button v-if="!drag" size="small" type="primary">点击上传</el-button>
        <!-- 拖拽样式 -->
        <template v-if="drag">
          <i class="el-icon-upload"></i>
          <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        </template>
      </slot>
    </el-upload>

    <!-- 进度条展示 -->
    <el-dialog
      custom-class="el-dialog-custom"
      :visible="progressDialog.visible"
      width="600px"
      append-to-body
      :footer="false"
      :show-close="false"
    >
      <!-- 自定义标题 -->
      <div class="file-header" slot="title">
        <div class="header-title">
          <span>正在上传</span>
          <span v-if="fileRequestList.length">{{`（${successFileList.length}/${fileRequestList.length}）`}}</span>
        </div>
        <div class="header-cancel">
          <span @click="closeProgress">全部取消</span>
        </div>
      </div>

      <!-- 文件列表 -->
      <div class="file-list" v-if="fileRequestList.length">
        <div class="list-item" v-for="(item, index) in fileRequestList" :key="index">
          <div class="item-type">
            <img v-if="!isImage(item.name)" src="@/assets/images/file-video.png" alt="">
            <img v-else src="@/assets/images/file-jpg.png" alt="">
          </div>
          <div class="item-center">
            <div class="center-top">
              <div class="top-name text-line-1">{{ item.file.name }}</div>
              <div class="top-time" v-if="item.time">预估：{{ item.time | calcTime }}</div>
            </div>
            <div class="center-progress">
              <el-progress :percentage="item.percent" :show-text="false"></el-progress>
            </div>
            <div class="center-bottom">
              <div class="bottom-name">
                <span>{{ item.loaded | formatSize }} / {{ item.file.size | formatSize}}</span>
                <span class="ml8" v-if="item.status == 4" style="color: #FF2517;">上传失败</span>
              </div>
              <div class="bottom-precent">
                <span v-if="item.percent">{{ item.percent }}%</span>
              </div>
            </div>
          </div>
          <div class="item-operate">
            <div class="operate-item" v-if="item.status == 1" @click="cancelUpload(index)">
              <el-tooltip content="取消" placement="top">
                <i class="el-icon-close"></i>
              </el-tooltip>
            </div>
            <div class="operate-item" v-if="item.status == 2" @click="resetUpload(index)">
              <el-tooltip content="重传" placement="top">
                <i class="el-icon-refresh-right"></i>
              </el-tooltip>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>
<script>
/**
 * @desc 大文件上传
 * @param {Number} chunkSize 分片大小(MB)
 * @param {Number} maxRequestNum 最大请求数量
 * @param {Boolean} disabled 是否禁用
 * @param {Boolean} drag 是否拖拽上传
 * @param {Boolean} multiple 多选
 * @param {Boolean} progress 是否显示进度条
 * @param {Boolean} beforeUpload 文件上传验证
 * @param {String} accept 文件上传验证
 * @param {Array} fileType 文件类型
 * @param {Number} fileSize 文件大小MB
 * @author changz
 * */ 

/* eslint-disable */
import { isImage } from '@/utils/util'

export default {
  name: 'UploadTosFile',
  props: {
    // 是否在加载中，传递给父组件
    uploading: {
      type: Boolean
    },
    chunkSize: {
      type: Number,
      default: 2
    },
    maxRequestNum: {
      type: [String, Number],
      default: 1
    },
    drag: {
      type: Boolean
    },
    headers: {
      type: Object
    },
    progress: {
      type: Boolean
    },
    disabled: {
      type: Boolean
    },
    // 文件上传验证
    beforeUpload: {
      type: Boolean
    },
    // 接受上传的文件类型
    accept: {
      type: String,
      default: ''
    },
    // 文件类型
    fileType: {
      type: Array,
      default: () => []
    },
    // 文件大小
    fileSize: {
      type: Number,
      default: 2
    }
  },
  data() {
    return {
      isImage,
      loading: false,
      saveLoad: false,
      fileData: null,
      chunkList: [],
      fileHash: '', // 文件唯一hash
      fileList: [],
      requestList: [], // 上传切片请求列表
      workerInstance: null, // worker实例
      fileHash: '', // 文件唯一hash
      fakeUploadPercentage: 0,

      fileRequestList: [], // 切片请求队列
      
      requestIndex: 0, // 全局索引，让第几个文件进行请求
      sumCount: 0, // 已请求的数量
      reloadIndex: 0, // 重传索引

      progressDialog: {
        visible: false
      }
    }
  },
  computed: {
    // 是否有取消上传
    hasPause() {
      return this.fileRequestList.some(el => el.status == 2)
    },
    // 是否有上传中
    hasProgress() {
      return this.fileRequestList.some(el => el.status == 1)
    },
    // 是否有重新上传
    hasReload() {
      return this.fileRequestList.some(el => el.reload)
    },
    // 已上传
    successFileList() {
      return this.fileRequestList.filter(el => el.status == 3)
    }
  },
  created() {},
  methods: {
    // 上传文件
    async handleChange(elFile) {
      this.fileData = elFile.raw
      console.log('文件对象', this.fileData)
      // 上传前格式大小验证
      if (this.beforeUpload) {
        if (!this.handleBeforeUpload(this.fileData)) return
      }

      // 创建切片
      const chunkList = this.createFileChunk(this.fileData, 2)
      console.log('切片列表', chunkList)

      // 生成整个文件的hash值
      this.fileHash = await this.calculateHash(chunkList)

      // 判断该文件是否已上传
      // uploadedList已上传的切片
      const { shouldUpload, uploadedList } = await this.verifyUpload(this.fileData.name, this.fileHash)
      if (!shouldUpload) {
        this.$message.success('skip upload：file upload success')
        return
      }

      // 创建上传列表
      this.fileList = chunkList.map((item, index) => {
        const hash = `${this.fileHash}-${index}` // 根据文件hash生成切片hash

        const uploaded = uploadedList.includes(hash) // 是否已经上传
        return {
          fileHash: this.fileHash, // 唯一hash
          size: item.file.size,
          chunk: item.file,
          hash,
          index, // 当前索引
          xhr: null, // 当前请求
          status: uploaded ? 3 : 0, // 0 未上传  1上传中 2 取消上传 3 上传成功 4 上传失败
          reload: false, // 是否是重新上传
          percent: uploaded ? 100 : 0, // 上传进度
          loaded: 0, // 已上送大小（字节）
          dateNow: 0, // 记录上传时间
          time: 0, // 预估上传时间
        }
      })

      // 批量上传，传入已上传列表
      this.batchUploadChunk()
    },

    // 批量上传切片文件
    async batchUploadChunk() {
      const requestList = [] // 真实请求列表
      // 创建formData批量请求
      this.fileList.forEach((item, index) => {
        if (!item.status) {
          // 创建formData
          const formData = new FormData()
          formData.append('fileHash', this.fileHash)
          formData.append('chunk', item.chunk)
          formData.append('hash', item.hash)
          formData.append('filename', this.fileData.name)
          
          const requestObj = this.uploadRequest({
            index,
            url: 'http://localhost:3003/upload',
            data: formData
          })
          requestList.push(requestObj)
        }
      })
      console.log('请求列表', requestList)

      this.progressDialog.visible = true
      // 发送所有切片
      await Promise.allSettled(requestList)

      // 之前上传的切片数量 + 本次上传的切片数量 = 所有切片数量时合并切片
      if (uploadedList.length + requestList.length === this.fileList.length) {
        // 合并切片
        const data = await this.mergeRequest()
        console.log('文件上传成功', data)
      }
    },

    // 更新某个文件的上传进度
    uploadPercentage(index) {
      return (e) => {
        // 当前上传进度
        this.fileRequestList[index].loaded = e.loaded
        // 计算文件进度
        this.fileRequestList[index].percent = parseFloat(((e.loaded / e.total) * 100).toFixed(2))

        // 计算预估上传时间
        // 实时计算已上传多少时间(秒)
        const diffTime = (Date.now() - this.fileRequestList[index].dateNow) / 1000
        // 平均每秒上传多少文件
        const averageSize = e.loaded / diffTime
        // 还需多少时间(秒)
        const estimateTime = Math.floor((e.total - e.loaded) / averageSize)
        this.fileRequestList[index].time = estimateTime
      }
    },

    // 单个接口上传进度
    createProgressHandler(index) {
      return e => {
        this.fileList[index].percentage = parseInt(String((e.loaded / e.total) * 100))
      }
    },

    // 合并请求，告诉服务器文件发送完成
    async mergeRequest() {
      const chunkSize = this.chunkSize * 1024 * 1024
      await this.request({
        url: 'http://localhost:3003/merge',
        headers: {
          'content-type': 'application/json'
        },
        data: JSON.stringify({
          size: chunkSize,
          fileHash: this.fileHash,
          filename: this.fileData.name
        })
      })
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

    /**
     * @desc 生成切片文件
     * @param {File} file 文件流数据
     * @param {Number} size 切片大小默认2M
     * */
    createFileChunk(file, size = this.chunkSize) {
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
    },

    // 计算文件的md5唯一hash值，可以直接针对整个文件计算，不必把每个分片计算
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

    // 文件上传接口封装
    uploadRequest(index, url, method = 'post', data, headers = {}) {
      // 记录上传开始时间戳
      this.fileList[index].dateNow = Date.now()
      // 开始上传
      this.fileList[index].status = 1
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = this.uploadPercentage(index)
        xhr.open(method, url)
        Object.keys(headers).forEach(key => xhr.setRequestHeader(key, headers[key]))
        xhr.send(data)
        xhr.onload = e => {
          // 上传完成
          this.fileList[index].status = 3
          resolve({
            data: e.target.response
          })
        }
        xhr.onerror = (err) => {
          reject(err)
        }
        // 暴露当前 xhr 用于取消请求
        this.fileList[index].xhr = xhr
      })
    },

    // 封装请求接口
    request({ url, method = 'post', data, headers = {} }) {
      return new Promise(resolve => {
        const xhr = new XMLHttpRequest()
        xhr.open(method, url)
        Object.keys(headers).forEach(key => xhr.setRequestHeader(key, headers[key]))
        xhr.send(data)
        xhr.onload = e => {
          resolve({
            data: e.target.response
          })
        }
      })
    },


    // 获取上传文件内容
    handleUploadChange(elFile) {
      const file = elFile.raw
      console.log('文件对象', file)
      // 上传前格式大小验证
      if (this.beforeUpload) {
        if (!this.handleBeforeUpload(file)) return
      }

      const index = this.fileRequestList.length
      const type = file.name.split('.').pop() // 文件类型
      // 添加到文件列表
      const obj = {
        index,
        file,
        name: file.name,
        type, // 文件类型
        xhr: null, // 当前请求
        status: 0, // 0 未上传  1上传中 2 取消上传 3 上传成功 4 上传失败
        reload: false, // 是否是重新上传
        percent: 0, // 上传进度
        loaded: 0, // 已上送大小（字节）
        dateNow: 0, // 记录上传时间
        time: 0, // 预估上传时间
        // 创建素材时存储的对应地址，告诉后端存储到哪目录
        filePath: this.dyTosPath ? `${this.dyTosPath}${file.name}` : file.name,
        // 上传图片时后端返回的抖音存储地址，在上传图片时用来获取图片
        tosPath: ''
      }
      this.fileRequestList.push(obj)

      // 限制最大请求数量，根据已请求数量和未完成的数量计算出正在请求数量，来判断再次上传是否需要再执行handleUploadFile
      // 正在请求数量，一旦发请求，全局索引会自增
      const requestNum =  this.requestIndex - this.sumCount
      // 如果最大请求数量大于正在请求数量，说明可以继续上传
      if (this.maxRequestNum > requestNum) {
        this.handleUploadTosFile()
      }

      // 是否打开进度条
      if (this.progressDialog.visible || !this.progress) return
      this.progressDialog.visible = true
    },

    /**
     * @desc 上传TOS文件，并限制最大请求数量
     * @param {*} flag 是否是重传文件
     * 1、定义全局索引指针requestIndex来执行哪个请求，每次请求确定下一个指针是哪个
     * 在当前请求完成后执行下一个请求，这样指针一直可以自增
     * 2、根据同时调用几次该接口就是限制最大请求数量
     * @author changz
     * */ 
    async handleUploadTosFile(flag) {
      // 向父组件传递加载中状态
      this.$emit('update:getUpload', true)
      let index = this.requestIndex
      if (flag) {
        index = this.reloadIndex
      } else {
        // 每次请求索引自增到下一个请求
        this.requestIndex++
      }
      
      const { file, filePath, sceneCode } = this.fileRequestList[index]

      // 上传文件操作
      // try {
      //   // 调用后端接口获取抖音TOS上传地址
      //   const signRes = await preSignedUploadUrlApi({
      //     sceneCode,
      //     path: filePath
      //   })
      //   console.log('上传地址结果', signRes)
      //   const { uploadUrl, tosPath } = signRes.data
      //   this.fileRequestList[index].tosPath = tosPath
      //   // 转成二进制流上传到抖音云
      //   const binaryData = await this.readArrayBuffer(file)
      //   this.fileRequestList[index].status = 1
      //   // 上传到抖音云
      //   const tosResq = await this.tosRequest(index, uploadUrl, binaryData)
      //   console.log('上传抖音云成功', tosResq)
      //   this.fileRequestList[index].status = 3
      //   // 提交事件
      //   this.$emit('change', this.fileRequestList[index])

      // } catch (err) {
      //   this.fileRequestList[index].status = 4
      //   console.log('文件上传错误', err)
      // } finally {
      //   // 每次上传完成判断操作
      //   if (flag) {
      //     // 关闭重传判断
      //     this.fileRequestList[index].reload = false
      //   } else {
      //     // 自动执行判断
      //     this.sumCount++
      //     // 边界判断，如果请求索引小于请求最大值
      //     if (this.requestIndex <= this.fileRequestList.length - 1) {
      //       // 每次执行完，不论失败还是成功继续执行下一个请求
      //       this.handleUploadTosFile()
      //     } else {
      //       // 全上传完且没有重传就关闭进度条，清空弹窗
      //       if (!this.hasPause) {
      //         this.clearFileList()
      //         // 向父组件传递加载中状态
      //         this.$emit('update:getUpload', false)
      //       }
      //     }
      //   }
      // }
    },

    // 把File转成二进制流
    readArrayBuffer(file) {
      return new Promise((resolve) => {
        // 转成二进制流上传到抖音云
        const fileReader = new FileReader()
        fileReader.readAsArrayBuffer(file)
        // 读取完成时的回调
        fileReader.onload = (event) => {
          // 转换为二进制流
          const binaryData = event.target.result
          resolve(binaryData)
        }
      })
    },

    // 上传到抖音云
    tosRequest(index, url, data, headers = {}) {
      // 记录上传开始时间戳
      this.fileRequestList[index].dateNow = Date.now()
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = this.uploadPercentage(index)
        xhr.open('PUT', url)
        Object.keys(headers).forEach(key => xhr.setRequestHeader(key, headers[key]))
        xhr.send(data)
        xhr.onload = e => {
          resolve({
            data: e.target.response
          })
        }
        xhr.onerror = (err) => {
          reject(err)
        }
        // 暴露当前 xhr 用于取消请求
        this.fileRequestList[index].xhr = xhr
      })
    },

    // 取消上传
    async cancelUpload(index) {
      if (this.fileRequestList[index].status !== 1) return
      // 取消上传
      this.fileRequestList[index].xhr?.abort()
      this.fileRequestList[index].xhr = null
      // 更新文件列表状态
      this.fileRequestList[index].reload = false
      this.fileRequestList[index].status = 2
      this.fileRequestList[index].percent = 0
      this.fileRequestList[index].loaded = 0
      this.fileRequestList[index].time = 0

      // 取消后继续执行下一个请求
      if (this.requestIndex <= this.fileRequestList.length - 1) {
        // 判断没有正在请求的就继续请求
        if (!this.hasProgress) this.handleUploadTosFile()
      }
    },
    
    // 重新上传
    resetUpload(index) {
      // 有正在重新上传的
      if (this.hasReload) return
      this.fileRequestList[index].reload = true
      this.fileRequestList[index].status = 0
      this.fileRequestList[index].xhr = null
      this.fileRequestList[index].percent = 0
      this.fileRequestList[index].loaded = 0
      this.fileRequestList[index].time = 0
      this.reloadIndex = index
      // 重传
      this.handleUploadTosFile(true)
    },

    // 上传前验证
    handleBeforeUpload(file) {
      console.log(file)
      const { name, size } = file
      const fileExtension = name.split('.').pop()
      // 类型验证
      const limitTypeList = this.fileType
      const limitType = !this.fileType.length || limitTypeList.includes(fileExtension)
      if (!limitType) {
        this.$message.error(`不支持${name}文件类型上传！`)
        // return false
      }
      // 文件大小验证
      const limitSize = size / 1024 / 1024 < this.fileSize
      if (!limitSize) {
        this.$message.error(`${name}文件不可大于 ${this.fileSize}MB！`)
        // return false
      }
      return limitType && limitSize
    },

    // 手动关闭进度条
    closeProgress() {
      this.$confirm('确定取消全部上传吗？', {
        customClass: 'el-confirm-custom',
        confirmButtonClass: 'el-confirm-custom-del',
        cancelButtonText: '取消',
        confirmButtonText: '确定',
        showClose: false,
        center: true
      }).then(() => {
        this.fileRequestList.forEach(item => {
          if (item.xhr) item.xhr?.abort()
        })
        this.closeDialog()
      })
    },

    // 关闭弹窗
    closeDialog() {
      this.clearFileList()
      this.$emit('close')
    },

    clearFileList() {
      this.progressDialog.visible = false
      this.fileRequestList  = []
      this.reloadIndex = 0
      this.sumCount = 0
      this.requestIndex = 0
    }

  }
}
</script>
<style lang="scss" scoped>
.tos-upload-cls {
  display: inline-block;

  .file-upload {
    display: flex;
    justify-content: center;
    margin-bottom: 30px;
    ::v-deep .el-upload {
      width: 560px;
      .el-upload-dragger {
        width: 100%;
        // height: 200px;
      }
    }
  }
}


// 弹窗body样式
::v-deep .el-dialog__body {
  padding: 15px 20px;
}

// 弹窗标题
.file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  .header-title {
    font-size: 16px;
  }
  .header-cancel {
    font-size: 12px;
    color: #838A99;
    cursor: pointer;
  }
}

// 进度条列表
.file-list {
  width: 100%;
  margin-bottom: 15px;
  .list-item {
    display: flex;
    align-items: center;
    width: 100%;
    height: 56px;
    padding: 0 10px;
    .item-type {
      width: 28px;
      height: 28px;
      margin-right: 10px;
      img {
        display: block;
        width: 100%;
        height: 100%;
      }
    }
    .item-center {
      flex: 1;
      font-size: 12px;
      color: #333;
      .center-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        margin-bottom: 5px;
        font-size: 12px;
        color: #333;
        .top-name {
          max-width: 300px;
        }
      }
      .center-progress {
        width: 100%;
        margin-bottom: 5px;
      }
      .center-bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
      }
    }
    .item-operate {
      display: flex;
      justify-content: flex-end;
      width: 38px;
      height: 100%;
      padding-top: 10px;
      .operate-item {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        font-size: 16px;
        color: #2D50EE;
        background: rgba(45, 80, 238, 0.06);
        border-radius: 50%;
        cursor: pointer;
      }
    }
    // &:hover {
    //   background-color: rgba(45, 80, 238, 0.06);
    // }
  }
}
</style>