'use strict'
var stream = require('stream')
var path = require('path')
var test = require('tap').test
var validate = require('aproba')
var extend = Object.assign || require('util')._extend

function assign () {
  var args = [].slice.call(arguments)
  var base = args.shift()
  while (args.length) {
    base = extend(base, args.shift())
  }
  return base
}

var copy = require('../copy.js')

function enoent () {
  var err = new Error('ENOENT')
  err.code = 'ENOENT'
  return err
}
function eperm () {
  var err = new Error('EPERM')
  err.code = 'EPERM'
  return err
}
function eread () {
  var err = new Error('EREAD')
  err.code = 'EREAD'
  return err
}
function ewrite () {
  var err = new Error('EWRITE')
  err.code = 'EWRITE'
  return err
}

var isNothing = {
  isDirectory: function () { return false },
  isSymbolicLink: function () { return false },
  isFile: function () { return false },
  isBlockDevice: function () { return false },
  isCharacterDevice: function () { return false },
  isFIFO: function () { return false },
  isSocket: function () { return false }
}
var fileExists = assign({}, isNothing, {isFile: function () { return true }})
var blockExists = assign({}, isNothing, {isBlockDevice: function () { return true }})
var charExists = assign({}, isNothing, {isCharacterDevice: function () { return true }})
var fifoExists = assign({}, isNothing, {isFIFO: function () { return true }})
var socketExists = assign({}, isNothing, {isSocket: function () { return true }})
var unknownExists = isNothing
var dirExists = assign({}, isNothing, {isDirectory: function () { return true }})
var symlinkExists = assign({}, isNothing, {isSymbolicLink: function () { return true }})

function nextTick (fn) {
  var args = [].slice.call(arguments, 1)
  process.nextTick(function () {
    fn.apply(null, args)
  })
}

function rejects (t, code, msg, promise) {
  promise.then(function () { t.fail(msg) }).catch(function (err) {
    t.is(err.code, code, msg)
  })
}

function resolves (t, msg, promise) {
  promise.then(function () { t.pass(msg) }).catch(function (err) {
    t.ifError(err, msg)
  })
}

test('copy errors', function (t) {
  t.plan(8)
  var mockFs = {
    lstat: function (to, cb) {
      validate('SF', [to, cb])
      if (to === 'src:src-does-not-exist') {
        nextTick(cb, enoent())
      } else if (to === 'dest:src-does-not-exist') {
        nextTick(cb, enoent())
      } else if (to === 'src:dest-exists') {
        nextTick(cb, null, fileExists)
      } else if (to === 'dest:dest-exists') {
        nextTick(cb, null, fileExists)
      } else if (to === 'src:dest-perm') {
        nextTick(cb, null, fileExists)
      } else if (to === 'dest:dest-perm') {
        nextTick(cb, eperm())
      } else if (to === 'src:block') {
        nextTick(cb, null, blockExists)
      } else if (to === 'src:char') {
        nextTick(cb, null, charExists)
      } else if (to === 'src:fifo') {
        nextTick(cb, null, fifoExists)
      } else if (to === 'src:socket') {
        nextTick(cb, null, socketExists)
      } else if (to === 'src:unknown') {
        nextTick(cb, null, unknownExists)
      } else if (to === 'dest:block') {
        nextTick(cb, enoent())
      } else if (to === 'dest:char') {
        nextTick(cb, enoent())
      } else if (to === 'dest:fifo') {
        nextTick(cb, enoent())
      } else if (to === 'dest:socket') {
        nextTick(cb, enoent())
      } else if (to === 'dest:unknown') {
        nextTick(cb, enoent())
      } else {
        t.fail('unexpected lstat ' + to)
        nextTick(cb, enoent())
      }
    },
    createReadStream: function () { throw new Error('SHOULD NOT BE READING') }
  }
  var mocks = {
    fs: mockFs,
    writeStreamAtomic: function () { throw new Error('SHOULD NOT BE WRITING') }
  }
  rejects(t, 'ENOENT', 'source does not exist', copy('src:src-does-not-exist', 'dest:src-does-not-exist', mocks))
  rejects(t, 'EEXIST', 'dest exists', copy('src:dest-exists', 'dest:dest-exists', mocks))
  rejects(t, 'EPERM', 'dest perm error', copy('src:dest-perm', 'dest:dest-perm', mocks))
  rejects(t, 'EUNSUPPORTED', 'block devices unsupported', copy('src:block', 'dest:block', mocks))
  rejects(t, 'EUNSUPPORTED', 'char devices unsupported', copy('src:char', 'dest:char', mocks))
  rejects(t, 'EUNSUPPORTED', 'FIFOs unsupported', copy('src:fifo', 'dest:fifo', mocks))
  rejects(t, 'EUNSUPPORTED', 'sockets unsupported', copy('src:socket', 'dest:socket', mocks))
  rejects(t, 'EUNSUPPORTED', 'unknown unsupported', copy('src:unknown', 'dest:unknown', mocks))
})

