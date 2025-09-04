<template>
    <div class="container">
        <div class="loading" v-if="loadingAssets">加载模型资源中...</div>
        <video id="webcam" width="640" height="480" autoplay playsinline></video>
        <canvas class="hand_canvas" id="handCanvas"></canvas>
        <canvas class="pen_canvas" id="penCanvas"></canvas>
    </div>

    <!-- <div v-if="videoGestureInfo.categoryName">
        手势: {{ videoGestureInfo.categoryName }} (置信度: {{ videoGestureInfo.categoryScore }}%)
    </div> -->

    <div class="gesture_btn" @click="start">{{ isOpen ? '停止识别' : '开启识别' }}</div>
</template>

<script setup lang="ts">
// @ts-ignore
import { GestureRecognizer, FilesetResolver, DrawingUtils, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { ref, nextTick } from 'vue'

// 手势识别器实例
let gestureRecognizer: any;
let tracks: any;
// 视频手势信息
const videoGestureInfo = ref<any>({});

const loadingAssets = ref(false) // 资源加载状态
const isOpen = ref(false) // 识别状态
let prevX: number | null = null // 上一个X坐标
let prevY: number | null = null // 上一个Y坐标

// 手势枚举
const enumGesture = {
  Closed_Fist: '握拳',
  Open_Palm: '张开手掌',
  Thumb_Up: '竖起大拇指',
  Thumb_Down: '拇指朝下',
  Pointing_Up: '指向上',
  Victory: '胜利',
  None: '未识别',
};

const showGesture = ref('')
const start = () => {
  if(!isOpen.value) {
    createGestureRecognizer();
  }else {
    stop();
  }
}

const stop = () => {
  if (gestureRecognizer) {
    gestureRecognizer.close();
    gestureRecognizer = null;
    // 关闭视频
    tracks.forEach((track: any) => track.stop());
  }
  isOpen.value = false;
}

// 创建手势识别器
const createGestureRecognizer = async () => {
    // 加载指定版本的MediaPipe视觉任务WebAssembly模块
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    console.log('-----', vision)
    // 创建了一个手势识别器实例(这个手势识别器实例使用的是指定版本的MediaPipe视觉任务WebAssembly模块)
    try {
        loadingAssets.value = true;
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: './gesture_recognizer.task',
            },
            // https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
            numHands: 2,
            runningMode: 'VIDEO' // 视频模式
        });
        isOpen.value = true;
        console.log('手势识别器加载成功', gestureRecognizer);
        // 识别视频中的手势
        startPredictWebcam();
    } catch (error) {
        isOpen.value = false;
        console.log('手势识别器加载失败', error);
    }
    loadingAssets.value = false;
}

// 识别视频中的手势
let oldGesture = '' // 上一个识别的手势
const startPredictWebcam = async () => {
  // 判断是否可以使用摄像头
  if (!hasGetUserMedia()) return alert('此设备不允许使用摄像头!');
  // 判断手势识别器是否加载完成
  if (!gestureRecognizer) return alert('手势识别器未加载完成');

  nextTick(() => {
    // 获取video元素
    const video = document.getElementById('webcam') as HTMLVideoElement;
    // 获取视频手势节点绘制的canvas元素
    const canvasElement = document.getElementById('handCanvas') as HTMLCanvasElement;
    // 获取视频手势节点绘制的canvas元素
    const penCanvasElement = document.getElementById('penCanvas') as HTMLCanvasElement;

    // 获取canvas的上下文
    const canvasCtx: CanvasRenderingContext2D | null = canvasElement?.getContext('2d');
    const penCanvasCtx: CanvasRenderingContext2D | null = penCanvasElement?.getContext('2d');

    // 设置上次识别视频手势的时间
    let lastVideoTime = -1;

    // 识别视频中的手势
    const predictWebcam = () => {
      // 获取当前视频的时间
      // let nowInMs = Date.now();
      let results: any = {};

      // 如果视频的时间发生变化,则识别视频中的手势
      if (video.currentTime !== lastVideoTime) {
        // 替换上次识别视频手势的时间
        lastVideoTime = video.currentTime;
        results = gestureRecognizer?.recognizeForVideo(video, video.currentTime);
      }

      // 保存当前的canvas状态
      canvasCtx?.save();
      // 清除canvas的内容
      canvasCtx?.clearRect(0, 0, canvasElement.width, canvasElement.height);

      // 创建drawingUtils实例,用于可视化MediaPipeVision任务的结果
      const drawingUtils = new DrawingUtils(canvasCtx);
      // if(results?.gestures?.length) {
      //   showGesture.value = enumGesture[results.gestures[0][0].categoryName as keyof typeof enumGesture];
      // }
       const width = canvasElement?.width;
        const height = canvasElement?.height;
      // 判断是否识别到手势
      if (results?.landmarks?.length) {
        // console.log(results)
       
        // 循环绘制手势的节点

        for (const landmarks of results.landmarks) {
          const thumbTip = landmarks[4]; // 大拇指尖
          const indexFingerTip = landmarks[8]; // 食指尖

          const dx = (thumbTip.x - indexFingerTip.x) * width; // 计算x轴距离
          const dy = (thumbTip.y - indexFingerTip.y) * height; // 计算y轴距离

          const connected = dx < 35 && dy < 35; // 判断是否近似贴合
          // console.log(dx, dy, connected);
          if (connected) {
            const x = (1 - indexFingerTip.x) * width; // 计算x坐标
            const y = indexFingerTip.y * height; // 计算y坐标
            writeText(penCanvasCtx, x, y);
          } else {
            prevX = prevY = 0;
          }
          // 绘制手势关节点
          drawPalm(landmarks, canvasCtx, drawingUtils);
        }
      }
      // 恢复canvas的状态
      canvasCtx?.restore();
      
      // 判断是否识别到手势数据
      if (results?.gestures?.length > 0) {
        const categoryName = enumGesture[results.gestures[0][0].categoryName as keyof typeof enumGesture] // 获取手势类别名称
        const categoryScore = parseFloat(`${results.gestures[0][0].score * 100}`).toFixed(2); // 获取手势置信度

        videoGestureInfo.value = {
          categoryName,
          categoryScore,
        };

        if (oldGesture === enumGesture.Open_Palm && categoryName === enumGesture.Closed_Fist) {
          console.log('检测到手势变化，开始截图');
          // 截屏
          takeScreenshot();
        }

        // if(categoryName === enumGesture.Open_Palm) {
        //   const landmarks = results.landmarks[0];

        //   // 计算手掌的中心点，将9当成近似中心点
        //   const palmCenterX = (1 - landmarks[9].x) * width;
        //   const palmCenterY = landmarks[9].y * height;
        //   // 计算手掌长宽
        //   const handWidth = (1 - landmarks[0].x) * width - (1 - landmarks[5].x) * width;
        //   const handHeight = landmarks[0].y * height - landmarks[5].y * height;
        //   // 以手掌中心为中心点，手掌区域清除画布
        //   clearCanvas(penCanvasCtx, palmCenterX - handWidth / 2, palmCenterY - handHeight / 2, handWidth, handHeight);
        // }


        if(videoGestureInfo.value.categoryName !== enumGesture.None) {
          oldGesture = videoGestureInfo.value.categoryName; // 记录上一个手势
        }
        
        // console.log('【手势数据】', results, videoGestureInfo.value);
      } else {
        videoGestureInfo.value = {
          categoryName: '',
          categoryScore: '',
          handedness: ''
        };
      }

      // 递归调用, 持续识别视频中的手势
      requestAnimationFrame(predictWebcam);
    };

    // 打开摄像头
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      // 视频流添加到video元素中
      tracks = stream.getTracks();
      video.srcObject = stream;
      // 绑定视频加载完成事件,开始识别视频中的手势
      video.addEventListener('loadeddata', () => {
        // 设置canvas的宽度和高度为video的宽度和高度
        canvasElement.width = video?.clientWidth;
        canvasElement.height = video?.clientHeight;
        penCanvasElement.width = video?.clientWidth;
        penCanvasElement.height = video?.clientHeight;
        predictWebcam();
      });
      
    });
  });
}

