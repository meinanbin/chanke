Component({
  properties: {
    // 搜索框占位文字
    placeholder: {
      type: String,
      value: '请输入动物编号'
    },
    // 搜索关键词（双向绑定）
    searchKey: {
      type: String,
      value: ''
    },
    // 是否显示筛选按钮
    showFilter: {
      type: Boolean,
      value: true
    },
    // 页面标题（可选，不显示时不占位）
    title: {
      type: String,
      value: ''
    }
  },

  data: {
    statusBarHeight: 20,
    navBarHeight: 64
  },

  lifetimes: {
    attached() {
      const info = wx.getWindowInfo()
      this.setData({
        statusBarHeight: info.statusBarHeight || 20,
        navBarHeight: (info.statusBarHeight || 20) + 44
      })
    }
  },

  methods: {
    // 返回首页
    onBack() {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          // 如果无法返回（如直接打开），则跳转首页
          wx.reLaunch({ url: '/pages/home/home' })
        }
      })
    },

    // 搜索输入
    onSearchInput(e) {
      const value = e.detail.value
      this.triggerEvent('searchchange', { value })
    },

    // 搜索确认
    onSearchConfirm() {
      this.triggerEvent('search', { value: this.data.searchKey })
    },

    // 清除搜索
    onSearchClear() {
      this.triggerEvent('searchchange', { value: '' })
      this.triggerEvent('search', { value: '' })
    },

    // 筛选按钮
    onFilter() {
      this.triggerEvent('filter')
    }
  }
})