test('copy file', function (t) {
  t.plan(7)
  var mockFs = {
    lstat: function (to, cb) {
      validate('SF', arguments)
      if (to === 'src:ok') {
        nextTick(cb, null, fileExists)
      } else if (to === 'dest:ok') {
        nextTick(cb, enoent())
      } else if (to === 'src:chown') {
        nextTick(cb, null, assign({uid: 100, gid: 100}, fileExists))
      } else if (to === 'dest:chown') {
        nextTick(cb, enoent())
      } else if (to === 'src:chmod') {
        nextTick(cb, null, assign({mode: 33188}, fileExists))
      } else if (to === 'dest:chmod') {
        nextTick(cb, enoent())
      } else if (to === 'src:read-error') {
        nextTick(cb, null, fileExists)
      } else if (to === 'dest:read-error') {
        nextTick(cb, enoent())
      } else if (to === 'src:write-error') {
        nextTick(cb, null, fileExists)
      } else if (to === 'dest:write-error') {
        nextTick(cb, enoent())
      } else {
        t.fail('unexpected lstat ' + to)
        nextTick(cb, enoent())
      }
    },
    chmod: function (file, mode, cb) {
      validate('SNF', arguments)
      if (file === 'dest:chmod') {
        t.pass('CHMOD: ' + file + ' ' + mode)
        nextTick(cb)
      } else {
        t.fail('unexpected chmod ' + file)
        nextTick(cb, enoent())
      }
    },
    createReadStream: function (from) {
      validate('S', arguments)
      var read = new stream.PassThrough()
      if (from === 'src:read-error') {
        nextTick(function () { read.emit('error', eread()) })
      } else {
        setTimeout(function () { read.end('content') }, 10)
      }
      return read
    }
  }
  var mocks = {
    fs: mockFs,
    getuid: function () { return 0 },
    writeStreamAtomic: function (to, opts) {
      validate('SO', arguments)
      var write = new stream.PassThrough()
      write.on('data', function (chunk) { t.comment('WROTE ' + to + ': ' + chunk) })
      if (opts.chown) {
        t.is(opts.chown.uid, 100, 'CHOWN uid:100')
      }
      if (to === 'dest:write-error') {
        nextTick(function () { write.emit('error', ewrite()) })
      }
      write.on('finish', function () { write.emit('close') })
      return write
    }
  }
  resolves(t, 'copy ok', copy('src:ok', 'dest:ok', mocks))
  resolves(t, 'copy w/chmod ok', copy('src:chmod', 'dest:chmod', mocks))
  resolves(t, 'copy w/chown ok', copy('src:chown', 'dest:chown', mocks))
  rejects(t, 'EREAD', 'read errors propagate', copy('src:read-error', 'dest:read-error', mocks))
  rejects(t, 'EWRITE', 'write errors propagate', copy('src:write-error', 'dest:write-error', mocks))
})

test('copy symlink unix', function (t) {
  t.plan(6)
  var mockFs = {
    lstat: function (to, cb) {
      validate('SF', arguments)
      if (to === '/full/path/src:ok') {
        nextTick(cb, null, symlinkExists)
      } else if (to === '/full/path/src:dir-ok') {
        nextTick(cb, null, symlinkExists)
      } else if (to === '/full/path/src:bad') {
        nextTick(cb, null, symlinkExists)
      } else if (to === '/full/path/src:dir-bad') {
        nextTick(cb, null, symlinkExists)
      } else if (to === 'dest:ok') {
        nextTick(cb, enoent())
      } else {
        t.fail('unexpected lstat ' + to)
        nextTick(cb, enoent())
      }
    },
    readlink: function (from, cb) {
      validate('SF', arguments)
      if (from === '/full/path/src:ok') {
        nextTick(cb, null, '../other/src:ok')
      } else if (from === '/full/path/src:dir-ok') {
        nextTick(cb, null, '../other/src:dir-ok')
      } else if (from === '/full/path/src:bad') {
        nextTick(cb, null, '../other/src:bad')
      } else if (from === '/full/path/src:dir-bad') {
        nextTick(cb, null, '../other/src:dir-bad')
      } else {
        t.fail('unexpected readlink ' + from)
        nextTick(cb, enoent())
      }
    },
    stat: function (to, cb) {
      validate('SF', arguments)
      t.fail('unexpected stat ' + to)
      nextTick(cb, enoent())
    },
    symlink: function (from, to, type, cb) {
      validate('SSSF|SSF', arguments)
      if (arguments.length === 3) {
        cb = type
      }
      if (from === '../other/src:ok') {
        t.pass('symlink type ' + from + ' → ' + to)
        nextTick(cb)
      } else if (from === '../other/src:dir-ok') {
        t.pass('symlink type ' + from + ' → ' + to)
        nextTick(cb)
      } else if (from === '../other/src:bad' || from === '../other/src:dir-bad') {
        nextTick(cb, eperm())
      } else {
        t.fail('unexpected symlink ' + from + ' → ' + to)
        nextTick(cb, enoent())
      }
    },
    chmod: function () { throw new Error('SHOULD NOT BE CHMODING') },
    createReadStream: function () { throw new Error('SHOULD NOT BE READING') }
  }
  var mocks = {
    isWindows: false,
    fs: mockFs,
    writeStreamAtomic: function () { throw new Error('SHOULD NOT BE WRITING') }
  }
  resolves(t, 'file symlink ok', copy('/full/path/src:ok', 'dest:ok', mocks))
  resolves(t, 'dir symlink ok', copy('/full/path/src:dir-ok', 'dest:ok', mocks))
  rejects(t, 'EPERM', 'failed file symlink fails', copy('/full/path/src:bad', 'dest:ok', mocks))
  rejects(t, 'EPERM', 'failed dir symlink fails', copy('/full/path/src:dir-bad', 'dest:ok', mocks))
})

