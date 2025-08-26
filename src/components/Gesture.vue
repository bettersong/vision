<template>
    <div id="liveView" class="container">
        <video id="webcam" autoplay playsinline></video>
        <canvas class="output_canvas" id="output_canvas"></canvas>
    </div>
    <div class="gesture_btn" @click="createGestureRecognizer">开启识别</div>
</template>

<script setup lang="ts">
// @ts-ignore
import { GestureRecognizer, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { ref, nextTick,onMounted } from 'vue'

// 手势识别器实例
let gestureRecognizer: any;


// 视频手势信息
const videoGestureInfo = ref({});

// 手势枚举
const enumGesture = {
  Closed_Fist: '握紧拳头',
  Open_Palm: '张开手掌',
  Thumb_Up: '竖起大拇指',
  Thumb_Down: '拇指朝下',
  Pointing_Up: '指向上',
  Victory: '胜利',
  None: '未识别',
};

// 创建手势识别器
const createGestureRecognizer = async () => {
    // 加载指定版本的MediaPipe视觉任务WebAssembly模块
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    console.log('-----', vision)
    // 创建了一个手势识别器实例(这个手势识别器实例使用的是指定版本的MediaPipe视觉任务WebAssembly模块)
    try {
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
                delegate: 'GPU'
            },
            // https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
            numHands: 2,
            runningMode: 'VIDEO' // 视频模式
        });

        console.log('手势识别器加载成功', gestureRecognizer);
        // 识别视频中的手势
        predictWebcam();
    } catch (error) {
        console.log('手势识别器加载失败', error);
    }
}

// 识别视频中的手势
const predictWebcam = async () => {
  // 判断是否可以使用摄像头
  if (!hasGetUserMedia()) return alert('此设备不允许使用摄像头!');
  // 判断手势识别器是否加载完成
  if (!gestureRecognizer) return alert('手势识别器未加载完成');

  nextTick(() => {
    // 获取video元素
    const video = document.getElementById('webcam') as HTMLVideoElement;
    // 获取视频手势节点绘制的canvas元素
    const canvasElement = document.getElementById('output_canvas') as HTMLCanvasElement;
    
    // 获取canvas的上下文
    const canvasCtx: CanvasRenderingContext2D | null = canvasElement?.getContext('2d');

    // 设置上次识别视频手势的时间
    let lastVideoTime = -1;

    // 识别视频中的手势
    const predictWebcam = () => {
      // 获取当前视频的时间
      let nowInMs = Date.now();
      let results: any = {};

      // 如果视频的时间发生变化,则识别视频中的手势
      if (video.currentTime !== lastVideoTime) {
        // 替换上次识别视频手势的时间
        lastVideoTime = video.currentTime;
        results = gestureRecognizer.recognizeForVideo(video, nowInMs);
      }

      // 保存当前的canvas状态
      canvasCtx?.save();
      // 清除canvas的内容
      canvasCtx?.clearRect(0, 0, canvasElement.width, canvasElement.height);

      // 创建drawingUtils实例,用于可视化MediaPipeVision任务的结果
      const drawingUtils = new DrawingUtils(canvasCtx);
      // 判断是否识别到手势
      if (results.landmarks) {
        // 循环绘制手势的节点
        for (const landmarks of results.landmarks) {
          // 绘制手势连接线
          drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
            // 连接线的颜色
            color: '#00FF00',
            // 连接线的宽度
            lineWidth: 3,
          });
          // 绘制手势关节点
          drawingUtils.drawLandmarks(landmarks, {
            // 关节点的颜色
            color: '#FF0000',
            // 关节点的半径
            radius: 2.5,
          });
        }
      }
      // 恢复canvas的状态
      canvasCtx?.restore();
      console.log('【手势数据】', results);
      // 判断是否识别到手势数据
    //   if (results?.gestures?.length > 0) {
    //     videoGestureInfo.value.categoryName = enumGesture[results.gestures[0][0].categoryName];
    //     videoGestureInfo.value.categoryScore = parseFloat(results.gestures[0][0].score * 100).toFixed(2);
    //     videoGestureInfo.value.handedness = results.handednesses[0][0].displayName;
    //   } else {
    //     videoGestureInfo.value.categoryName = '';
    //     videoGestureInfo.value.categoryScore = '';
    //     videoGestureInfo.value.handedness = '';
    //   }

      // 递归调用,继续识别视频中的手势
      requestAnimationFrame(predictWebcam);
    };

    // 打开摄像头
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      // 视频流添加到video元素中
      video.srcObject = stream;
      // 绑定视频加载完成事件,开始识别视频中的手势
      video.addEventListener('loadeddata', () => {
        // 设置canvas的宽度和高度为video的宽度和高度
        canvasElement.width = video?.clientWidth;
        canvasElement.height = video?.clientHeight;
        predictWebcam();
      });
      
    });
  });
}

// 判断是否可以使用摄像头
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

onMounted(() => {
  // 加载手势识别器
//   createGestureRecognizer();
})

</script>

<style scoped>
.container {
    position: relative;
}

.output_canvas {
  position: absolute;
  top: 0;
  left: 0;
  margin: 0 auto;
  transform: rotateY(180deg);
  -webkit-transform: rotateY(180deg);
  -moz-transform: rotateY(180deg);
}
.gesture_btn {
    width: 100px;
    height: 40px;
    line-height: 40px;
    text-align: center;
    background-color: #409eff;
    color: #fff;
    border-radius: 4px;
    cursor: pointer;
}
</style>