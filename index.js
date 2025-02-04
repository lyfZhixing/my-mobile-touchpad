/**
 * MIT License
 * 
 * Copyright (c) 2022 huoyijie (https://huoyijie.cn)
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// require("imports?window=>{}!hammer")
const robot = require("robotjs")
// const Hammerjd = () => import('hammerjs')
// Speed up the mouse.
robot.setMouseDelay(2)
robot.setKeyboardDelay(2)
const { width, height } = robot.getScreenSize()
console.debug('\ncomputer resolution', width, height)
var pointer = robot.getMousePos()
var pressed = false

const fs = require('fs/promises')
const Koa = require('koa')
const { createServer } = require('http')
const { Server } = require('socket.io')

const app = new Koa()
const render = require('./lib/render')
const bodyParser = require('koa-bodyparser')
const router = require('@koa/router')()
router.get('/', async ctx => {
  await ctx.render('index', {})
}).get('/hammerjs/hammer.js', async ctx => {
  ctx.set('Content-Type', 'application/javascript')
  ctx.body = await fs.readFile('./node_modules/hammerjs/hammer.min.js')
}).get('/socket.io.msgpack.min.js', async ctx => {
  ctx.set('Content-Type', 'application/javascript')
  ctx.body = await fs.readFile('./javascripts/socket.io.msgpack.min.js')
})

app.use(render)
app.use(bodyParser())
app.use(router.routes())


const parser = require("socket.io-msgpack-parser")
const httpServer = createServer(app.callback())
const io = new Server(httpServer, {
  'pingInterval': 20000,
  'pingTimeout': 30000,
  'transports': ['websocket'],
  allowUpgrades: false,
  maxHttpBufferSize: 1e8, // 100M
  parser
})
const socketSet = new Set()

io.on('connection', (socket) => {
  socketSet.add(socket)
  socket.on('panstart', () => {
    pointer = robot.getMousePos()
  }).on('panmove', (buffer) => {
    const { clientWidth, clientHeight } = socket.handshake.query
    const x = buffer.readInt16LE(0)
    const y = buffer.readInt16LE(2)
    // 调整鼠标速度 x
    const toX = pointer.x + Math.floor(x / clientWidth * width * 1.8)
    // 调整鼠标速度 y
    const toY = pointer.y + Math.floor(y / clientHeight * height * 2.0)
    if (pressed) {
      robot.dragMouse(toX, toY)
    } else {
      robot.moveMouse(toX, toY)
    }
  }).on('panend', () => {
    pointer = robot.getMousePos()
    if (pressed) {
      pressed = false
      robot.mouseToggle('up', 'left')
    }
  }).on('panleft', () => {
    // 调整滑动速度
    robot.scrollMouse(30, 0)
  }).on('panright', () => {
    robot.scrollMouse(-30, 0)
  }).on('panup', () => {
    robot.scrollMouse(0, 30)
  }).on('pandown', () => {
    robot.scrollMouse(0, -30)
  }).on('tap', () => {
    robot.mouseClick('left', false)
    // robot.mouseClick('right', false)
  }).on('righttap', () => {
    robot.mouseClick('right', false)
  }).on('press', () => {
    pressed = true
    robot.mouseToggle('down', 'left')
  }).on('pressup', () => {
    pressed = false
    robot.mouseToggle('up', 'left')
  }).on('swiperight', () => {
    // pressed = true
    robot.keyTap('right', ['command', 'control'])
  }).on('swipeleft', () => {
    // pressed = false
    robot.keyTap('left', ['command', 'control'])
  }).on('swipeup', () => {
    // pressed = false
    robot.keyTap('tab', 'command')
  }).on('swipedown', () => {
    // pressed = false
    robot.keyTap('d', 'command')
  }).on('doublepress', (reason) => {    
    // robot.keyTap('audio_vol_down')
  }).on('triplepress', (reason) => {
    // robot.keyTap('audio_vol_up')
    robot.keyTap('command')
  }).on("disconnect", (reason) => {
    console.debug('socket disconnect', reason)
    socketSet.delete(socket)
  })
  // .on('tripletap', () => {
  //   robot.keyTap('command')
  //   // robot.keyTap('audio_vol_down')
  // })
})

httpServer.listen(3000)

function shutdown() {
  httpServer.close()
  for (let socket of socketSet) {
    socket.disconnect(true)
  }
}

process
  .on('unhandledRejection', (reason, promise) => {
    console.error(reason, 'Unhandled Rejection at Promise', promise)
  })
  .on('uncaughtException', (err, origin) => {
    console.error('Uncaught Exception thrown', err, origin, 'close the server')
    shutdown()
    process.exitCode = 1
  })
  .once('SIGINT', function (code) {
    console.warn('SIGINT received...', code, 'close the server')
    shutdown()
  })
  .once('SIGTERM', function (code) {
    console.warn('SIGTERM received...', code, 'close the server')
    shutdown()
  })