// 判断是否可以使用摄像头
const hasGetUserMedia = () => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// 绘制手势节点
const drawPalm = (landmarks: NormalizedLandmark[], ctx: CanvasRenderingContext2D | null, drawingUtils: any) => {
  if (!ctx) return;
  // 绘制手指
  drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
    color: "#00FF00",
    lineWidth: 2,
    });
  // 绘制手势节点
  drawingUtils.drawLandmarks(landmarks, {
    color: "#FF0000",
    lineWidth: 1,
    radius: 4
  
  });
};

// 写字
const SMOOTHING_FACTOR = 0.8; // 平滑因子，用来解决绘制抖动，避免线条断断续续，数值越大越平滑
const writeText = (ctx: CanvasRenderingContext2D | null, x: number, y: number) => {
  if (!ctx) return;
  if (!prevX || !prevY) {
      prevX = x;
      prevY = y;
    }
    const smoothedX = prevX + SMOOTHING_FACTOR * (x - prevX); // 平滑处理x坐标
    const smoothedY = prevY + SMOOTHING_FACTOR * (y - prevY); // 平滑处理y坐标
    ctx.lineWidth = 5; // 画笔宽度
    ctx.moveTo(prevX, prevY); // 画笔跟随
    ctx.lineTo(smoothedX, smoothedY); // 画笔移动
    ctx.strokeStyle = "#191919"; // 画笔颜色
    ctx.stroke(); // 画笔绘制
    ctx.save(); // 保存当前状态

    prevX = smoothedX;
    prevY = smoothedY;
}

// 根据手势位置擦除
const clearCanvas = (ctx: CanvasRenderingContext2D | null, x: number, y: number, width: number, height: number) => {
  if (!ctx) return;

  ctx.clearRect(x, y, width, height);
  ctx.restore();
  ctx.save();
};

// 截屏
const takeScreenshot = () => {
  const penCanvasElement = document.getElementById('penCanvas') as HTMLCanvasElement; // 获取手写区域的canvas
  const canvas = document.createElement('canvas');
  canvas.width = penCanvasElement.width;
  canvas.height = penCanvasElement.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(penCanvasElement, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL('image/png');
    // 下载图片
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'screenshot.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}


</script>

<style scoped>
.container {
    position: relative;
    min-height: 480px;
}
#webcam {
  /* opacity: 0; */
  position: fixed;
  bottom: -100px;
  right: -150px;
  transform: scale(0.4);
}
.loading {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translateX(-50%) translateY(-50%);
}

.hand_canvas {
  position: absolute;
  top: 0;
  left: 0;
  margin: 0 auto;
  transform: rotateY(180deg);
  -webkit-transform: rotateY(180deg);
  -moz-transform: rotateY(180deg);
}
.pen_canvas {
  position: absolute;
  top: 0;
  left: 0;
  margin: 0 auto;
  /* transform: rotateY(180deg);
  -webkit-transform: rotateY(180deg);
  -moz-transform: rotateY(180deg); */
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