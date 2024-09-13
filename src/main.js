import Vue from 'vue'
import App from './App.vue'


// 过滤器
import '@/utils/filters'

import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

Vue.config.productionTip = false

Vue.use(ElementUI)

// 自定义样式
import '@/assets/scss/index.scss'

new Vue({
  render: h => h(App),
}).$mount('#app')
