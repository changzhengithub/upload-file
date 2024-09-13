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
          <span v-if="fileList.length">{{`（${successFileList.length}/${fileList.length}）`}}</span>
        </div>
      </div>

      <div class="upload-container" v-loading="loading">
        <!-- 上传进度 -->
        <div class="file-wrap" v-if="fileData">
          <div class="wrap-type">
            <img src="@/assets/images/folder.png" alt="">
          </div>
          <div class="wrap-center">
            <div class="center-top">
              <div class="top-name text-line-1">{{ fileData.name }}</div>
              <!-- <div class="top-time" v-if="uploadTime">预估：{{ uploadTime | calcTime }}</div> -->
            </div>
            <div class="center-progress">
              <el-progress :percentage="totalPrecent" :stroke-width="8" :show-text="false"></el-progress>
            </div>
            <div class="center-bottom">
              <div class="bottom-name">
                <span>{{ totalLoaded | formatSize }} / {{ fileData.size | formatSize}}</span>
              </div>
              <div class="bottom-precent">
                <span v-if="totalPrecent">{{ totalPrecent }}%</span>
              </div>
            </div>
          </div>
          <div class="wrap-operate">
            <div class="operate-item" v-if="!hasPause && hasProgress" @click="handlePause">
              <el-tooltip content="取消上传" placement="top">
                <i class="el-icon-close"></i>
              </el-tooltip>
            </div>
            <!-- <div class="operate-item" v-if="hasPause" @click="handleResume">
              <el-tooltip content="继续上传" placement="top">
                <i class="el-icon-refresh-right"></i>
              </el-tooltip>
            </div> -->
          </div>
        </div>
  
        <!-- 分片文件列表 -->
        <div class="file-slice" v-if="fileList.length">
          <div class="slice-title">分片列表</div>
          <div class="slice-list">
            <div class="list-item" v-for="(item, index) in fileList" :key="index">
              <div class="item-top">
                <div class="top-name text-line-1">{{ item.name }}</div>
                <div class="top-time" v-if="item.time">预估：{{ item.time | calcTime }}</div>
              </div>
              <div class="item-progress">
                <el-progress :percentage="item.percent" color="#e6a23" :stroke-width="4" :show-text="false"></el-progress>
              </div>
              <div class="item-bottom">
                <div class="bottom-name">
                  <span>{{ item.loaded | formatSize }} / {{ item.chunk.size | formatSize}}</span>
                  <span class="ml8" v-if="item.status == 4" style="color: #FF2517;">上传失败</span>
                </div>
                <div class="bottom-precent">
                  <span v-if="item.percent">{{ item.percent }}%</span>
                </div>
              </div>
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