test('copy symlink windows', function (t) {
  t.plan(8)
  var mockFs = {
    lstat: function (to, cb) {
      validate('SF', arguments)
      if (to === '/full/path/src:ok') {
        nextTick(cb, null, symlinkExists)
      } else if (to === '/full/path/src:dir-ok') {
        nextTick(cb, null, symlinkExists)
      } else if (to === '/full/path/src:junction-ok') {
        nextTick(cb, null, symlinkExists)
      } else if (to === '/full/path/src:bad') {
        nextTick(cb, null, symlinkExists)
      } else if (to === '/full/path/src:dir-bad') {
        nextTick(cb, null, symlinkExists)
      } else if (to === 'dest:ok') {
        nextTick(cb, enoent())
      } else {
        t.fail('unexpected lstat ' + to)
        nextTick(cb, enoent())
      }
    },
    readlink: function (from, cb) {
      validate('SF', arguments)
      if (from === '/full/path/src:ok') {
        nextTick(cb, null, '../other/src:ok')
      } else if (from === '/full/path/src:dir-ok') {
        nextTick(cb, null, '../other/src:dir-ok')
      } else if (from === '/full/path/src:junction-ok') {
        nextTick(cb, null, '../other/src:junction-ok')
      } else if (from === '/full/path/src:bad') {
        nextTick(cb, null, '../other/src:bad')
      } else if (from === '/full/path/src:dir-bad') {
        nextTick(cb, null, '../other/src:dir-bad')
      } else {
        t.fail('unexpected readlink ' + from)
        nextTick(cb, enoent())
      }
    },
    stat: function (to, cb) {
      validate('SF', arguments)
      if (to === path.resolve('/full/other/src:ok')) {
        nextTick(cb, null, fileExists)
      } else if (to === path.resolve('/full/other/src:dir-ok')) {
        nextTick(cb, null, dirExists)
      } else if (to === path.resolve('/full/other/src:junction-ok')) {
        nextTick(cb, null, dirExists)
      } else if (to === path.resolve('/full/other/src:bad')) {
        nextTick(cb, null, fileExists)
      } else if (to === path.resolve('/full/other/src:dir-bad')) {
        nextTick(cb, null, dirExists)
      } else {
        t.fail('unexpected stat ' + to)
        nextTick(cb, enoent())
      }
    },
    symlink: function (from, to, type, cb) {
      validate('SSSF|SSF', arguments)
      if (arguments.length === 3) {
        cb = type
        type = 'file'
      }
      if (from === '../other/src:ok') {
        t.is(type, 'file', 'symlink type ' + from + ' → ' + to)
        nextTick(cb)
      } else if (from === '../other/src:dir-ok') {
        t.is(type, 'dir', 'symlink type ' + from + ' → ' + to)
        nextTick(cb)
      } else if (from === '../other/src:junction-ok') {
        if (type === 'dir') {
          nextTick(cb, eperm())
        } else {
          t.is(type, 'junction', 'symlink type ' + from + ' → ' + to)
          nextTick(cb)
        }
      } else if (from === '../other/src:bad' || from === '../other/src:dir-bad') {
        nextTick(cb, eperm())
      } else {
        t.fail('unexpected symlink ' + from + ' → ' + to)
        nextTick(cb, enoent())
      }
    },
    chmod: function () { throw new Error('SHOULD NOT BE CHMODING') },
    createReadStream: function () { throw new Error('SHOULD NOT BE READING') }
  }
  var mocks = {
    isWindows: true,
    fs: mockFs,
    writeStreamAtomic: function () { throw new Error('SHOULD NOT BE WRITING') }
  }
  resolves(t, 'file symlink ok', copy('/full/path/src:ok', 'dest:ok', mocks))
  resolves(t, 'dir symlink ok', copy('/full/path/src:dir-ok', 'dest:ok', mocks))
  resolves(t, 'dir junction fallback ok', copy('/full/path/src:junction-ok', 'dest:ok', mocks))
  rejects(t, 'EPERM', 'failed file symlink fails', copy('/full/path/src:bad', 'dest:ok', mocks))
  rejects(t, 'EPERM', 'failed dir symlink fails', copy('/full/path/src:dir-bad', 'dest:ok', mocks))
})
