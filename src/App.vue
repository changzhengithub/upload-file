<template>
  <div id="app">
    <div class="app-title">大文件上传</div>

    <div class="app-upload">
      <UploadFile :maxRequestNum="6" drag></UploadFile>
    </div>
  </div>
</template>

<script>
import UploadFile from '@/components/UploadFile'

export default {
  name: 'App',
  components: {
    UploadFile
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
  margin-bottom: 100px;
  font-size: 20px;
}
</style>
