<template>
  <view>
    <canvas
      v-if="!offscreen"
      id="wxml2canvas"
      type="2d"
      canvas-id="wxml2canvas"
      class="wxml2canvas"
      :style="canvasStyle"
    />
  </view>
</template>

<script>
import Element from "./element"
import Canvas from "./canvas"

const drawElement = async (canvas, element, page, component) => {
  canvas.setElement(element)
  canvas.setTransform()
  canvas.drawBoxShadow()
  canvas.drawBackgroundColor()
  await canvas.drawBackgroundImage()

  if ("src" in element) {
    if ("objectFit" in element) {
      await canvas.drawVideo()
    } else {
      await canvas.drawImage()
    }
  } else if ("text" in element.dataset || "icon" in element.dataset) {
    canvas.drawText()
  } else if ("canvasId" in element) {
    await canvas.drawCanvas(component ?? page)
  }

  canvas.drawBorder()
  canvas.resetTransform()
  canvas.restoreContext()
}

export default {
  name: "WXML2Canvas",
  props: {
    containerClass: {
      type: String,
      default: "wxml2canvas-container"
    },
    itemClass: {
      type: String,
      default: "wxml2canvas-item"
    },
    scale: {
      type: Number,
      default: 1
    },
    offscreen: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      canvasWidth: 300,
      canvasHeight: 150
    }
  },
  computed: {
    canvasStyle() {
      return {
        width: `${this.canvasWidth}px`,
        height: `${this.canvasHeight}px`,
        position: "fixed",
        left: "9999px",
        top: "-9999px"
      }
    }
  },
  methods: {
    setDataSync(data) {
      return new Promise(resolve => {
        Object.keys(data).forEach(key => {
          this[key] = data[key]
        })
        this.$nextTick(resolve)
      })
    },
    async draw(page, component) {
      if (page && !page.route && !component) {
        component = page
      }
      // 在 Taro 环境中，我们不依赖页面实例，直接使用 null
      // Element.getNodesRef 会使用 Taro.createSelectorQuery() 来查询元素
      if (!page || !page.route) {
        page = null
      }

      const { containerClass, itemClass, scale, offscreen } = this
      const fields = {
        id: true,
        size: true,
        rect: true,
        dataset: true,
        properties: [
          ...Element.COMMON_PROPERTIES,
          ...Element.TEXT_PROPERTIES,
          ...Element.IMAGE_PROPERTIES,
          ...Element.VIDEO_PROPERTIES,
          ...Element.CANVAS_PROPERTIES
        ],
        computedStyle: [
          ...Element.COMMON_COMPUTED_STYLE,
          ...Element.TEXT_COMPUTED_STYLE,
          ...Element.IMAGE_COMPUTED_STYLE,
          ...Element.VIDEO_COMPUTED_STYLE,
          ...Element.CANVAS_COMPUTED_STYLE
        ]
      }

      const [container] = await Element.getNodesRef(`.${containerClass}`, fields, page, component)
      await this.setDataSync({
        canvasWidth: container.width * scale,
        canvasHeight: container.height * scale
      })

      const nodes = await Element.getNodesRef(
        `.${containerClass} .${itemClass}`,
        fields,
        page,
        component
      )
      const canvas = (this.canvas = new Canvas(this, offscreen ? null : "#wxml2canvas"))
      await canvas.init(container, scale)

      nodes.unshift(container)
      await this.drawElements(nodes, fields, component ?? page)
    },
    async drawElements(elements, fields, parent) {
      const { itemClass } = this
      for (const item of elements) {
        const itemElement = new Element(item)
        if (item.dataset.component) {
          const child = parent.selectComponent(`#${item.id}`)
          const childElements = await Element.getNodesRef(`.${itemClass}`, fields, child)
          await this.drawElements(childElements, fields, child)
        } else {
          await drawElement(this.canvas, itemElement, parent)
        }
      }
    },
    async toTempFilePath(original = true) {
      return await this.canvas.toTempFilePath(original)
    },
    toDataURL() {
      return this.canvas.toDataURL()
    },
    getImageData() {
      return this.canvas.getImageData()
    }
  }
}
</script>

<style scoped>
.wxml2canvas {
  position: fixed;
  left: 9999px;
  top: -9999px;
}
</style>