export default {
  name: 'UploadFile',
  props: {
    // 是否在加载中，传递给父组件
    uploading: {
      type: Boolean
    },
    chunkSize: {
      type: Number,
      default: 10
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
      loading: false, // 加载中
      saveLoad: false,
      fileData: null,
      chunkList: [],
      fileHash: '', // 文件唯一hash
      fileList: [],
      startUploadTime: 0,
      workerInstance: null, // worker实例

      // 限制上传数量
      requestIndex: 0, // 请求指针，让第几个开始上传
      sumCount: 0, // 已请求的数量

      progressDialog: {
        visible: false
      }
    }
  },
  computed: {
    // 是否有取消上传
    hasPause() {
      return this.fileList.some(el => el.status == 2)
    },
    // 是否有上传中
    hasProgress() {
      return this.fileList.some(el => el.status == 1)
    },
    // 已上传
    successFileList() {
      return this.fileList.filter(el => el.status == 3)
    },
    // 计算总进度
    totalPrecent() {
      if (!this.fileData || !this.fileList.length) return 0
      const loaded = this.fileList.map(item => item.size * item.percent).reduce((acc, cur) => acc + cur)
      return parseFloat((loaded / this.fileData.size).toFixed(2))
    },
    // 计算总上传量
    totalLoaded() {
      if (!this.fileData || !this.fileList.length) return 0
      const loaded = this.fileList.map(item => item.size * item.percent / 100).reduce((acc, cur) => acc + cur)
      return loaded
    },
    // 总预估时间
    uploadTime() {
      if (!this.fileData || !this.fileList.length) return 0
      // 计算预估上传时间
      // 实时计算已上传多少时间(秒)
      const diffTime = (Date.now() - this.startUploadTime) / 1000
      // 平均每秒上传多少文件
      const averageSize = this.totalLoaded / diffTime
      // 还需多少时间(秒)
      const estimateTime = Math.floor((this.fileData.size - this.totalLoaded) / averageSize)
      return estimateTime ? estimateTime : 0
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
      
      this.progressDialog.visible = true
      this.loading = true

      // 创建切片
      const chunkList = this.createFileChunk(this.fileData, this.chunkSize)
      console.log('切片列表', chunkList)

      // 生成整个文件的hash值
      this.fileHash = await this.calculateHash(chunkList)

      // 判断该文件是否已上传
      // uploadedList已上传的切片
      const { shouldUpload, uploadedList } = await this.verifyUpload(this.fileData.name, this.fileHash)
      if (!shouldUpload) {
        this.progressDialog.visible = false
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
          name: hash,
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

      
      this.loading = false
      // 批量上传
      this.batchUploadChunk()
    },

    // 限制上传数量
    batchUploadChunk() {
      this.startUploadTime = Date.now()
      // 限制最大请求数量
      for (let index = 0; index < this.maxRequestNum; index++) {
        this.handleUploadFile()
      }
    },

    /**
     * @desc 上传分片文件，并限制最大请求数量
     * 1、定义全局索引指针requestIndex来执行哪个请求，每次请求确定下一个指针是哪个
     * 在当前请求完成后执行下一个请求，这样指针一直可以自增
     * 2、根据同时调用几次该接口就是限制最大请求数量
     * @author changz
     * */ 
     async handleUploadFile() {
      // 向父组件传递加载中状态
      // this.$emit('update:getUpload', true)

      const index = this.requestIndex
      // 每次请求索引自增到下一个请求
      this.requestIndex++

      const item = this.fileList[index]

      // 过滤已上传
      if (!item.status || item.status == 2) {
        // 获取FormData
        const formData = this.getFormData(item)
        // 上传文件操作
        try {
          // 开始上传
          this.fileList[index].status = 1
          // 记录上传开始时间戳
          this.fileList[index].dateNow = Date.now()
          // 上传到抖音云
          const res = await this.uploadRequest({
            index,
            url: 'http://localhost:3003/upload',
            data: formData
          })
          console.log('上传成功', res)
          this.fileList[index].status = 3
        } catch (err) {
          this.fileList[index].status = 4
          console.log('文件上传错误', err)
        }
      } else if (item.status == 3) {
        // 已上传的
        this.fileList[index].percent = 100
        this.fileList[index].loaded = item.chunk.size
        this.fileList[index].time = 0
      }
      
      // 每次上传完成判断操作
      if (this.hasPause) return

      // 自动执行判断
      this.sumCount++
      // 边界判断，如果请求索引小于请求最大值
      if (this.requestIndex <= this.fileList.length - 1) {
        // 每次执行完，不论失败还是成功继续执行下一个请求
        this.handleUploadFile()
      } else {
        // 判断是否上传完
        if (this.sumCount === this.fileList.length) {
          // 合并切片
          const data = await this.mergeRequest()
          console.log('文件上传成功', data)
        }
      }
    },

    getFormData(item) {
      // 创建formData
      const formData = new FormData()
      formData.append('fileHash', this.fileHash)
      formData.append('chunk', item.chunk)
      formData.append('hash', item.hash)
      formData.append('filename', this.fileData.name)
      return formData
    },

    // 暂停上传
    handlePause() {
      this.$confirm('确定取消上传吗？', {
        customClass: 'el-confirm-custom',
        confirmButtonClass: 'el-confirm-custom-del',
        cancelButtonText: '取消',
        confirmButtonText: '确定',
        showClose: false,
        center: true
      }).then(() => {
        // 取消请求并更新状态
        this.sumCount = 0
        this.requestIndex = 0
        this.fileList.forEach(item => {
          if (item.xhr && item.status == 1) {
            // 取消上传
            item.xhr?.abort()
            item.xhr = null
            // 更新文件列表状态
            item.reload = false
            item.status = 2
            item.percent = 0
            item.loaded = 0
            item.time = 0
          }
        })

        this.fileList = []
        this.progressDialog.visible = false
      })
    },

    // 继续上传
    handleResume() {
      this.batchUploadChunk()
    },

    // 更新单个接口上传进度
    uploadPercentage(index) {
      return (e) => {
        // 当前上传进度
        this.fileList[index].loaded = e.loaded
        // 计算文件进度
        this.fileList[index].percent = parseFloat(((e.loaded / e.total) * 100).toFixed(2))

        // 计算预估上传时间
        // 实时计算已上传多少时间(秒)
        const diffTime = (Date.now() - this.fileList[index].dateNow) / 1000
        // 平均每秒上传多少文件
        const averageSize = e.loaded / diffTime
        // 还需多少时间(秒)
        const estimateTime = Math.floor((e.total - e.loaded) / averageSize)
        this.fileList[index].time = estimateTime
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
    uploadRequest({ index, url, method = 'post', data, headers = {} }) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = this.uploadPercentage(index)
        xhr.open(method, url)
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

.upload-container {
  width: 100%;
  .file-wrap {
    display: flex;
    align-items: center;
    width: 100%;
    margin-bottom: 20px;
    .wrap-type {
      width: 28px;
      height: 28px;
      margin-right: 10px;
      img {
        display: block;
        width: 100%;
        height: 100%;
      }
    }
    .wrap-center {
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
    .wrap-operate {
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
  }
  
  // 进度条列表
  .file-slice {
    width: 100%;
    padding: 0 30px;
    margin-bottom: 15px;
    .slice-title {
      width: 100%;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .slice-list {
      width: 100%;
      max-height: 400px;
      overflow-y: auto;
      .list-item {
        width: 100%;
        padding: 0 15px;
        margin-bottom: 10px;
        font-size: 12px;
        color: #333;
        .item-top {
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
        .item-progress {
          width: 100%;
          margin-bottom: 5px;
        }
        .item-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
      }
    }
  }
}
</style>